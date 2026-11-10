import type { Trade } from "./types";

export function sessionBounds(trades: Trade[]) {
  let start = Infinity,
    end = -Infinity;
  for (const trade of trades) {
    const timestamp = Date.parse(trade.timestamp);
    start = Math.min(start, timestamp);
    end = Math.max(end, timestamp);
  }
  return trades.length ? { start, end } : { start: 0, end: 0 };
}

export function tradesThrough(trades: Trade[], at: number) {
  return trades.filter((trade) => Date.parse(trade.timestamp) <= at);
}
