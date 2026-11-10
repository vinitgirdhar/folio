import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_TRADE_FILTERS,
  matchesTradeFilters,
  parseSavedTradeViews,
  tradeFilterError,
} from "../src/shared/trade-filters";
import type { Trade } from "../src/shared/types";

const trade: Trade = {
  id: "test",
  client: "CL-001",
  symbol: "INFY",
  side: "BUY",
  quantity: 3,
  pricePaise: 12345,
  timestamp: "2026-11-09T03:45:59.999Z",
};
test("advanced filters use exact client and inclusive paise boundaries", () => {
  assert.equal(matchesTradeFilters(trade, EMPTY_TRADE_FILTERS), true);
  assert.equal(
    matchesTradeFilters(trade, {
      ...EMPTY_TRADE_FILTERS,
      client: "CL-001",
      minNotional: "370.35",
      maxNotional: "370.35",
    }),
    true,
  );
  assert.equal(
    matchesTradeFilters(trade, { ...EMPTY_TRADE_FILTERS, client: "CL-00" }),
    false,
  );
  assert.equal(
    matchesTradeFilters(trade, {
      ...EMPTY_TRADE_FILTERS,
      maxNotional: "370.34",
    }),
    false,
  );
  assert.equal(
    matchesTradeFilters(trade, {
      ...EMPTY_TRADE_FILTERS,
      minNotional: "370.36",
    }),
    false,
  );
});
test("time filters convert UTC into IST and include the entire selected minute", () => {
  assert.equal(
    matchesTradeFilters(trade, {
      ...EMPTY_TRADE_FILTERS,
      fromTime: "09:15",
      toTime: "09:15",
    }),
    true,
  );
  assert.equal(
    matchesTradeFilters(trade, { ...EMPTY_TRADE_FILTERS, fromTime: "09:16" }),
    false,
  );
  assert.equal(
    matchesTradeFilters(trade, { ...EMPTY_TRADE_FILTERS, toTime: "09:14" }),
    false,
  );
  assert.equal(
    matchesTradeFilters(
      { ...trade, timestamp: "invalid" },
      { ...EMPTY_TRADE_FILTERS, fromTime: "09:15" },
    ),
    false,
  );
});
test("invalid ranges and unsupported values fail visibly instead of broadening results", () => {
  for (const value of [
    "-1",
    "1.001",
    "1e3",
    "Infinity",
    " ",
    "9007199254740992",
  ]) {
    const filters = { ...EMPTY_TRADE_FILTERS, minNotional: value };
    assert.ok(tradeFilterError(filters));
    assert.equal(matchesTradeFilters(trade, filters), false);
  }
  for (const filters of [
    { ...EMPTY_TRADE_FILTERS, minNotional: "2", maxNotional: "1" },
    { ...EMPTY_TRADE_FILTERS, fromTime: "24:00" },
    { ...EMPTY_TRADE_FILTERS, fromTime: "10:00", toTime: "09:00" },
  ])
    assert.ok(tradeFilterError(filters));
});
test("saved-view storage validates shape, ranges, side and symbol, and caps unique names", () => {
  const filters = {
    ...EMPTY_TRADE_FILTERS,
    query: "INFY",
    side: "BUY",
    symbol: "INFY",
  };
  const view = { name: " Morning buys ", filters };
  assert.deepEqual(parseSavedTradeViews(JSON.stringify([view])), [
    { ...view, name: "Morning buys" },
  ]);
  for (const raw of [null, "invalid", "{}", '[null,1,"bad"]'])
    assert.deepEqual(parseSavedTradeViews(raw), []);
  assert.deepEqual(
    parseSavedTradeViews(
      JSON.stringify([{ name: "Incomplete", filters: { query: "INFY" } }]),
    ),
    [],
  );
  assert.deepEqual(
    parseSavedTradeViews(
      JSON.stringify([
        { ...view, filters: { ...filters, side: "SHORT" } },
        { ...view, filters: { ...filters, symbol: "UNKNOWN" } },
        { ...view, filters: { ...filters, minNotional: "1.234" } },
      ]),
    ),
    [],
  );
  assert.equal(
    parseSavedTradeViews(
      JSON.stringify(
        Array.from({ length: 12 }, (_, i) => ({ name: `View ${i}`, filters })),
      ),
    ).length,
    10,
  );
  assert.equal(
    parseSavedTradeViews(
      JSON.stringify([view, { ...view, name: "morning buys" }]),
    ).length,
    1,
  );
  assert.deepEqual(
    parseSavedTradeViews(
      JSON.stringify([
        { ...view, filters: { ...filters, query: "x".repeat(201) } },
      ]),
    ),
    [],
  );
});
