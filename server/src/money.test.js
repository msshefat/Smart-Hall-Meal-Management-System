const assert = require('assert');
const { splitRate, taka, fromPaisa, orderingBlocked, inDebt } = require('./money');

assert.deepStrictEqual(
  { rate: splitRate(1000, 3).rate, rounding: splitRate(1000, 3).rounding },
  { rate: '333.33', rounding: '0.01' }
);
assert.strictEqual(splitRate(10, 4).rate, '2.50');
assert.strictEqual(splitRate(10, 4).rounding, '0.00');
assert.strictEqual(splitRate(1, 3).rate, '0.33');
assert.strictEqual(splitRate(1, 3).rounding, '0.01');
assert.strictEqual(splitRate(0, 5).rate, '0.00');
assert.strictEqual(splitRate(480, 0).rounding, '480.00');
assert.strictEqual(taka(333.33), '৳333.33');
assert.strictEqual(taka(-40), '-৳40.00');
assert.strictEqual(taka(12500), '৳12,500.00');
assert.strictEqual(fromPaisa(33333), '333.33');
assert.strictEqual(fromPaisa(-4000), '-40.00');
assert.strictEqual(inDebt(-1), true);
assert.strictEqual(inDebt(0), false);
assert.strictEqual(orderingBlocked(-50000), false);
assert.strictEqual(orderingBlocked(-50001), true);

console.log('money checks passed');
