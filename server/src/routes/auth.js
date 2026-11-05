const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { User, UserImage, MoneyRequest } = require('../models');
const { getSettings } = require('../db');
const { logActivity } = require('../billing');
const { clean, isEmail, validPhone, escapeRegex, hallNowLabel } = require('../time');
const { taka, inDebt, orderingBlocked } = require('../money');
const { checkImage, acceptImages } = require('../images');

const router = express.Router();

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function presentUser(user) {
  if (!user) return null;
  const paisa = user.balancePaisa || 0;
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    studentCode: user.studentCode || '',
    roomNo: user.roomNo || '',
    phone: user.phone || '',
    status: user.status,
    balance: paisa / 100,
    balanceLabel: taka(paisa / 100),
    inDebt: inDebt(paisa),
    orderingBlocked: orderingBlocked(paisa),
    hasPhoto: Boolean(user.hasPhoto),
    hasIdCard: Boolean(user.hasIdCard)
  };
}

async function sessionPayload(req) {
  const settings = await getSettings();
  let pendingSignups = 0;
  let pendingDeposits = 0;
  if (req.user && req.user.role === 'admin') {
    pendingSignups = await User.countDocuments({ status: 'pending' });
    pendingDeposits = await MoneyRequest.countDocuments({ status: 'pending' });
  }
  return {
    user: presentUser(req.user),
    hallName: settings.hallName,
    hallNow: hallNowLabel(),
    pendingSignups,
    pendingDeposits
  };
}

router.get('/me', asyncRoute(async (req, res) => {
  res.json(await sessionPayload(req));
}));

router.post('/login', asyncRoute(async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email });
  const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !matches) {
    return res.status(401).json({ message: 'Those details do not match an active account.' });
  }
  if (user.status === 'pending') {
    return res.status(403).json({ message: 'This account is waiting for the hall office to approve it.' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ message: 'This account is inactive. Ask the hall office to turn it back on.' });
  }
  req.session.userId = String(user._id);
  await logActivity(user._id, 'Signed in', user.role);
  req.user = user;
  res.json(await sessionPayload(req));
}));

// Password reset flow: only the token hash is stored; the raw token is emailed once.
router.post('/forgot-password', asyncRoute(async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const studentCode = clean(req.body.studentCode, 40);
  if (!isEmail(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (studentCode.length < 2) return res.status(400).json({ message: 'Enter your registered Student ID.' });
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return res.status(503).json({ message: 'Password reset email is not configured yet. Please contact the hall office.' });
  }

  // Both values must belong to the same account.
  const user = await User.findOne({
    email,
    studentCode: { $regex: `^${escapeRegex(studentCode)}$`, $options: 'i' }
  });
  if (!user) {
    return res.status(404).json({ message: 'The email address and Student ID do not match an existing account.' });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    return res.status(503).json({ message: 'Password reset website URL is not configured. Please contact the hall office.' });
  }
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [user.email],
      subject: 'Reset your HallMeal password',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;line-height:1.6;color:#202b35"><h2>Reset your HallMeal password</h2><p>We received a request to reset the password for your HallMeal account.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#176b5b;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a></p><p>This link expires in 15 minutes and can be used only once.</p><p>If you did not request this change, you can ignore this email.</p></div>`
    })
  });
  if (!emailResponse.ok) {
    const details = await emailResponse.text();
    console.error('Password reset email failed:', details);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    return res.status(502).json({ message: 'Could not send the reset email. Please try again later or contact the hall office.' });
  }

  res.json({
    message: 'A password reset link has been sent to your registered email address.',
    expiresInMinutes: 15
  });
}));

router.post('/reset-password', asyncRoute(async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  const confirm = String(req.body.confirm || '');
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ message: 'This reset link is invalid. Request a new one.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Choose a password of at least 6 characters.' });
  }
  if (password !== confirm) {
    return res.status(400).json({ message: 'The two passwords do not match.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() }
  });
  if (!user) {
    return res.status(400).json({ message: 'This reset link is invalid, expired, or already used. Please request a new link.' });
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();
  await logActivity(user._id, 'Reset password', 'Password changed using a temporary reset link');
  res.json({ message: 'Your password has been updated. You can now sign in with your new password.' });
}));

router.post('/logout', (req, res) => {
  const finish = () => {
    res.clearCookie('hallmeal.sid', { path: '/' });
    res.json({ ok: true });
  };
  if (!req.session) return finish();
  req.session.destroy(finish);
});

const pictureFields = [{ name: 'photo', maxCount: 1 }, { name: 'idCard', maxCount: 1 }];

