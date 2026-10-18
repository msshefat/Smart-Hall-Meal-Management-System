const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const {
  User, UserImage, Menu, MealOrder, BazarCost, MealRate, Ledger, Complaint, Announcement, Activity, MoneyRequest
} = require('../models');
const { getSettings } = require('../db');
const { Setting } = require('../models');
const {
  recalculate, postBalance, saveMealFlags, costsOn, logActivity
} = require('../billing');
const { taka, fromPaisa, parseMoney, inDebt, orderingBlocked } = require('../money');
const {
  MEALS, MEAL_LABEL, todayDhaka, addDays, prettyDate, weekday, formatTime, prettyStamp,
  greeting, offsetPhrase, weekBounds, monthBounds, eachDate, validDate, describeLock,
  clean, isEmail, validPhone, escapeRegex
} = require('../time');
const { presentUser, asyncRoute } = require('./auth');

const router = express.Router();

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Sign in first.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'That desk is not yours.' });
    next();
  };
}

function asId(value) {
  return mongoose.Types.ObjectId.isValid(value) ? value : null;
}

router.get('/board', asyncRoute(async (req, res) => {
  const today = todayDhaka();
  const settings = await getSettings();
  const menus = await Menu.find({ menuDate: today });
  const orders = await MealOrder.find({ orderDate: today });
  const menuMap = Object.fromEntries(menus.map((row) => [row.mealType, row.items]));
  const counts = { breakfast: 0, lunch: 0, dinner: 0 };
  orders.forEach((order) => {
    MEALS.forEach((meal) => {
      if (order[meal]) counts[meal] += 1;
    });
  });
  res.json({
    hallName: settings.hallName,
    dateLabel: prettyDate(today),
    meals: MEALS.map((meal) => ({
      key: meal,
      label: MEAL_LABEL[meal],
      items: menuMap[meal] || 'Not posted yet',
      count: counts[meal],
      lock: describeLock(today, meal, settings)
    }))
  });
}));

router.get('/dashboard', requireRole('student', 'staff', 'admin'), asyncRoute(async (req, res) => {
  const today = todayDhaka();
  const settings = await getSettings();
  if (req.user.role === 'student') return res.json(await studentHome(req.user, today, settings));
  if (req.user.role === 'staff') return res.json(await staffHome(today, settings));
  return res.json(await adminHome(today, settings));
}));

async function studentHome(user, today, settings) {
  const month = monthBounds(today);
  const orders = await MealOrder.find({
    userId: user._id,
    orderDate: { $gte: month.start, $lte: month.end }
  });
  let mealCount = 0;
  orders.forEach((order) => {
    MEALS.forEach((meal) => {
      if (order[meal]) mealCount += 1;
    });
  });
  const charges = await Ledger.find({
    userId: user._id,
    mealDate: { $gte: month.start, $lte: month.end },
    entryType: { $in: ['meal_charge', 'charge_reversal'] }
  });
  const spent = charges.reduce((sum, row) => sum + (row.entryType === 'meal_charge' ? row.amountPaisa : -row.amountPaisa), 0);
  const openComplaints = await Complaint.countDocuments({
    userId: user._id,
    status: { $in: ['open', 'in_review'] }
  });
  const todayOrder = await MealOrder.findOne({ userId: user._id, orderDate: today });
  const menus = await Menu.find({ menuDate: today });
  const menuMap = Object.fromEntries(menus.map((row) => [row.mealType, row.items]));
  return {
    role: 'student',
    greeting: greeting(),
    todayLabel: prettyDate(today),
    monthLabel: month.label,
    mealCount,
    monthSpent: taka(spent / 100),
    openComplaints,
    meals: MEALS.map((meal) => ({
      key: meal,
      label: MEAL_LABEL[meal],
      items: menuMap[meal] || 'Not posted yet',
      on: Boolean(todayOrder && todayOrder[meal]),
      lock: describeLock(today, meal, settings)
    }))
  };
}

async function staffHome(today, settings) {
  const orders = await MealOrder.find({ orderDate: today });
  const costs = await BazarCost.find({ costDate: today });
  const rates = await MealRate.find({ rateDate: today });
  const counts = { breakfast: 0, lunch: 0, dinner: 0 };
  orders.forEach((order) => MEALS.forEach((meal) => { if (order[meal]) counts[meal] += 1; }));
  const costMap = Object.fromEntries(costs.map((row) => [row.mealType, row]));
  const rateMap = Object.fromEntries(rates.map((row) => [row.mealType, row]));
  return {
    role: 'staff',
    greeting: greeting(),
    todayLabel: prettyDate(today),
    meals: MEALS.map((meal) => ({
      key: meal,
      label: MEAL_LABEL[meal],
      count: counts[meal],
      cost: costMap[meal] ? fromPaisa(costMap[meal].amountPaisa) : null,
      costLabel: costMap[meal] ? taka(costMap[meal].amountPaisa / 100) : null,
      rateLabel: rateMap[meal] ? taka(rateMap[meal].ratePaisa / 100) : null,
      lock: describeLock(today, meal, settings)
    }))
  };
}

