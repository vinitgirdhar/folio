import type { Trade } from "./types";

export type TradeGroup = {
  key: string;
  count: number;
  quantity: number;
  turnoverPaise: number;
  vwapPaise: number;
};

export function sessionInsights(trades: Trade[]) {
  const symbols = new Map<string, TradeGroup>();
  const clients = new Map<string, TradeGroup>();
  let turnoverPaise = 0;
  let buyPaise = 0;
  let buyCount = 0;
  let quantity = 0;
  for (const trade of trades) {
    const notional = trade.quantity * trade.pricePaise;
    turnoverPaise += notional;
    quantity += trade.quantity;
    if (trade.side === "BUY") {
      buyPaise += notional;
      buyCount++;
    }
    for (const [groups, key] of [
      [symbols, trade.symbol],
      [clients, trade.client],
    ] as const) {
      const group = groups.get(key) ?? {
        key,
        count: 0,
        quantity: 0,
        turnoverPaise: 0,
        vwapPaise: 0,
      };
      group.count++;
      group.quantity += trade.quantity;
      group.turnoverPaise += notional;
      groups.set(key, group);
    }
  }
  const ranked = (groups: Map<string, TradeGroup>) =>
    Array.from(groups.values(), (group) => ({
      ...group,
      vwapPaise: group.quantity ? group.turnoverPaise / group.quantity : 0,
    })).sort(
      (a, b) => b.turnoverPaise - a.turnoverPaise || a.key.localeCompare(b.key),
    );
  return {
    count: trades.length,
    quantity,
    turnoverPaise,
    buyPaise,
    sellPaise: turnoverPaise - buyPaise,
    buyCount,
    sellCount: trades.length - buyCount,
    symbols: ranked(symbols),
    clients: ranked(clients),
  };
}
