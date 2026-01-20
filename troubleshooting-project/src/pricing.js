function calculateSubtotal(items) {
  return items.reduce((sum, item) => {
    return sum + parseInt(item.price, 10) * item.quantity;
  }, 0);
}

function calculateTotal(items, options = {}) {
  const subtotal = calculateSubtotal(items);
  const discountRate = options.discount || 0;
  const taxRate = options.taxRate || 0;

  const discountAmount = subtotal * (discountRate / 100);
  const taxed = (subtotal - discountAmount) * (1 + taxRate);

  return Math.round(taxed * 100) / 100;
}

module.exports = {
  calculateSubtotal,
  calculateTotal
};