async function adminHome(today, settings) {
  const [students, staff, inactive, pending, depositRequests] = await Promise.all([
    User.countDocuments({ role: 'student', status: 'active' }),
    User.countDocuments({ role: 'staff', status: 'active' }),
    User.countDocuments({ status: 'inactive' }),
    User.countDocuments({ status: 'pending' }),
    MoneyRequest.countDocuments({ status: 'pending' })
  ]);
  const orders = await MealOrder.find({ orderDate: today });
  const counts = { breakfast: 0, lunch: 0, dinner: 0 };
  orders.forEach((order) => MEALS.forEach((meal) => { if (order[meal]) counts[meal] += 1; }));
  const openComplaints = await Complaint.countDocuments({ status: { $in: ['open', 'in_review'] } });
  const low = await User.find({ role: 'student', status: 'active', balancePaisa: { $lt: 30000 } })
    .sort({ balancePaisa: 1 })
    .limit(5);
  const lowCount = await User.countDocuments({ role: 'student', status: 'active', balancePaisa: { $lt: 30000 } });
  const activity = await Activity.find().sort({ _id: -1 }).limit(6).populate('userId', 'fullName');
  return {
    role: 'admin',
    greeting: greeting(),
    todayLabel: prettyDate(today),
    users: { students, staff, inactive, pending },
    depositRequests,
    counts,
    openComplaints,
    lowCount,
    low: low.map((person) => ({
      fullName: person.fullName,
      roomNo: person.roomNo || 'No room',
      balanceLabel: taka(person.balancePaisa / 100),
      due: person.balancePaisa < 0
    })),
    locks: MEALS.map((meal) => ({
      label: MEAL_LABEL[meal],
      text: `${formatTime(settings[`${meal}LockTime`])} on ${offsetPhrase(settings[`${meal}LockOffsetDays`])}`
    })),
    activity: activity.map((item) => ({
      action: item.action,
      details: item.details || '—',
      who: item.userId ? item.userId.fullName : 'System',
      when: prettyStamp(item.createdAt)
    }))
  };
}

router.get('/orders', requireRole('student'), asyncRoute(async (req, res) => {
  const settings = await getSettings();
  const today = todayDhaka();
  const windowDays = Math.min(14, Math.max(1, Number(settings.orderWindowDays) || 7));
  const dates = Array.from({ length: windowDays }, (_, index) => addDays(today, index));
  const [menus, orders] = await Promise.all([
    Menu.find({ menuDate: { $in: dates } }),
    MealOrder.find({ userId: req.user._id, orderDate: { $in: dates } })
  ]);
  const menuMap = new Map(menus.map((row) => [`${row.menuDate}:${row.mealType}`, row.items]));
  const orderMap = new Map(orders.map((row) => [row.orderDate, row]));
  const paisa = req.user.balancePaisa || 0;
  res.json({
    windowDays,
    inDebt: inDebt(paisa),
    orderingBlocked: orderingBlocked(paisa),
    balanceLabel: taka(paisa / 100),
    rules: [
      ...MEALS.map((meal) => `${MEAL_LABEL[meal]} closes at ${formatTime(settings[`${meal}LockTime`])} on ${offsetPhrase(settings[`${meal}LockOffsetDays`])}.`),
      'A negative balance can still order meals until it goes past −৳500.'
    ],
    days: dates.map((date) => {
      const order = orderMap.get(date);
      const meals = MEALS.map((meal) => {
        const lock = describeLock(date, meal, settings);
        const on = Boolean(order && order[meal]);
        return {
          key: meal,
          label: MEAL_LABEL[meal],
          items: menuMap.get(`${date}:${meal}`) || 'Menu not posted',
          on,
          taken: Boolean(order && order[`${meal}Taken`]),
          locked: !lock.open,
          lockLabel: lock.label
        };
      });
      return {
        iso: date,
        label: prettyDate(date),
        weekday: weekday(date),
        isToday: date === today,
        onCount: meals.filter((meal) => meal.on).length,
        meals
      };
    })
  });
}));

router.post('/orders/toggle', requireRole('student'), asyncRoute(async (req, res) => {
  const date = validDate(req.body.date);
  const meal = MEALS.includes(req.body.meal) ? req.body.meal : null;
  const turnOn = req.body.turn === 'on';
  if (!date || !meal) return res.status(400).json({ message: 'Choose a meal.' });
  const settings = await getSettings();
  const today = todayDhaka();
  const windowDays = Math.min(14, Math.max(1, Number(settings.orderWindowDays) || 7));
  if (date < today || date > addDays(today, windowDays - 1)) {
    return res.status(400).json({ message: 'That day is outside the booking window.' });
  }
  const lock = describeLock(date, meal, settings);
  if (!lock.open) return res.status(400).json({ message: `${MEAL_LABEL[meal]} is locked. ${lock.label}.` });
  const existing = await MealOrder.findOne({ userId: req.user._id, orderDate: date });
  if (existing && existing[`${meal}Taken`]) {
    return res.status(400).json({ message: `${MEAL_LABEL[meal]} is already marked taken, so it cannot be changed.` });
  }
  if (turnOn && orderingBlocked(req.user.balancePaisa)) {
    return res.status(400).json({ message: 'Your balance is past −৳500, so new meals are closed until the hall office adds money.' });
  }
  const flags = {
    breakfast: existing ? existing.breakfast : false,
    lunch: existing ? existing.lunch : false,
    dinner: existing ? existing.dinner : false
  };
  flags[meal] = turnOn;
  await saveMealFlags({ userId: req.user._id, date, ...flags, actorId: req.user._id });
  if ((await costsOn(date)).has(meal)) await recalculate(date, meal, req.user._id);
  const fresh = await User.findById(req.user._id);
  await logActivity(req.user._id, turnOn ? 'Turned a meal on' : 'Turned a meal off', `${MEAL_LABEL[meal]} · ${prettyDate(date)}`);
  res.json({
    on: turnOn,
    message: turnOn ? `${MEAL_LABEL[meal]} is on your list.` : `${MEAL_LABEL[meal]} is off.`,
    balanceLabel: taka((fresh.balancePaisa || 0) / 100)
  });
}));

router.get('/menu', requireRole('student', 'staff', 'admin'), asyncRoute(async (req, res) => {
  const date = validDate(req.query.date) || todayDhaka();
  const rows = await Menu.find({ menuDate: date });
  const map = Object.fromEntries(rows.map((row) => [row.mealType, row.items]));
  res.json({
    date,
    dateLabel: prettyDate(date),
    prev: addDays(date, -1),
    next: addDays(date, 1),
    meals: MEALS.map((meal) => ({ key: meal, label: MEAL_LABEL[meal], items: map[meal] || '' }))
  });
}));

