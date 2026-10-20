function splitRate(totalTaka, count) {
  const paisa = Math.round(Number(totalTaka) * 100);
  const safeCount = Number(count) || 0;
  if (safeCount <= 0) {
    return { rate: (paisa / 100).toFixed(2), rounding: (paisa / 100).toFixed(2), ratePaisa: 0, roundingPaisa: paisa };
  }
  const ratePaisa = Math.floor(paisa / safeCount);
  const roundingPaisa = paisa - ratePaisa * safeCount;
  return {
    rate: (ratePaisa / 100).toFixed(2),
    rounding: (roundingPaisa / 100).toFixed(2),
    ratePaisa,
    roundingPaisa
  };
}

function taka(value) {
  const paisa = Math.round(Number(value || 0) * 100);
  const sign = paisa < 0 ? '-' : '';
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100).toLocaleString('en-IN');
  const rem = String(abs % 100).padStart(2, '0');
  return `${sign}৳${whole}.${rem}`;
}

function fromPaisa(paisa) {
  const n = Number(paisa) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

const CREDIT_FLOOR_PAISA = -50000;

function inDebt(balancePaisa) {
  return (Number(balancePaisa) || 0) < 0;
}

function orderingBlocked(balancePaisa) {
  return (Number(balancePaisa) || 0) < CREDIT_FLOOR_PAISA;
}

function parseMoney(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 1000000) return { error: true };
  const paisa = Math.round(n * 100);
  return { paisa, taka: (paisa / 100).toFixed(2) };
}

module.exports = { splitRate, taka, fromPaisa, parseMoney, CREDIT_FLOOR_PAISA, inDebt, orderingBlocked };
