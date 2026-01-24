# Fix Notes

## What the Bug Was

The `calculateSubtotal` function was using `parseInt()` to convert price strings to numbers. This caused decimal prices to be truncated:

- `19.99` became `19`
- `5.5` became `5`

This resulted in incorrect subtotal calculations (19 + 5 + 5 = 29 instead of 19.99 + 5.5 + 5.5 = 30.99).

## Root Cause

**Root cause:** Using `parseInt()` instead of `parseFloat()` for decimal number parsing.

`parseInt()` only parses the integer portion of a number and ignores everything after the decimal point. For currency calculations that require precision, this causes data loss.

## How It Was Fixed

Changed line 3 in `src/pricing.js`:

```javascript
// Before (WRONG):
return sum + parseInt(item.price, 10) * item.quantity;

// After (CORRECT):
return sum + parseFloat(item.price) * item.quantity;
```

`parseFloat()` correctly parses decimal numbers, preserving the fractional part.

## How to Verify the Fix

1. Run the tests:

   ```bash
   npm test
   ```

2. Expected output:

   ```
   All tests passed
   ```

3. Manual verification:

   ```javascript
   const items = [
     { price: 19.99, quantity: 1 },
     { price: 5.5, quantity: 2 },
   ];

   calculateSubtotal(items);
   // Expected: 30.99 (19.99 + 5.5 + 5.5)
   // Not: 29 (19 + 5 + 5)
   ```

## How to Prevent Similar Bugs in the Future

1. **Type Safety:** Use TypeScript to enforce number types and catch type coercion issues at compile time.

2. **Unit Tests:** Add more test cases covering edge cases:

   ```javascript
   // Test with various decimal prices
   { price: 0.99, quantity: 1 }   // Small decimals
   { price: 100.50, quantity: 3 }  // Larger decimals
   { price: 7.5, quantity: 2 }     // Single decimal place
   ```

3. **Linting Rules:** Use ESLint rules to warn about parseInt usage:

   ```json
   {
     "rules": {
       "radix": ["error", "always"],
       "no-restricted-syntax": [
         "error",
         {
           "selector": "CallExpression[callee.name='parseInt'][arguments.length=1]",
           "message": "Use parseFloat for decimal numbers or specify radix for parseInt"
         }
       ]
     }
   }
   ```

4. **Code Reviews:** Always review calculations involving money/decimals carefully.

5. **Explicit Typing:** Add JSDoc comments to clarify expected types:

   ```javascript
   /**
    * @param {Array<{price: number, quantity: number}>} items
    * @returns {number} Total price with decimals
    */
   function calculateSubtotal(items) { ... }
   ```

6. **Use Decimal Libraries:** For production financial calculations, consider libraries like:
   - `decimal.js` - Arbitrary-precision decimal arithmetic
   - `big.js` - Small, fast library for arbitrary-precision decimal arithmetic
   - `dinero.js` - Library for working with monetary values

These libraries avoid floating-point precision issues entirely.