router.post('/menu', requireRole('admin'), asyncRoute(async (req, res) => {
  const date = validDate(req.body.date);
  if (!date) return res.status(400).json({ message: 'Choose a valid date.' });
  for (const meal of MEALS) {
    const items = clean(req.body[meal], 400);
    await Menu.findOneAndUpdate(
      { menuDate: date, mealType: meal },
      { items, updatedBy: req.user._id },
      { upsert: true }
    );
  }
  await logActivity(req.user._id, 'Updated menu', prettyDate(date));
  res.json({ message: `Menu saved for ${prettyDate(date)}.` });
}));

router.get('/billing', requireRole('student'), asyncRoute(async (req, res) => {
  const month = monthBounds(todayDhaka());
  const rows = await Ledger.find({ userId: req.user._id }).sort({ createdAt: -1, _id: -1 }).limit(80);
  const monthRows = await Ledger.find({
    userId: req.user._id,
    mealDate: { $gte: month.start, $lte: month.end },
    entryType: { $in: ['meal_charge', 'charge_reversal'] }
  });
  const spent = monthRows.reduce((sum, row) => sum + (row.entryType === 'meal_charge' ? row.amountPaisa : -row.amountPaisa), 0);
  const fresh = await User.findById(req.user._id);
  const requests = await MoneyRequest.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20);
  res.json({
    balanceLabel: taka((fresh.balancePaisa || 0) / 100),
    due: (fresh.balancePaisa || 0) < 0,
    monthLabel: month.label,
    monthSpent: taka(spent / 100),
    requests: requests.map(presentDeposit),
    entries: rows.map((row) => ({
      id: String(row._id),
      when: prettyStamp(row.createdAt),
      note: row.note || row.entryType.replace('_', ' '),
      type: row.entryType.replace('_', ' '),
      direction: row.direction,
      amountLabel: `${row.direction === 'credit' ? '+' : '−'}${taka(row.amountPaisa / 100)}`
    }))
  });
}));

router.post('/deposits', requireRole('student'), asyncRoute(async (req, res) => {
  const money = parseMoney(req.body.amount);
  const note = clean(req.body.note, 240);
  if (!money || money.error || money.paisa <= 0) {
    return res.status(400).json({ message: 'Enter an amount above zero.' });
  }
  const waiting = await MoneyRequest.countDocuments({ userId: req.user._id, status: 'pending' });
  if (waiting >= 3) {
    return res.status(400).json({ message: 'You already have requests waiting. The hall office will review them first.' });
  }
  await MoneyRequest.create({ userId: req.user._id, amountPaisa: money.paisa, note, status: 'pending' });
  await logActivity(req.user._id, 'Requested add money', taka(money.paisa / 100));
  res.status(201).json({ message: `Request for ${taka(money.paisa / 100)} sent. It is added only after the hall office approves it.` });
}));

router.get('/stats', requireRole('student'), asyncRoute(async (req, res) => {
  const view = ['daily', 'weekly', 'monthly'].includes(req.query.view) ? req.query.view : 'monthly';
  const anchor = validDate(req.query.date) || todayDhaka();
  let range = { start: anchor, end: anchor, label: prettyDate(anchor) };
  if (view === 'weekly') {
    const bounds = weekBounds(anchor);
    range = { ...bounds, label: `${prettyDate(bounds.start)} – ${prettyDate(bounds.end)}` };
  }
  if (view === 'monthly') range = monthBounds(anchor);
  const orders = await MealOrder.find({
    userId: req.user._id,
    orderDate: { $gte: range.start, $lte: range.end }
  });
  const charges = await Ledger.find({
    userId: req.user._id,
    mealDate: { $gte: range.start, $lte: range.end },
    entryType: { $in: ['meal_charge', 'charge_reversal'] }
  });
  const orderMap = new Map(orders.map((row) => [row.orderDate, row]));
  const chargeMap = new Map();
  charges.forEach((row) => {
    const key = `${row.mealDate}:${row.mealType}`;
    const delta = row.entryType === 'meal_charge' ? row.amountPaisa : -row.amountPaisa;
    chargeMap.set(key, (chargeMap.get(key) || 0) + delta);
  });
  const days = eachDate(range.start, range.end).map((date) => {
    const order = orderMap.get(date);
    let spent = 0;
    const meals = {};
    MEALS.forEach((meal) => {
      meals[meal] = Boolean(order && order[meal]);
      spent += chargeMap.get(`${date}:${meal}`) || 0;
    });
    return { date, label: prettyDate(date), ...meals, spent, spentLabel: taka(spent / 100) };
  });
  const totals = days.reduce((sum, day) => ({
    breakfast: sum.breakfast + (day.breakfast ? 1 : 0),
    lunch: sum.lunch + (day.lunch ? 1 : 0),
    dinner: sum.dinner + (day.dinner ? 1 : 0),
    spent: sum.spent + day.spent
  }), { breakfast: 0, lunch: 0, dinner: 0, spent: 0 });
  const max = Math.max(1, ...days.map((day) => day.spent));
  res.json({
    view,
    anchor,
    label: range.label,
    prev: addDays(anchor, view === 'monthly' ? -30 : view === 'weekly' ? -7 : -1),
    next: addDays(anchor, view === 'monthly' ? 30 : view === 'weekly' ? 7 : 1),
    totals: { ...totals, spentLabel: taka(totals.spent / 100) },
    days: days.map((day) => ({ ...day, width: Math.round((day.spent / max) * 100) }))
  });
}));