router.post('/signup', acceptImages(pictureFields), asyncRoute(async (req, res) => {
  const form = {
    fullName: clean(req.body.fullName, 120),
    email: clean(req.body.email, 160).toLowerCase(),
    studentCode: clean(req.body.studentCode, 40),
    roomNo: clean(req.body.roomNo, 40),
    phone: clean(req.body.phone, 30)
  };
  const password = String(req.body.password || '');
  const confirm = String(req.body.confirm || '');
  const photo = req.files && req.files.photo ? checkImage(req.files.photo[0]) : null;
  const idCard = req.files && req.files.idCard ? checkImage(req.files.idCard[0]) : null;
  if (form.fullName.length < 2) return res.status(400).json({ message: 'Enter your full name.' });
  if (!isEmail(form.email)) return res.status(400).json({ message: 'Enter a valid email.' });
  if (form.studentCode.length < 2) return res.status(400).json({ message: 'Enter an ID number.' });
  if (!validPhone(form.phone)) return res.status(400).json({ message: 'Enter an 11-digit mobile number.' });
  if (password.length < 6) return res.status(400).json({ message: 'Choose a password of at least 6 characters.' });
  if (password !== confirm) return res.status(400).json({ message: 'The two passwords do not match.' });
  if (photo && photo.error) return res.status(400).json({ message: photo.error });
  if (!idCard) return res.status(400).json({ message: 'Add a photo of your ID card.' });
  if (idCard.error) return res.status(400).json({ message: idCard.error });
  if (await User.exists({ email: form.email })) {
    return res.status(400).json({ message: 'That email is already on the hall record.' });
  }
  if (await User.exists({ studentCode: { $regex: `^${escapeRegex(form.studentCode)}$`, $options: 'i' } })) {
    return res.status(400).json({ message: 'That ID is already on the hall record.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    ...form,
    passwordHash,
    role: 'student',
    status: 'pending',
    hasPhoto: Boolean(photo),
    hasIdCard: true
  });
  try {
    const pictures = [{ userId: user._id, kind: 'idCard', ...idCard }];
    if (photo) pictures.push({ userId: user._id, kind: 'photo', ...photo });
    await UserImage.insertMany(pictures);
  } catch (error) {
    await UserImage.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
    throw error;
  }
  await logActivity(user._id, 'Requested an account', form.email);
  res.status(201).json({
    message: 'Request received. You can sign in after the hall office approves the account.'
  });
}));

router.put('/profile', asyncRoute(async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Sign in first.' });
  const fullName = clean(req.body.fullName, 120);
  const roomNo = clean(req.body.roomNo, 40);
  const phone = clean(req.body.phone, 30);
  if (fullName.length < 2) return res.status(400).json({ message: 'Enter your full name.' });
  if (!validPhone(phone)) return res.status(400).json({ message: 'Enter an 11-digit mobile number.' });
  req.user.fullName = fullName;
  req.user.roomNo = roomNo;
  req.user.phone = phone;
  await req.user.save();
  await logActivity(req.user._id, 'Updated profile', fullName);
  res.json({ message: 'Profile saved.', user: presentUser(req.user) });
}));

router.put('/profile/pictures', acceptImages(pictureFields), asyncRoute(async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Sign in first.' });
  const photoFile = req.files && req.files.photo ? req.files.photo[0] : null;
  const cardFile = req.files && req.files.idCard ? req.files.idCard[0] : null;
  if (!photoFile && !cardFile) return res.status(400).json({ message: 'Choose a picture to save.' });
  const photo = photoFile ? checkImage(photoFile) : null;
  const idCard = cardFile ? checkImage(cardFile) : null;
  if (photo && photo.error) return res.status(400).json({ message: photo.error });
  if (idCard && idCard.error) return res.status(400).json({ message: idCard.error });
  if (photo) {
    await UserImage.findOneAndUpdate(
      { userId: req.user._id, kind: 'photo' },
      { userId: req.user._id, kind: 'photo', contentType: photo.contentType, data: photo.data, bytes: photo.bytes },
      { upsert: true }
    );
    req.user.hasPhoto = true;
  }
  if (idCard) {
    await UserImage.findOneAndUpdate(
      { userId: req.user._id, kind: 'idCard' },
      { userId: req.user._id, kind: 'idCard', contentType: idCard.contentType, data: idCard.data, bytes: idCard.bytes },
      { upsert: true }
    );
    req.user.hasIdCard = true;
  }
  await req.user.save();
  await logActivity(req.user._id, 'Updated pictures', req.user.fullName);
  res.json({ message: 'Picture saved.', user: presentUser(req.user) });
}));

router.get('/media/:id/:kind', asyncRoute(async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Sign in first.' });
  const kind = req.params.kind === 'photo' ? 'photo' : req.params.kind === 'id-card' ? 'idCard' : null;
  if (!kind || !mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'That picture is not on the record.' });
  }
  const self = String(req.user._id) === String(req.params.id);
  const staffOrAdmin = req.user.role === 'staff' || req.user.role === 'admin';
  if (kind === 'photo' && !self && !staffOrAdmin) {
    return res.status(403).json({ message: 'That photo is not yours to open.' });
  }
  if (kind === 'idCard' && !self && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'That ID card is not yours to open.' });
  }
  const file = await UserImage.findOne({ userId: req.params.id, kind });
  if (!file) return res.status(404).json({ message: 'That picture is not on the record.' });
  res.set('Content-Type', file.contentType);
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(Buffer.from(file.data));
}));

module.exports = router;
module.exports.presentUser = presentUser;
module.exports.asyncRoute = asyncRoute;
