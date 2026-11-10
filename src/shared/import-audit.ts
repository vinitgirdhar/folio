import type { Pull, Trade } from "./types";

export function completedImports(pulls: Pull[]) {
  return pulls
    .filter(
      (pull) =>
        pull.status === "completed" &&
        Number.isSafeInteger(pull.batch) &&
        pull.batch > 0,
    )
    .sort((a, b) => b.batch - a.batch);
}

export function summarizeImport(trades: Trade[], pull: Pull) {
  // shortcut: the mock identifies batches in trade IDs; use stored provenance for a real exchange.
  const prefix = `BSE-${String(pull.batch).padStart(4, "0")}-`;
  const records =
    pull.status === "completed" &&
    Number.isSafeInteger(pull.batch) &&
    pull.batch > 0
      ? trades.filter((trade) => trade.id.startsWith(prefix))
      : [];
  const unique = new Set(records.map((trade) => trade.id)).size;
  let grossPaise = 0,
    quantity = 0,
    buys = 0;
  let first: string | null = null,
    last: string | null = null;
  for (const trade of records) {
    grossPaise += trade.pricePaise * trade.quantity;
    quantity += trade.quantity;
    if (trade.side === "BUY") buys++;
    if (first === null || trade.timestamp < first) first = trade.timestamp;
    if (last === null || trade.timestamp > last) last = trade.timestamp;
  }
  return {
    records,
    received: records.length,
    unique,
    duplicates: records.length - unique,
    grossPaise,
    quantity,
    buys,
    sells: records.length - buys,
    first,
    last,
    reconciled:
      pull.status === "completed" &&
      pull.inserted > 0 &&
      records.length === pull.inserted &&
      unique === records.length,
  };
}