router.get('/complaints', requireRole('student'), asyncRoute(async (req, res) => {
  const rows = await Complaint.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ complaints: rows.map(presentComplaint) });
}));

router.post('/complaints', requireRole('student'), asyncRoute(async (req, res) => {
  const subject = clean(req.body.subject, 160);
  const message = clean(req.body.message, 2000);
  if (subject.length < 3 || message.length < 5) {
    return res.status(400).json({ message: 'Write a subject and a short message.' });
  }
  await Complaint.create({ userId: req.user._id, subject, message });
  await logActivity(req.user._id, 'Sent a complaint', subject);
  res.status(201).json({ message: 'The hall office has your note.' });
}));

router.get('/complaints/manage', requireRole('admin'), asyncRoute(async (req, res) => {
  const status = ['open', 'in_review', 'resolved', 'closed', 'all'].includes(req.query.status) ? req.query.status : 'open';
  const filter = status === 'all' ? {} : { status };
  const rows = await Complaint.find(filter).sort({ createdAt: -1 }).populate('userId', 'fullName roomNo');
  res.json({
    status,
    complaints: rows.map((row) => ({
      ...presentComplaint(row),
      fullName: row.userId ? row.userId.fullName : 'Student',
      roomNo: row.userId ? row.userId.roomNo : ''
    }))
  });
}));

router.post('/complaints/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const status = ['open', 'in_review', 'resolved', 'closed'].includes(req.body.status) ? req.body.status : 'in_review';
  const adminReply = clean(req.body.adminReply, 2000);
  const row = await Complaint.findByIdAndUpdate(req.params.id, {
    status,
    adminReply,
    handledBy: req.user._id
  });
  if (!row) return res.status(404).json({ message: 'That complaint is not on the record.' });
  await logActivity(req.user._id, 'Updated complaint', `${status}`);
  res.json({ message: 'Complaint updated.' });
}));

router.get('/notices', requireRole('student', 'staff', 'admin'), asyncRoute(async (req, res) => {
  const rows = await Announcement.find({ isActive: true }).sort({ createdAt: -1 });
  res.json({ notices: rows.map(presentNotice) });
}));

router.get('/notices/manage', requireRole('admin'), asyncRoute(async (req, res) => {
  const rows = await Announcement.find().sort({ createdAt: -1 });
  res.json({ notices: rows.map(presentNotice) });
}));

router.post('/notices', requireRole('admin'), asyncRoute(async (req, res) => {
  const title = clean(req.body.title, 180);
  const body = clean(req.body.body, 5000);
  if (title.length < 3 || body.length < 5) return res.status(400).json({ message: 'Write a title and a notice.' });
  await Announcement.create({ title, body, publishedBy: req.user._id });
  await logActivity(req.user._id, 'Published notice', title);
  res.status(201).json({ message: 'Notice published.' });
}));

router.post('/notices/:id/toggle', requireRole('admin'), asyncRoute(async (req, res) => {
  const row = await Announcement.findById(req.params.id);
  if (!row) return res.status(404).json({ message: 'That notice is gone.' });
  row.isActive = !row.isActive;
  await row.save();
  await logActivity(req.user._id, 'Toggled notice', row.title);
  res.json({ message: 'Notice visibility updated.' });
}));

router.post('/password', requireRole('student', 'staff', 'admin'), asyncRoute(async (req, res) => {
  const current = String(req.body.current || '');
  const next = String(req.body.next || '');
  if (next.length < 6) return res.status(400).json({ message: 'Use at least 6 characters.' });
  const matches = await bcrypt.compare(current, req.user.passwordHash);
  if (!matches) return res.status(400).json({ message: 'The current password is wrong.' });
  req.user.passwordHash = await bcrypt.hash(next, 10);
  await req.user.save();
  await logActivity(req.user._id, 'Changed password', req.user.role);
  res.json({ message: 'Password updated.' });
}));

router.get('/records', requireRole('staff', 'admin'), asyncRoute(async (req, res) => {
  const date = validDate(req.query.date) || todayDhaka();
  const settings = await getSettings();
  const students = await User.find({ role: 'student', status: { $ne: 'pending' } }).sort({ status: 1, fullName: 1 });
  const orders = await MealOrder.find({ orderDate: date, userId: { $in: students.map((student) => student._id) } });
  const orderMap = new Map(orders.map((row) => [String(row.userId), row]));
  res.json({
    date,
    dateLabel: prettyDate(date),
    prev: addDays(date, -1),
    next: addDays(date, 1),
    locks: Object.fromEntries(MEALS.map((meal) => [meal, describeLock(date, meal, settings)])),
    students: students.map((student) => {
      const order = orderMap.get(String(student._id));
      return {
        id: String(student._id),
        fullName: student.fullName,
        roomNo: student.roomNo || 'No room',
        studentCode: student.studentCode || '',
        status: student.status,
        breakfast: Boolean(order && (order.breakfast || order.breakfastTaken)),
        lunch: Boolean(order && (order.lunch || order.lunchTaken)),
        dinner: Boolean(order && (order.dinner || order.dinnerTaken)),
        breakfastTaken: Boolean(order && order.breakfastTaken),
        lunchTaken: Boolean(order && order.lunchTaken),
        dinnerTaken: Boolean(order && order.dinnerTaken)
      };
    })
  });
}));

