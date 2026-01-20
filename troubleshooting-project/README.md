# Troubleshooting Project

This small Node.js project contains an intentional bug.

## Goal
- Run tests with `npm test`
- Identify the failing behavior
- Fix the bug
- Summarize the root cause and fix in `fix-notes.md`

## Structure
- `src/pricing.js` core logic
- `tests/run.js` minimal test runner

## Expected behavior
- Prices can be decimal values
- Totals should be rounded to 2 decimals
