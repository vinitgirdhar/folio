import { test } from "node:test";
import assert from "node:assert/strict";
import { tradeContext } from "../src/shared/trade-details";
import type { Trade } from "../src/shared/types";

const trade: Trade = {
  id: "trade-1",
  client: "client-1",
  symbol: "INFY",
  side: "BUY",
  quantity: 1,
  pricePaise: 10000,
  timestamp: "2026-11-09T04:00:00.000Z",
};

test("trade context separates client turnover from symbol volume and weights prices by quantity", () => {
  const trades: Trade[] = [
    trade,
    {
      ...trade,
      id: "trade-2",
      client: "client-2",
      quantity: 9,
      pricePaise: 20000,
    },
    { ...trade, id: "trade-3", symbol: "TCS", quantity: 2, pricePaise: 50000 },
  ];
  assert.deepEqual(tradeContext(trade, trades), {
    clientCount: 2,
    clientTurnoverPaise: 110000,
    symbolQuantity: 10,
    symbolVwapPaise: 19000,
  });
  assert.equal(trades.length, 3);
  assert.equal(trade.pricePaise, 10000);
});

test("an empty review scope has no invented VWAP or client activity", () => {
  assert.deepEqual(tradeContext(trade, []), {
    clientCount: 0,
    clientTurnoverPaise: 0,
    symbolQuantity: 0,
    symbolVwapPaise: null,
  });
});

test("fractional paise in weighted averages remain unrounded until display", () => {
  const context = tradeContext(trade, [
    trade,
    { ...trade, id: "trade-2", quantity: 2, pricePaise: 10001 },
  ]);
  assert.equal(context.symbolVwapPaise, 30002 / 3);
});