router.post('/records', requireRole('staff', 'admin'), asyncRoute(async (req, res) => {
  const date = validDate(req.body.date);
  if (!date) return res.status(400).json({ message: 'Choose a valid date.' });
  const selected = {
    breakfast: new Set((req.body.breakfast || []).map(String)),
    lunch: new Set((req.body.lunch || []).map(String)),
    dinner: new Set((req.body.dinner || []).map(String))
  };
  const students = await User.find({ role: 'student', status: { $ne: 'pending' } }).select('_id');
  const priorOrders = await MealOrder.find({ orderDate: date, userId: { $in: students.map((student) => student._id) } });
  const priorMap = new Map(priorOrders.map((order) => [String(order.userId), order]));
  for (const student of students) {
    const id = String(student._id);
    const prior = priorMap.get(id);
    await saveMealFlags({
      userId: student._id,
      date,
      breakfast: selected.breakfast.has(id) || Boolean(prior && prior.breakfastTaken),
      lunch: selected.lunch.has(id) || Boolean(prior && prior.lunchTaken),
      dinner: selected.dinner.has(id) || Boolean(prior && prior.dinnerTaken),
      actorId: req.user._id
    });
  }
  const costs = await costsOn(date);
  for (const meal of costs) await recalculate(date, meal, req.user._id);
  await logActivity(req.user._id, 'Updated meal sheet', prettyDate(date));
  res.json({
    message: costs.size
      ? 'Meal sheet saved. Rates for posted bazar were recalculated.'
      : 'Meal sheet saved.'
  });
}));

router.get('/serving', requireRole('staff', 'admin'), asyncRoute(async (req, res) => {
  const code = clean(req.query.code, 40);
  if (code.length < 2) return res.status(400).json({ message: 'Enter an ID to search.' });
  const person = await User.findOne({
    status: { $ne: 'pending' },
    studentCode: { $regex: `^${escapeRegex(code)}$`, $options: 'i' }
  });
  if (!person) return res.status(404).json({ message: 'No one with that ID is on the hall record.' });
  const today = todayDhaka();
  const order = await MealOrder.findOne({ userId: person._id, orderDate: today });
  res.json({
    date: today,
    dateLabel: prettyDate(today),
    person: {
      id: String(person._id),
      fullName: person.fullName,
      studentCode: person.studentCode,
      roomNo: person.roomNo || '',
      role: person.role,
      phone: person.phone || '',
      hasPhoto: Boolean(person.hasPhoto)
    },
    meals: MEALS.map((meal) => ({
      key: meal,
      label: MEAL_LABEL[meal],
      on: Boolean(order && order[meal]),
      taken: Boolean(order && order[`${meal}Taken`]),
      takenAt: order && order[`${meal}TakenAt`] ? prettyStamp(order[`${meal}TakenAt`]) : ''
    }))
  });
}));

router.post('/serving', requireRole('staff', 'admin'), asyncRoute(async (req, res) => {
  const code = clean(req.body.code, 40);
  const meal = MEALS.includes(req.body.meal) ? req.body.meal : null;
  if (code.length < 2 || !meal) return res.status(400).json({ message: 'Search an ID and choose a meal.' });
  const person = await User.findOne({
    status: { $ne: 'pending' },
    studentCode: { $regex: `^${escapeRegex(code)}$`, $options: 'i' }
  });
  if (!person) return res.status(404).json({ message: 'No one with that ID is on the hall record.' });
  const today = todayDhaka();
  const order = await MealOrder.findOne({ userId: person._id, orderDate: today });
  if (!order || !order[meal]) {
    return res.status(400).json({ message: `${person.fullName} is not on today's ${MEAL_LABEL[meal].toLowerCase()} list.` });
  }
  if (order[`${meal}Taken`]) {
    return res.status(400).json({ message: `${MEAL_LABEL[meal]} is already marked taken for ${person.fullName}.` });
  }
  order[`${meal}Taken`] = true;
  order[`${meal}TakenAt`] = new Date();
  order.updatedBy = req.user._id;
  await order.save();
  await logActivity(req.user._id, 'Marked meal taken', `${person.fullName} · ${person.studentCode} · ${MEAL_LABEL[meal]}`);
  res.json({ message: `${MEAL_LABEL[meal]} marked taken for ${person.fullName}. They cannot take it again today.` });
}));

router.get('/costs', requireRole('staff', 'admin'), asyncRoute(async (req, res) => {
  const date = validDate(req.query.date) || todayDhaka();
  const [costs, orders, rates] = await Promise.all([
    BazarCost.find({ costDate: date }),
    MealOrder.find({ orderDate: date }),
    MealRate.find({ rateDate: date })
  ]);
  const counts = { breakfast: 0, lunch: 0, dinner: 0 };
  orders.forEach((order) => MEALS.forEach((meal) => { if (order[meal]) counts[meal] += 1; }));
  const costMap = Object.fromEntries(costs.map((row) => [row.mealType, row]));
  const rateMap = Object.fromEntries(rates.map((row) => [row.mealType, row]));
  res.json({
    date,
    dateLabel: prettyDate(date),
    prev: addDays(date, -1),
    next: addDays(date, 1),
    meals: MEALS.map((meal) => {
      const cost = costMap[meal];
      const rate = rateMap[meal];
      return {
        key: meal,
        label: MEAL_LABEL[meal],
        count: counts[meal],
        amount: cost ? fromPaisa(cost.amountPaisa) : '',
        note: cost ? cost.note : '',
        rateLabel: rate ? taka(rate.ratePaisa / 100) : null,
        roundingLabel: rate ? taka(rate.roundingPaisa / 100) : null
      };
    })
  });
}));

router.post('/costs', requireRole('staff', 'admin'), asyncRoute(async (req, res) => {
  const date = validDate(req.body.date);
  const meal = MEALS.includes(req.body.meal) ? req.body.meal : null;
  const money = parseMoney(req.body.amount);
  if (!date || !meal || !money || money.error) {
    return res.status(400).json({ message: 'Enter a date, a meal, and a bazar amount.' });
  }
  await BazarCost.findOneAndUpdate(
    { costDate: date, mealType: meal },
    { amountPaisa: money.paisa, note: clean(req.body.note, 240), enteredBy: req.user._id },
    { upsert: true }
  );
  const result = await recalculate(date, meal, req.user._id);
  await logActivity(req.user._id, 'Posted bazar', `${MEAL_LABEL[meal]} · ${prettyDate(date)} · ${taka(money.taka)}`);
  res.json({
    message: result.count
      ? `${MEAL_LABEL[meal]} rate is ${taka(result.rate)} for ${result.count} students. Undistributed ${taka(result.rounding)}.`
      : `${MEAL_LABEL[meal]} cost is saved. No students are marked on, so nobody was charged.`
  });
}));

