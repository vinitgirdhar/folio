export type Trade = {
  id: string;
  client: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  pricePaise: number;
  timestamp: string;
};
export type Pull = {
  id: string;
  status: "running" | "completed" | "failed";
  delayMs: number;
  nextPage: number;
  totalPages: number;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
  inserted: number;
};
export type Snapshot = { trades: Trade[]; pulls: Pull[]; total: number };
export const SYMBOLS = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries",
    price: 298450,
    color: "#4874ed",
  },
  { symbol: "TCS", name: "Tata Consultancy", price: 412350, color: "#9874e8" },
  { symbol: "HDFCBANK", name: "HDFC Bank", price: 172680, color: "#ed9252" },
  { symbol: "INFY", name: "Infosys", price: 184520, color: "#37a78c" },
  { symbol: "ICICIBANK", name: "ICICI Bank", price: 128460, color: "#d87095" },
  {
    symbol: "BHARTIARTL",
    name: "Bharti Airtel",
    price: 156730,
    color: "#e2b145",
  },
] as const;
