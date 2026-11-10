import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionInsights } from "../src/shared/session-insights";
import type { Trade } from "../src/shared/types";

const trade = (id: string, values: Partial<Trade> = {}): Trade => ({
  id,
  client: "CL-1",
  symbol: "INFY",
  side: "BUY",
  quantity: 2,
  pricePaise: 10000,
  timestamp: "2026-11-09T04:00:00.000Z",
  ...values,
});

test("session insights use executed quantity for weighted prices and integer notionals", () => {
  const rows = [
    trade("1"),
    trade("2", { side: "SELL", quantity: 6, pricePaise: 20000 }),
    trade("3", {
      client: "CL-2",
      symbol: "TCS",
      quantity: 1,
      pricePaise: 60000,
    }),
  ];
  const result = sessionInsights(rows);
  assert.equal(result.turnoverPaise, 200000);
  assert.equal(result.quantity, 9);
  assert.equal(result.buyPaise, 80000);
  assert.equal(result.sellPaise, 120000);
  assert.equal(result.buyCount, 2);
  assert.equal(result.sellCount, 1);
  assert.equal(result.symbols[0].key, "INFY");
  assert.equal(result.symbols[0].vwapPaise, 17500);
  assert.equal(result.symbols[0].count, 2);
  assert.equal(result.clients[0].key, "CL-1");
  assert.equal(result.clients[0].turnoverPaise, 140000);
  assert.equal(rows[0].pricePaise, 10000);
});

test("empty views have no fabricated concentration or non-finite values", () => {
  assert.deepEqual(sessionInsights([]), {
    count: 0,
    quantity: 0,
    turnoverPaise: 0,
    buyPaise: 0,
    sellPaise: 0,
    buyCount: 0,
    sellCount: 0,
    symbols: [],
    clients: [],
  });
});

test("equal-turnover groups are ordered by their identifier independent of input order", () => {
  const a = trade("a", { client: "CL-A", symbol: "AAA" });
  const z = trade("z", { client: "CL-Z", symbol: "ZZZ" });
  assert.deepEqual(sessionInsights([a, z]), sessionInsights([z, a]));
  assert.deepEqual(
    sessionInsights([z, a]).symbols.map((group) => group.key),
    ["AAA", "ZZZ"],
  );
});