router.get('/reports', requireRole('staff', 'admin'), asyncRoute(async (req, res) => {
  const end = validDate(req.query.end) || todayDhaka();
  const start = validDate(req.query.start) || addDays(end, -6);
  if (start > end) return res.status(400).json({ message: 'The start date is after the end date.' });
  const dates = eachDate(start, end);
  const [orders, costs, rates] = await Promise.all([
    MealOrder.find({ orderDate: { $gte: start, $lte: end } }),
    BazarCost.find({ costDate: { $gte: start, $lte: end } }),
    MealRate.find({ rateDate: { $gte: start, $lte: end } })
  ]);
  const counts = {};
  orders.forEach((order) => {
    if (!counts[order.orderDate]) counts[order.orderDate] = { breakfast: 0, lunch: 0, dinner: 0 };
    MEALS.forEach((meal) => { if (order[meal]) counts[order.orderDate][meal] += 1; });
  });
  const costMap = new Map(costs.map((row) => [`${row.costDate}:${row.mealType}`, row]));
  const rateMap = new Map(rates.map((row) => [`${row.rateDate}:${row.mealType}`, row]));
  const days = dates.map((date) => {
    const meals = MEALS.map((meal) => {
      const cost = costMap.get(`${date}:${meal}`);
      const rate = rateMap.get(`${date}:${meal}`);
      const orderCount = counts[date] ? counts[date][meal] : 0;
      const posted = rate ? rate.ratePaisa * rate.totalOrders : 0;
      return {
        meal,
        label: MEAL_LABEL[meal],
        orders: orderCount,
        costLabel: cost ? taka(cost.amountPaisa / 100) : '—',
        rateLabel: rate ? taka(rate.ratePaisa / 100) : '—',
        roundingLabel: rate ? taka(rate.roundingPaisa / 100) : '—',
        posted,
        costPaisa: cost ? cost.amountPaisa : 0
      };
    });
    return {
      date,
      label: prettyDate(date),
      meals,
      costLabel: taka(meals.reduce((sum, meal) => sum + meal.costPaisa, 0) / 100),
      postedLabel: taka(meals.reduce((sum, meal) => sum + meal.posted, 0) / 100)
    };
  });
  const totals = days.reduce((sum, day) => {
    day.meals.forEach((meal, index) => {
      sum.orders[index] += meal.orders;
      sum.cost += meal.costPaisa;
      sum.posted += meal.posted;
    });
    return sum;
  }, { orders: [0, 0, 0], cost: 0, posted: 0 });
  res.json({
    start,
    end,
    days,
    totals: {
      breakfast: totals.orders[0],
      lunch: totals.orders[1],
      dinner: totals.orders[2],
      costLabel: taka(totals.cost / 100),
      postedLabel: taka(totals.posted / 100),
      undistributedLabel: taka((totals.cost - totals.posted) / 100)
    }
  });
}));

router.get('/users', requireRole('admin'), asyncRoute(async (req, res) => {
  const q = clean(req.query.q, 80).toLowerCase();
  const users = await User.find().sort({ createdAt: -1 });
  const filtered = users.filter((user) => {
    if (!q) return true;
    return [user.fullName, user.email, user.studentCode, user.roomNo].join(' ').toLowerCase().includes(q);
  });
  const pending = filtered.filter((user) => user.status === 'pending').map(presentUser);
  const roleOrder = { admin: 0, staff: 1, student: 2 };
  const directory = filtered
    .filter((user) => user.status !== 'pending')
    .sort((a, b) => (roleOrder[a.role] - roleOrder[b.role]) || a.fullName.localeCompare(b.fullName))
    .map(presentUser);
  res.json({ q: req.query.q || '', pending, directory });
}));

router.post('/users', requireRole('admin'), asyncRoute(async (req, res) => {
  const form = readUser(req.body, true);
  const error = validateUser(form, true);
  if (error) return res.status(400).json({ message: error });
  if (await User.exists({ email: form.email })) return res.status(400).json({ message: 'That email is already used.' });
  if (await takenCode(form.studentCode)) return res.status(400).json({ message: 'That ID is already on the hall record.' });
  const passwordHash = await bcrypt.hash(form.password, 10);
  const user = await User.create({
    fullName: form.fullName,
    email: form.email,
    passwordHash,
    role: form.role,
    studentCode: form.studentCode,
    roomNo: form.roomNo,
    phone: form.phone,
    status: form.status
  });
  if (form.role === 'student' && form.balancePaisa > 0) {
    await postBalance({
      userId: user._id,
      entryType: 'deposit',
      direction: 'credit',
      amountPaisa: form.balancePaisa,
      note: 'Opening balance',
      actorId: req.user._id
    });
  }
  await logActivity(req.user._id, 'Added user', `${form.fullName} · ${form.role}`);
  res.status(201).json({ message: `${form.fullName} can sign in with the password you set.` });
}));

router.get('/users/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const user = await User.findById(asId(req.params.id));
  if (!user) return res.status(404).json({ message: 'That person is not on the record.' });
  res.json({ user: presentUser(user) });
}));

