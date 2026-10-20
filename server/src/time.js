const MEALS = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

const SETTING_DEFAULTS = {
  hallName: 'BUP Residential Hall',
  breakfastLockOffsetDays: 1,
  breakfastLockTime: '21:00',
  lunchLockOffsetDays: 0,
  lunchLockTime: '09:30',
  dinnerLockOffsetDays: 0,
  dinnerLockTime: '15:00',
  orderWindowDays: 7
};

function todayDhaka(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days)));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function prettyDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(utc);
}

function weekday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long' }).format(utc);
}

function formatTime(value) {
  const [hh, mm] = String(value).slice(0, 5).split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h = hh % 12 || 12;
  return `${h}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function prettyStamp(stamp) {
  if (!stamp) return '';
  const date = stamp instanceof Date ? stamp : new Date(stamp);
  if (Number.isNaN(date.getTime())) return '';
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
  return text.replace(/\b(am|pm)\b/gi, (mark) => mark.toUpperCase());
}

function hallNowLabel(now = new Date()) {
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(now);
  return text.replace(/\b(am|pm)\b/gi, (mark) => mark.toUpperCase());
}

function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric',
    hourCycle: 'h23'
  }).format(now));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function offsetPhrase(days) {
  const n = Number(days) || 0;
  if (n === 0) return 'the same day';
  if (n === 1) return 'the previous day';
  return `${n} days before`;
}

function weekBounds(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const weekdayIndex = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const mondayOffset = weekdayIndex === 0 ? -6 : 1 - weekdayIndex;
  const start = addDays(iso, mondayOffset);
  return { start, end: addDays(start, 6) };
}

function monthBounds(iso) {
  const [y, m] = iso.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  const label = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric'
  }).format(new Date(Date.UTC(y, m - 1, 1, 12)));
  return { start, end, label };
}

function eachDate(start, end) {
  const dates = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 2024 || y > 2035) return null;
  return value;
}

function lockInstant(mealDate, offsetDays, timeHHMM) {
  const [y, m, d] = String(mealDate).slice(0, 10).split('-').map(Number);
  const [hh, mm] = String(timeHHMM).slice(0, 5).split(':').map(Number);
  const offset = Number(offsetDays) || 0;
  return new Date(Date.UTC(y, m - 1, d - offset, hh - 6, mm, 0));
}

function describeLock(mealDate, mealType, settings, now = new Date()) {
  const offset = settings[`${mealType}LockOffsetDays`];
  const time = settings[`${mealType}LockTime`];
  const at = lockInstant(mealDate, offset, time);
  const open = now.getTime() < at.getTime();
  const when = prettyStamp(at);
  return {
    open,
    when,
    label: open ? `Open until ${when}` : `Closed since ${when}`
  };
}

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 11 && digits.length <= 14;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  MEALS,
  MEAL_LABEL,
  SETTING_DEFAULTS,
  todayDhaka,
  addDays,
  prettyDate,
  weekday,
  formatTime,
  prettyStamp,
  hallNowLabel,
  greeting,
  offsetPhrase,
  weekBounds,
  monthBounds,
  eachDate,
  validDate,
  lockInstant,
  describeLock,
  clean,
  isEmail,
  validPhone,
  escapeRegex
};
