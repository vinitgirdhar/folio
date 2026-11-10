import type { Trade } from "./types";

export function tradeContext(trade: Trade, trades: Trade[]) {
  let clientCount = 0;
  let clientTurnoverPaise = 0;
  let symbolQuantity = 0;
  let symbolTurnoverPaise = 0;
  for (const row of trades) {
    const notional = row.quantity * row.pricePaise;
    if (row.client === trade.client) {
      clientCount++;
      clientTurnoverPaise += notional;
    }
    if (row.symbol === trade.symbol) {
      symbolQuantity += row.quantity;
      symbolTurnoverPaise += notional;
    }
  }
  return {
    clientCount,
    clientTurnoverPaise,
    symbolQuantity,
    symbolVwapPaise: symbolQuantity
      ? symbolTurnoverPaise / symbolQuantity
      : null,
  };
}
