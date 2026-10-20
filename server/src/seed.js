const bcrypt = require('bcryptjs');
const { connectDb } = require('./db');
const {
  User, UserImage, Menu, Complaint, Announcement, Activity, MealOrder, BazarCost, MealRate, Ledger, MoneyRequest
} = require('./models');
const { postBalance, saveMealFlags, recalculate } = require('./billing');
const { todayDhaka, addDays } = require('./time');

const PASSWORD = {
  admin: 'Admin@123',
  staff: 'Staff@123',
  student: 'Student@123'
};

const MENUS = [
  ['Paratha, omelette, tea', 'Rice, chicken curry, dal, salad', 'Khichuri, fried egg, pickle'],
  ['Ruti, vegetable bhaji, banana', 'Rice, rui fish, mash dal', 'Rice, mixed vegetables, lentil'],
  ['Bread, boiled egg, tea', 'Rice, egg curry, spinach', 'Polao, chicken roast, salad'],
  ['Suji, bread, banana', 'Rice, beef curry, dal', 'Rice, fish fry, dal'],
  ['Paratha, dal, tea', 'Rice, chicken, seasonal vegetable', 'Khichuri, omelette'],
  ['Ruti, egg, tea', 'Rice, fish curry, salad', 'Rice, lentil, begun bhaji'],
  ['Noodles, boiled egg, tea', 'Rice, chicken roast, dal', 'Fried rice, egg, salad']
];

const COSTS = [
  [110000, 360000, 280000],
  [98000, 410000, 300000],
  [125000, 390000, 260000],
  [105000, 440000, 320000]
];

function mealFlags(studentIndex, dayOffset) {
  return {
    breakfast: !(studentIndex === 2 || (studentIndex === 5 && dayOffset % 2 === 0)),
    lunch: !(studentIndex === 6 && dayOffset % 3 === 0),
    dinner: studentIndex !== 4
  };
}

function atDhaka(iso, time) {
  return new Date(`${iso}T${time}+06:00`);
}

async function clearDemo() {
  await Promise.all([
    Activity.deleteMany({}),
    MoneyRequest.deleteMany({}),
    Complaint.deleteMany({}),
    Announcement.deleteMany({}),
    Ledger.deleteMany({}),
    MealRate.deleteMany({}),
    BazarCost.deleteMany({}),
    MealOrder.deleteMany({}),
    Menu.deleteMany({}),
    UserImage.deleteMany({}),
    User.deleteMany({})
  ]);
}

