const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'staff', 'admin'], required: true },
  studentCode: { type: String, default: '' },
  roomNo: { type: String, default: '' },
  phone: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
  balancePaisa: { type: Number, default: 0 },
  hasPhoto: { type: Boolean, default: false },
  hasIdCard: { type: Boolean, default: false }
}, { timestamps: true });

const userImageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['photo', 'idCard'], required: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
  bytes: { type: Number, required: true }
}, { timestamps: true });
userImageSchema.index({ userId: 1, kind: 1 }, { unique: true });

const settingSchema = new mongoose.Schema({
  _id: { type: String, default: 'hall' },
  hallName: String,
  breakfastLockOffsetDays: Number,
  breakfastLockTime: String,
  lunchLockOffsetDays: Number,
  lunchLockTime: String,
  dinnerLockOffsetDays: Number,
  dinnerLockTime: String,
  orderWindowDays: Number
}, { versionKey: false });

const menuSchema = new mongoose.Schema({
  menuDate: { type: String, required: true },
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner'], required: true },
  items: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
menuSchema.index({ menuDate: 1, mealType: 1 }, { unique: true });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderDate: { type: String, required: true },
  breakfast: { type: Boolean, default: false },
  lunch: { type: Boolean, default: false },
  dinner: { type: Boolean, default: false },
  breakfastTaken: { type: Boolean, default: false },
  lunchTaken: { type: Boolean, default: false },
  dinnerTaken: { type: Boolean, default: false },
  breakfastTakenAt: Date,
  lunchTakenAt: Date,
  dinnerTakenAt: Date,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
orderSchema.index({ userId: 1, orderDate: 1 }, { unique: true });

const costSchema = new mongoose.Schema({
  costDate: { type: String, required: true },
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner'], required: true },
  amountPaisa: { type: Number, required: true },
  note: { type: String, default: '' },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
costSchema.index({ costDate: 1, mealType: 1 }, { unique: true });

const rateSchema = new mongoose.Schema({
  rateDate: { type: String, required: true },
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner'], required: true },
  totalPaisa: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  ratePaisa: { type: Number, default: 0 },
  roundingPaisa: { type: Number, default: 0 },
  calculatedAt: { type: Date, default: Date.now }
}, { versionKey: false });
rateSchema.index({ rateDate: 1, mealType: 1 }, { unique: true });

const ledgerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  entryType: { type: String, enum: ['meal_charge', 'charge_reversal', 'deposit', 'deduction'], required: true },
  direction: { type: String, enum: ['debit', 'credit'], required: true },
  amountPaisa: { type: Number, required: true },
  mealDate: String,
  mealType: String,
  note: String,
  batchId: String,
  reversesId: { type: mongoose.Schema.Types.ObjectId },
  reversed: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

const complaintSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['open', 'in_review', 'resolved', 'closed'], default: 'open' },
  adminReply: { type: String, default: '' },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const moneyRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amountPaisa: { type: Number, required: true },
  note: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  handledAt: Date
}, { timestamps: true });

const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  details: { type: String, default: '' }
}, { timestamps: { createdAt: true, updatedAt: false } });

const lockSchema = new mongoose.Schema({
  _id: String,
  expiresAt: Date
}, { versionKey: false });

module.exports = {
  User: mongoose.model('User', userSchema),
  UserImage: mongoose.model('UserImage', userImageSchema),
  Setting: mongoose.model('Setting', settingSchema),
  Menu: mongoose.model('Menu', menuSchema),
  MealOrder: mongoose.model('MealOrder', orderSchema),
  BazarCost: mongoose.model('BazarCost', costSchema),
  MealRate: mongoose.model('MealRate', rateSchema),
  Ledger: mongoose.model('Ledger', ledgerSchema),
  Complaint: mongoose.model('Complaint', complaintSchema),
  Announcement: mongoose.model('Announcement', announcementSchema),
  MoneyRequest: mongoose.model('MoneyRequest', moneyRequestSchema),
  Activity: mongoose.model('Activity', activitySchema),
  Lock: mongoose.model('Lock', lockSchema)
};
