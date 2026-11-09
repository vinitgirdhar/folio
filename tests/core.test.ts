import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTrades, integer, validatePage, TOTAL_PAGES, PAGE_SIZE } from "../src/server/mock";

test("the seed is deterministic, realistic in shape and contains 5,000 unique trades", () => {
  const trades = generateTrades(0);
  assert.equal(trades.length, 5000);
  assert.deepEqual(trades, generateTrades(0));
  assert.equal(new Set(trades.map((t) => t.id)).size, 5000);
  assert.equal(new Set(trades.map((t) => t.client)).size, 120);
  assert.equal(new Set(trades.map((t) => t.symbol)).size, 6);
  assert.ok(
    trades.every(
      (t) =>
        Number.isSafeInteger(t.pricePaise) &&
        t.pricePaise > 0 &&
        t.quantity > 0,
    ),
  );
});

test("all data pages reconstruct exactly the complete slow endpoint", () => {
  const pages = Array.from({ length: TOTAL_PAGES }, (_, page) =>
    generateTrades(3, page * PAGE_SIZE, PAGE_SIZE),
  ).flat();
  assert.deepEqual(pages, generateTrades(3));
  assert.ok(900000 / TOTAL_PAGES < 25000);
});

test("query and body boundaries reject fractional, negative, excessive and nonnumeric values", () => {
  for (const value of [-1, 900001, NaN, 1.5, "12000", null])
    assert.throws(() => integer(value, 0, 900000, "delayMs"));
  assert.equal(integer(900000, 0, 900000, "delayMs"), 900000);
});

test("upstream validation rejects corrupt rows and wrong IDs before staging", () => {
  const trades = generateTrades(1, 0, PAGE_SIZE);
  assert.deepEqual(validatePage({ trades }, 1, 0), trades);
  assert.throws(() => validatePage({ trades: [] }, 1, 0));
  assert.throws(() =>
    validatePage(
      { trades: [{ ...trades[0], pricePaise: -1 }, ...trades.slice(1)] },
      1,
      0,
    ),
  );
  assert.throws(() => validatePage({ trades }, 2, 0));
});
