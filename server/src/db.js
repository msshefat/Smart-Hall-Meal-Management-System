const path = require('path');
const mongoose = require('mongoose');
const { SETTING_DEFAULTS } = require('./time');
const { Setting, User } = require('./models');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function connectDb() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hall_meal';
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  const existing = await Setting.findById('hall');
  if (!existing) await Setting.create({ _id: 'hall', ...SETTING_DEFAULTS });
  await User.updateOne(
    { email: 'admin@buphall.edu', studentCode: { $in: ['', null] } },
    { $set: { studentCode: 'HALL-ADMIN' } }
  );
  await User.updateOne(
    { email: 'staff@buphall.edu', studentCode: { $in: ['', null] } },
    { $set: { studentCode: 'HALL-STAFF' } }
  );
}

async function getSettings() {
  const doc = await Setting.findById('hall').lean();
  return { ...SETTING_DEFAULTS, ...(doc || {}), hallName: (doc && doc.hallName) || SETTING_DEFAULTS.hallName };
}

module.exports = { connectDb, getSettings };
