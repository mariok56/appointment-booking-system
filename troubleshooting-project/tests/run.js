const assert = require('assert');
const { calculateSubtotal, calculateTotal } = require('../src/pricing');

const items = [
  { price: 19.99, quantity: 1 },
  { price: 5.5, quantity: 2 }
];

const subtotal = calculateSubtotal(items);
assert.strictEqual(subtotal, 30.99, 'subtotal should include decimal prices');

const total = calculateTotal(items, { taxRate: 0.1, discount: 10 });
assert.strictEqual(total, 30.68, 'total should apply discount and tax');

console.log('All tests passed');
