import { SYMBOLS, type Trade } from "../shared/types";

export const BATCH_SIZE = 5000;
export const PAGE_SIZE = 100;
export const TOTAL_PAGES = BATCH_SIZE / PAGE_SIZE;

// Stable IDs and a seeded PRNG make retries and crash recovery deterministic.
export function generateTrades(
  batch: number,
  start = 0,
  count = BATCH_SIZE,
): Trade[] {
  return Array.from({ length: count }, (_, offset) => {
    const i = start + offset;
    let state = (batch * 100003 + i * 7919 + 42) >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const asset = SYMBOLS[i % SYMBOLS.length];
    const time =
      Date.UTC(2026, 10, 9, 3, 45) + (i / BATCH_SIZE) * 22500000 + batch * 1000;
    const trend = (i / BATCH_SIZE) * 0.018;
    return {
      id: `BSE-${batch.toString().padStart(4, "0")}-${i.toString().padStart(6, "0")}`,
      client: `CL-${String(1000 + Math.floor(random() * 120)).padStart(5, "0")}`,
      symbol: asset.symbol,
      side: random() > 0.43 ? "BUY" : "SELL",
      quantity: (1 + Math.floor(random() * 40)) * 5,
      pricePaise: Math.round(
        asset.price * (1 + trend + (random() - 0.5) * 0.012),
      ),
      timestamp: new Date(time).toISOString(),
    };
  });
}

export function integer(
  value: unknown,
  min: number,
  max: number,
  name: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function validatePage(
  value: unknown,
  batch: number,
  page: number,
): Trade[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("trades" in value) ||
    !Array.isArray(value.trades) ||
    value.trades.length !== PAGE_SIZE
  )
    throw new Error("Invalid upstream page.");
  const ids = new Set<string>();
  return value.trades.map((trade: unknown, index: number) => {
    if (!trade || typeof trade !== "object")
      throw new Error("Invalid upstream trade.");
    const t = trade as Trade;
    const expected = `BSE-${batch.toString().padStart(4, "0")}-${(page * PAGE_SIZE + index).toString().padStart(6, "0")}`;
    if (
      t.id !== expected ||
      ids.has(t.id) ||
      !/^CL-\d{5}$/.test(t.client) ||
      !SYMBOLS.some((s) => s.symbol === t.symbol) ||
      !["BUY", "SELL"].includes(t.side) ||
      !Number.isSafeInteger(t.quantity) ||
      t.quantity <= 0 ||
      !Number.isSafeInteger(t.pricePaise) ||
      t.pricePaise <= 0 ||
      !Number.isFinite(Date.parse(t.timestamp))
    )
      throw new Error("Invalid upstream trade.");
    ids.add(t.id);
    return t;
  });
}
