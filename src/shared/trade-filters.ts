import { SYMBOLS, type Trade } from "./types";

export type TradeFilterState = {
  client: string;
  minNotional: string;
  maxNotional: string;
  fromTime: string;
  toTime: string;
};
export type TradeViewState = TradeFilterState & {
  query: string;
  symbol: string;
  side: string;
};
export type SavedTradeView = { name: string; filters: TradeViewState };
export const EMPTY_TRADE_FILTERS: TradeFilterState = {
  client: "",
  minNotional: "",
  maxNotional: "",
  fromTime: "",
  toTime: "",
};

function paise(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return NaN;
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : NaN;
}
function minute(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function tradeFilterError(filters: TradeFilterState): string {
  if (
    [filters.minNotional, filters.maxNotional].some(
      (value) => value !== "" && !Number.isFinite(paise(value)),
    )
  )
    return "Enter non-negative trade values with at most two decimal places.";
  if (
    filters.minNotional !== "" &&
    filters.maxNotional !== "" &&
    paise(filters.minNotional) > paise(filters.maxNotional)
  )
    return "Minimum trade value must not exceed the maximum.";
  if (
    [filters.fromTime, filters.toTime].some(
      (value) => value !== "" && !Number.isFinite(minute(value)),
    )
  )
    return "Enter valid session times in HH:mm format.";
  if (
    filters.fromTime &&
    filters.toTime &&
    minute(filters.fromTime) > minute(filters.toTime)
  )
    return "The start time must not be later than the end time.";
  return "";
}

export function matchesTradeFilters(trade: Trade, filters: TradeFilterState) {
  if (tradeFilterError(filters)) return false;
  if (filters.client && trade.client !== filters.client) return false;
  const notional = trade.pricePaise * trade.quantity;
  if (filters.minNotional && notional < paise(filters.minNotional))
    return false;
  if (filters.maxNotional && notional > paise(filters.maxNotional))
    return false;
  if (filters.fromTime || filters.toTime) {
    const date = new Date(trade.timestamp);
    const istMinute =
      (date.getUTCHours() * 60 + date.getUTCMinutes() + 330) % 1440;
    if (!Number.isFinite(istMinute)) return false;
    if (filters.fromTime && istMinute < minute(filters.fromTime)) return false;
    if (filters.toTime && istMinute > minute(filters.toTime)) return false;
  }
  return true;
}

export function parseSavedTradeViews(raw: string | null): SavedTradeView[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const names = new Set<string>();
    return parsed
      .filter((entry): entry is SavedTradeView => {
        if (
          !entry ||
          typeof entry !== "object" ||
          typeof entry.name !== "string"
        )
          return false;
        const name = entry.name.trim();
        const filters = entry.filters;
        if (
          !name ||
          name.length > 40 ||
          names.has(name.toLowerCase()) ||
          !filters ||
          typeof filters !== "object"
        )
          return false;
        if (
          ![
            "client",
            "minNotional",
            "maxNotional",
            "fromTime",
            "toTime",
            "query",
            "symbol",
            "side",
          ].every(
            (key) =>
              typeof filters[key] === "string" && filters[key].length <= 200,
          )
        )
          return false;
        if (tradeFilterError(filters)) return false;
        if (!["All sides", "BUY", "SELL"].includes(filters.side)) return false;
        if (
          filters.symbol !== "All symbols" &&
          !SYMBOLS.some((asset) => asset.symbol === filters.symbol)
        )
          return false;
        names.add(name.toLowerCase());
        return true;
      })
      .slice(0, 10)
      .map((entry) => ({
        name: entry.name.trim(),
        filters: { ...entry.filters },
      }));
  } catch {
    return [];
  }
}
