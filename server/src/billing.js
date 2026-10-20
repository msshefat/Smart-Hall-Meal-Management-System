const crypto = require('crypto');
const mongoose = require('mongoose');
const { User, MealOrder, BazarCost, MealRate, Ledger, Lock } = require('./models');
const { splitRate } = require('./money');
const { MEALS, MEAL_LABEL, prettyDate } = require('./time');

function assertMeal(meal) {
  if (!MEALS.includes(meal)) {
    const error = new Error('Unknown meal');
    error.status = 400;
    throw error;
  }
  return meal;
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function opts(session) {
  return session ? { session } : {};
}

async function acquireLock(key) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const now = new Date();
    try {
      await Lock.create({ _id: key, expiresAt: new Date(Date.now() + 20000) });
      return;
    } catch (error) {
      if (error.code !== 11000) throw error;
      const freed = await Lock.deleteOne({ _id: key, expiresAt: { $lt: now } });
      if (!freed.deletedCount) await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }
  const error = new Error('Another hall update is still finishing. Try again.');
  error.status = 409;
  throw error;
}

async function releaseLock(key) {
  await Lock.deleteOne({ _id: key });
}

async function transaction(work) {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (error) {
    if (session) await session.endSession();
    return work(null);
  }
  try {
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    const message = String(error.message || '');
    if (error.code === 20 || /replica set|Transaction numbers/i.test(message)) {
      return work(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

async function refreshBalances(session, userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return;
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const rows = await withSession(Ledger.aggregate([
    { $match: { userId: { $in: objectIds } } },
    {
      $group: {
        _id: '$userId',
        bal: {
          $sum: {
            $cond: [{ $eq: ['$direction', 'credit'] }, '$amountPaisa', { $multiply: ['$amountPaisa', -1] }]
          }
        }
      }
    }
  ]), session);
  const map = new Map(rows.map((row) => [String(row._id), row.bal]));
  for (const id of objectIds) {
    await User.updateOne({ _id: id }, { $set: { balancePaisa: map.get(String(id)) || 0 } }, opts(session));
  }
}

async function recalculate(date, mealType, actorId) {
  const meal = assertMeal(mealType);
  const key = `meal_${date}_${meal}`;
  await acquireLock(key);
  try {
    return await transaction(async (session) => {
      const cost = await withSession(BazarCost.findOne({ costDate: date, mealType: meal }), session);
      const orders = await withSession(MealOrder.find({ orderDate: date, [meal]: true }).sort({ userId: 1 }), session);
      const studentIds = orders.map((order) => order.userId);
      const students = await withSession(
        User.find({ _id: { $in: studentIds }, role: 'student' }).select('_id'),
        session
      );
      const allowed = new Set(students.map((student) => String(student._id)));
      const activeOrders = orders.filter((order) => allowed.has(String(order.userId)));
      const charges = await withSession(Ledger.find({
        mealDate: date,
        mealType: meal,
        entryType: 'meal_charge',
        reversed: { $ne: true }
      }), session);

      const batch = crypto.randomUUID();
      const affected = new Set();
      if (charges.length) {
        await Ledger.insertMany(charges.map((charge) => ({
          userId: charge.userId,
          entryType: 'charge_reversal',
          direction: 'credit',
          amountPaisa: charge.amountPaisa,
          mealDate: date,
          mealType: meal,
          note: `Reversal · ${MEAL_LABEL[meal]} · ${prettyDate(date)}`,
          batchId: batch,
          reversesId: charge._id,
          createdBy: actorId || null
        })), opts(session));
        await Ledger.updateMany(
          { _id: { $in: charges.map((charge) => charge._id) } },
          { $set: { reversed: true } },
          opts(session)
        );
        charges.forEach((charge) => affected.add(String(charge.userId)));
      }

      const totalPaisa = cost ? cost.amountPaisa : 0;
      const count = activeOrders.length;
      const split = splitRate(totalPaisa / 100, count);
      const ratePaisa = count > 0 && cost ? split.ratePaisa : 0;
      const roundingPaisa = count > 0 && cost ? split.roundingPaisa : totalPaisa;

      if (cost && count > 0 && ratePaisa > 0) {
        await Ledger.insertMany(activeOrders.map((order) => {
          affected.add(String(order.userId));
          return {
            userId: order.userId,
            entryType: 'meal_charge',
            direction: 'debit',
            amountPaisa: ratePaisa,
            mealDate: date,
            mealType: meal,
            note: `${MEAL_LABEL[meal]} · ${prettyDate(date)}`,
            batchId: batch,
            createdBy: actorId || null
          };
        }), opts(session));
      }

      await MealRate.findOneAndUpdate(
        { rateDate: date, mealType: meal },
        { totalPaisa, totalOrders: count, ratePaisa, roundingPaisa, calculatedAt: new Date() },
        { upsert: true, ...opts(session) }
      );
      await refreshBalances(session, [...affected]);
      return {
        meal,
        total: cost ? (totalPaisa / 100).toFixed(2) : null,
        count,
        rate: (ratePaisa / 100).toFixed(2),
        rounding: (roundingPaisa / 100).toFixed(2),
        charged: Boolean(cost && count > 0 && ratePaisa > 0)
      };
    });
  } finally {
    await releaseLock(key);
  }
}

async function postBalance({ userId, entryType, direction, amountPaisa, note, actorId, createdAt }) {
  await transaction(async (session) => {
    await Ledger.create([{
      userId,
      entryType,
      direction,
      amountPaisa,
      note,
      createdBy: actorId || null,
      createdAt: createdAt || new Date()
    }], opts(session));
    await refreshBalances(session, [userId]);
  });
}

async function saveMealFlags({ userId, date, breakfast, lunch, dinner, actorId }) {
  await MealOrder.findOneAndUpdate(
    { userId, orderDate: date },
    { breakfast: Boolean(breakfast), lunch: Boolean(lunch), dinner: Boolean(dinner), updatedBy: actorId || null },
    { upsert: true }
  );
}

async function costsOn(date) {
  const rows = await BazarCost.find({ costDate: date }).select('mealType');
  return new Set(rows.map((row) => row.mealType));
}

async function logActivity(userId, action, details) {
  const { Activity } = require('./models');
  await Activity.create({
    userId: userId || null,
    action,
    details: details ? String(details).slice(0, 500) : ''
  });
}

module.exports = {
  assertMeal,
  recalculate,
  postBalance,
  saveMealFlags,
  costsOn,
  refreshBalances,
  logActivity
};