router.put('/users/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const existing = await User.findById(asId(req.params.id));
  if (!existing) return res.status(404).json({ message: 'That person is not on the record.' });
  const form = readUser(req.body, false);
  const error = validateUser(form, false) || await guardLastAdmin(existing, form);
  if (error) return res.status(400).json({ message: error });
  if (await User.exists({ email: form.email, _id: { $ne: existing._id } })) {
    return res.status(400).json({ message: 'That email is already used.' });
  }
  if (await takenCode(form.studentCode, existing._id)) {
    return res.status(400).json({ message: 'That ID is already on the hall record.' });
  }
  existing.fullName = form.fullName;
  existing.email = form.email;
  existing.role = form.role;
  existing.studentCode = form.studentCode;
  existing.roomNo = form.roomNo;
  existing.phone = form.phone;
  existing.status = form.status;
  if (form.password) existing.passwordHash = await bcrypt.hash(form.password, 10);
  await existing.save();
  await logActivity(req.user._id, 'Updated user', form.fullName);
  res.json({ message: `${form.fullName} was updated.` });
}));

router.delete('/users/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const existing = await User.findById(asId(req.params.id));
  if (!existing) return res.status(404).json({ message: 'That person is not on the record.' });
  if (String(existing._id) === String(req.user._id)) {
    return res.status(400).json({ message: 'You cannot delete your own profile.' });
  }
  const orders = await MealOrder.find({ userId: existing._id }).select('orderDate');
  const dates = [...new Set(orders.map((order) => order.orderDate))];
  await MealOrder.deleteMany({ userId: existing._id });
  for (const date of dates) {
    const costs = await costsOn(date);
    for (const meal of costs) await recalculate(date, meal, req.user._id);
  }
  await Promise.all([
    Ledger.deleteMany({ userId: existing._id }),
    MoneyRequest.deleteMany({ userId: existing._id }),
    Complaint.deleteMany({ userId: existing._id }),
    UserImage.deleteMany({ userId: existing._id })
  ]);
  await User.deleteOne({ _id: existing._id });
  await logActivity(req.user._id, 'Deleted profile', `${existing.fullName} · ${existing.role}`);
  res.json({ message: `${existing.fullName} was deleted.` });
}));

router.post('/users/:id/status', requireRole('admin'), asyncRoute(async (req, res) => {
  const existing = await User.findById(asId(req.params.id));
  if (!existing) return res.status(404).json({ message: 'That person is not on the record.' });
  const requested = ['active', 'inactive'].includes(req.body.status) ? req.body.status : null;
  const status = requested || (existing.status === 'active' ? 'inactive' : 'active');
  if (existing.role === 'admin' && status !== 'active' && (await otherActiveAdmins(existing._id)) === 0) {
    return res.status(400).json({ message: 'Keep at least one active administrator.' });
  }
  const previous = existing.status;
  existing.status = status;
  await existing.save();
  const message = previous === 'pending' && status === 'active'
    ? `${existing.fullName} can sign in now.`
    : previous === 'pending'
      ? `${existing.fullName}'s signup request was declined.`
      : `${existing.fullName} is now ${status}.`;
  await logActivity(req.user._id, previous === 'pending' && status === 'active' ? 'Approved signup' : previous === 'pending' ? 'Declined signup' : status === 'active' ? 'Activated user' : 'Deactivated user', existing.fullName);
  res.json({ message });
}));

router.get('/settings', requireRole('admin'), asyncRoute(async (req, res) => {
  const settings = await getSettings();
  res.json({
    hallName: settings.hallName,
    orderWindowDays: settings.orderWindowDays,
    meals: MEALS.map((meal) => ({
      key: meal,
      label: MEAL_LABEL[meal],
      offsetDays: Number(settings[`${meal}LockOffsetDays`]) || 0,
      time: String(settings[`${meal}LockTime`]).slice(0, 5),
      phrase: `${formatTime(settings[`${meal}LockTime`])} on ${offsetPhrase(settings[`${meal}LockOffsetDays`])}`
    }))
  });
}));

router.post('/settings', requireRole('admin'), asyncRoute(async (req, res) => {
  const hallName = clean(req.body.hallName, 80) || 'Residential Hall';
  const windowDays = Math.min(14, Math.max(1, Number(req.body.orderWindowDays) || 7));
  const update = { hallName, orderWindowDays: windowDays };
  for (const meal of MEALS) {
    const block = req.body[meal] || {};
    const offset = Number(block.offsetDays);
    const time = String(block.time || '').slice(0, 5);
    if (!Number.isInteger(offset) || offset < 0 || offset > 3 || !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ message: `Check the ${MEAL_LABEL[meal].toLowerCase()} cutoff.` });
    }
    update[`${meal}LockOffsetDays`] = offset;
    update[`${meal}LockTime`] = time;
  }
  await Setting.findByIdAndUpdate('hall', update, { upsert: true });
  await logActivity(req.user._id, 'Changed lock times', hallName);
  res.json({ message: 'Lock times updated. Open meals follow the new cutoff now.' });
}));

router.get('/balances', requireRole('admin'), asyncRoute(async (req, res) => {
  const q = clean(req.query.q, 80).toLowerCase();
  const students = await User.find({ role: 'student', status: { $ne: 'pending' } }).sort({ balancePaisa: 1, fullName: 1 });
  const requests = await MoneyRequest.find({ status: 'pending' }).sort({ createdAt: 1 }).populate('userId', 'fullName studentCode roomNo');
  res.json({
    requests: requests.map(presentDeposit),
    students: students
      .filter((student) => !q || `${student.fullName} ${student.studentCode} ${student.roomNo}`.toLowerCase().includes(q))
      .map(presentUser)
  });
}));