async function main() {
  await connectDb();
  const force = process.argv.includes('--force');
  const existing = await User.countDocuments();
  if (existing > 0 && !force) {
    console.log('Demo data is already loaded. Run npm run seed -- --force to replace it.');
    process.exit(0);
  }
  if (force) await clearDemo();

  const adminHash = await bcrypt.hash(PASSWORD.admin, 10);
  const staffHash = await bcrypt.hash(PASSWORD.staff, 10);
  const studentHash = await bcrypt.hash(PASSWORD.student, 10);

  const admin = await User.create({
    fullName: 'Farzana Haque',
    email: 'admin@buphall.edu',
    passwordHash: adminHash,
    role: 'admin',
    studentCode: 'HALL-ADMIN',
    phone: '01711000001'
  });
  const staff = await User.create({
    fullName: 'Jahidul Islam',
    email: 'staff@buphall.edu',
    passwordHash: staffHash,
    role: 'staff',
    studentCode: 'HALL-STAFF',
    phone: '01711000002'
  });

  const students = [
    ['Ayesha Siddiqua', 'ayesha@buphall.edu', '24549010021', 'A-201', '01712000021', 500000, 'active'],
    ['Rafid Hasan', 'rafid@buphall.edu', '24549010034', 'A-204', '01712000034', 500000, 'active'],
    ['Mitu Akter', 'mitu@buphall.edu', '24549010048', 'B-112', '01712000048', 220000, 'active'],
    ['Tanvir Ahmed', 'tanvir@buphall.edu', '24549010056', 'B-118', '01712000056', 500000, 'active'],
    ['Nusrat Jahan', 'nusrat@buphall.edu', '24549010063', 'C-305', '01712000063', 450000, 'active'],
    ['Sabbir Hossain', 'sabbir@buphall.edu', '24549010071', 'C-310', '01712000071', 500000, 'active'],
    ['Farhana Islam', 'farhana@buphall.edu', '24549010088', 'D-014', '01712000088', 480000, 'active'],
    ['Imran Kabir', 'imran@buphall.edu', '24549010092', 'D-019', '01712000092', 150000, 'active'],
    ['Mehedi Hasan', 'mehedi@buphall.edu', '24549010105', 'A-110', '01712000105', 0, 'inactive']
  ];

  const today = todayDhaka();
  const created = [];
  for (const [fullName, email, studentCode, roomNo, phone, deposit, status] of students) {
    const user = await User.create({
      fullName, email, studentCode, roomNo, phone, status,
      passwordHash: studentHash,
      role: 'student'
    });
    created.push({ user, deposit, status });
  }

  for (const student of created) {
    if (student.deposit > 0) {
      await postBalance({
        userId: student.user._id,
        entryType: 'deposit',
        direction: 'credit',
        amountPaisa: student.deposit,
        note: 'Hall office deposit',
        actorId: admin._id,
        createdAt: atDhaka(addDays(today, -6), '10:00:00')
      });
    }
  }

  const active = created.filter((student) => student.status === 'active');
  for (let offset = -4; offset <= 6; offset += 1) {
    const date = addDays(today, offset);
    const menu = MENUS[(offset + 28) % MENUS.length];
    for (const [index, meal] of ['breakfast', 'lunch', 'dinner'].entries()) {
      await Menu.create({ menuDate: date, mealType: meal, items: menu[index], updatedBy: admin._id });
    }
    for (let s = 0; s < active.length; s += 1) {
      const flags = mealFlags(s, offset);
      await saveMealFlags({
        userId: active[s].user._id,
        date,
        ...flags,
        actorId: offset < 0 ? staff._id : active[s].user._id
      });
    }
    if (offset < 0) {
      const cost = COSTS[(offset + 4) % COSTS.length];
      for (const [index, meal] of ['breakfast', 'lunch', 'dinner'].entries()) {
        await BazarCost.create({
          costDate: date,
          mealType: meal,
          amountPaisa: cost[index],
          note: 'Mess bazar',
          enteredBy: staff._id
        });
        await recalculate(date, meal, staff._id);
      }
    }
  }

  const [ayesha, rafid, mitu] = active;
  await Complaint.create([
    {
      userId: ayesha.user._id,
      subject: 'Cold rice at dinner',
      message: 'Dinner rice was cold on the last two nights. Could the kitchen check the serving time?',
      status: 'open',
      createdAt: atDhaka(addDays(today, -1), '21:10:00')
    },
    {
      userId: rafid.user._id,
      subject: 'More vegetables at lunch',
      message: 'Lunch has been mostly dal and rice. A vegetable dish most days would help.',
      status: 'in_review',
      createdAt: atDhaka(addDays(today, -2), '13:05:00')
    },
    {
      userId: mitu.user._id,
      subject: 'Breakfast tea ran out',
      message: 'Tea finished before the end of the breakfast line on Sunday.',
      status: 'resolved',
      adminReply: 'Noted. Sunday breakfast will start a second tea flask from this week.',
      handledBy: admin._id,
      createdAt: atDhaka(addDays(today, -3), '08:40:00')
    }
  ]);

  await Announcement.create([
    {
      title: 'Lock times can move',
      body: 'Meal cutoffs are not permanent. If the kitchen or a hall program needs a different time, the office updates Lock times and the change applies immediately.',
      isActive: true,
      publishedBy: admin._id,
      createdAt: atDhaka(today, '08:10:00')
    },
    {
      title: 'Thursday dinner is early',
      body: 'This Thursday dinner will be served 30 minutes early because of the hall program. Place dinner off requests before the lock time shown on Order meals.',
      isActive: true,
      publishedBy: admin._id,
      createdAt: atDhaka(today, '07:20:00')
    }
  ]);

  console.log('Demo hall is ready.');
  console.log('Admin  admin@buphall.edu  Admin@123');
  console.log('Staff  staff@buphall.edu  Staff@123');
  console.log('Student ayesha@buphall.edu Student@123');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