router.post('/balances/requests/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const decision = req.body.decision === 'decline' ? 'declined' : req.body.decision === 'approve' ? 'approved' : null;
  if (!decision) return res.status(400).json({ message: 'Choose approve or decline.' });
  const id = asId(req.params.id);
  if (!id) return res.status(404).json({ message: 'That request is not on the record.' });
  const request = await MoneyRequest.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { status: decision, handledBy: req.user._id, handledAt: new Date() },
    { new: true }
  );
  if (!request) return res.status(400).json({ message: 'That request was already handled.' });
  if (decision === 'declined') {
    const student = await User.findById(request.userId).select('fullName');
    await logActivity(req.user._id, 'Declined add-money request', student ? student.fullName : 'Student');
    return res.json({ message: 'The add-money request was declined.' });
  }
  const student = await User.findOne({ _id: request.userId, role: 'student' });
  if (!student) {
    await MoneyRequest.updateOne({ _id: request._id }, { status: 'declined' });
    return res.status(400).json({ message: 'That student is no longer on the hall record.' });
  }
  try {
    await postBalance({
      userId: student._id,
      entryType: 'deposit',
      direction: 'credit',
      amountPaisa: request.amountPaisa,
      note: request.note ? `Add-money request · ${request.note}` : 'Add-money request',
      actorId: req.user._id
    });
  } catch (error) {
    await MoneyRequest.updateOne({ _id: request._id }, { status: 'pending', handledBy: null, handledAt: null });
    throw error;
  }
  await logActivity(req.user._id, 'Approved add-money request', `${student.fullName} · ${taka(request.amountPaisa / 100)}`);
  res.json({ message: `Added ${taka(request.amountPaisa / 100)} to ${student.fullName}.` });
}));

router.post('/balances', requireRole('admin'), asyncRoute(async (req, res) => {
  const userId = asId(req.body.userId);
  const kind = req.body.kind === 'deduct' ? 'deduct' : 'deposit';
  const money = parseMoney(req.body.amount);
  const note = clean(req.body.note, 255);
  const student = userId ? await User.findOne({ _id: userId, role: 'student' }) : null;
  if (!student || !money || money.error || money.paisa <= 0) {
    return res.status(400).json({ message: 'Choose a student and enter an amount above zero.' });
  }
  await postBalance({
    userId: student._id,
    entryType: kind === 'deduct' ? 'deduction' : 'deposit',
    direction: kind === 'deduct' ? 'debit' : 'credit',
    amountPaisa: money.paisa,
    note: note || (kind === 'deduct' ? 'Hall office deduction' : 'Hall office deposit'),
    actorId: req.user._id
  });
  await logActivity(req.user._id, kind === 'deduct' ? 'Deducted balance' : 'Recorded deposit', `${student.fullName} · ${taka(money.taka)}`);
  res.json({ message: `${kind === 'deduct' ? 'Deducted' : 'Deposited'} ${taka(money.taka)} for ${student.fullName}.` });
}));

router.get('/activity', requireRole('admin'), asyncRoute(async (req, res) => {
  const rows = await Activity.find().sort({ _id: -1 }).limit(200).populate('userId', 'fullName role');
  res.json({
    rows: rows.map((item) => ({
      action: item.action,
      details: item.details || '—',
      who: item.userId ? item.userId.fullName : 'System',
      role: item.userId ? item.userId.role : '',
      when: prettyStamp(item.createdAt)
    }))
  });
}));

function presentDeposit(row) {
  const person = row.userId && row.userId.fullName ? row.userId : null;
  return {
    id: String(row._id),
    amountLabel: taka(row.amountPaisa / 100),
    note: row.note || '',
    status: row.status,
    when: prettyStamp(row.createdAt),
    fullName: person ? person.fullName : '',
    studentCode: person ? (person.studentCode || '') : '',
    roomNo: person ? (person.roomNo || '') : ''
  };
}

function presentComplaint(row) {
  return {
    id: String(row._id),
    subject: row.subject,
    message: row.message,
    status: row.status,
    adminReply: row.adminReply || '',
    when: prettyStamp(row.createdAt)
  };
}

function presentNotice(row) {
  return {
    id: String(row._id),
    title: row.title,
    body: row.body,
    isActive: row.isActive,
    when: prettyStamp(row.createdAt)
  };
}

function readUser(body, isNew) {
  const money = parseMoney(body.balance || '0') || { paisa: 0 };
  return {
    fullName: clean(body.fullName, 120),
    email: clean(body.email, 160).toLowerCase(),
    role: ['student', 'staff', 'admin'].includes(body.role) ? body.role : 'student',
    studentCode: clean(body.studentCode, 40),
    roomNo: clean(body.roomNo, 40),
    phone: clean(body.phone, 30),
    status: ['active', 'inactive', 'pending'].includes(body.status) ? body.status : 'active',
    password: String(body.password || ''),
    balancePaisa: isNew && money && !money.error ? money.paisa : 0
  };
}

function validateUser(form, isNew) {
  if (form.fullName.length < 2) return 'Enter the person\'s name.';
  if (!isEmail(form.email)) return 'Enter a valid email.';
  if (form.studentCode.length < 2) return 'Enter an ID number.';
  if (!validPhone(form.phone)) return 'Enter an 11-digit mobile number.';
  if (isNew && form.password.length < 6) return 'Set a password of at least 6 characters.';
  if (!isNew && form.password && form.password.length < 6) return 'A replacement password needs at least 6 characters.';
  return null;
}

async function takenCode(code, exceptId) {
  const query = { studentCode: { $regex: `^${escapeRegex(code)}$`, $options: 'i' } };
  if (exceptId) query._id = { $ne: exceptId };
  return Boolean(await User.exists(query));
}

async function otherActiveAdmins(id) {
  return User.countDocuments({ role: 'admin', status: 'active', _id: { $ne: id } });
}

async function guardLastAdmin(existing, form) {
  const removing = existing.role === 'admin' && existing.status === 'active' && (form.role !== 'admin' || form.status !== 'active');
  if (removing && (await otherActiveAdmins(existing._id)) === 0) return 'Keep at least one active administrator.';
  return null;
}

module.exports = router;
