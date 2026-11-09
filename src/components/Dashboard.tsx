"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  LayoutGrid,
  ListFilter,
  Menu,
  Moon,
  Plus,
  Radio,
  Search,
  Sun,
  Table2,
  X,
} from "lucide-react";
import { SYMBOLS, type Pull, type Snapshot, type Trade } from "../shared/types";
import { ActivityChart, Sparkline } from "./ActivityChart";

const rupee = (value: number, decimals = 2) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
const time = (date: string) =>
  new Date(date).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
const empty: Snapshot = { trades: [], pulls: [], total: 0 };

function downloadCsv(trades: Trade[]) {
  const rows = [
    "Trade ID,Client,Symbol,Side,Quantity,Price INR,Timestamp",
    ...trades.map((t) =>
      [
        t.id,
        t.client,
        t.symbol,
        t.side,
        t.quantity,
        (t.pricePaise / 100).toFixed(2),
        t.timestamp,
      ].join(","),
    ),
  ];
  const url = URL.createObjectURL(
    new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "folio-trades.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [data, setData] = useState<Snapshot>(empty);
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState("Overview");
  const [query, setQuery] = useState("");
  const [side, setSide] = useState("All sides");
  const [symbol, setSymbol] = useState("All symbols");
  const [page, setPage] = useState(0);
  const [range, setRange] = useState("Full session");
  const [modal, setModal] = useState<"pull" | "help" | null>(null);
  const [delay, setDelay] = useState("12000");
  const [submitting, setSubmitting] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = data.pulls.find((p) => p.status === "running");

  useEffect(() => {
    let socket: WebSocket;
    let stopped = false;
    let reconnect: ReturnType<typeof setTimeout>;
    let attempts = 0;
    let received = false;
    const abort = new AbortController();
    fetch("/api/trades", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Could not read saved trades.");
        return r.json();
      })
      .then((snapshot) => {
        if (!received && !stopped) {
          setData(snapshot);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!stopped) setError(e.message);
      });
    function connect() {
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,
      );
      socket.onopen = () => {
        setConnected(true);
        attempts = 0;
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "snapshot") {
            received = true;
            setData(message.data);
            setLoaded(true);
            setError("");
          }
          if (message.type === "pulls")
            setData((current) => ({ ...current, pulls: message.data }));
        } catch {
          setError(
            "An update could not be read. Reconnect to restore your view.",
          );
          socket.close();
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!stopped)
          reconnect = setTimeout(
            connect,
            Math.min(1000 * 2 ** attempts++, 10000),
          );
      };
      socket.onerror = () => socket.close();
    }
    connect();
    return () => {
      stopped = true;
      abort.abort();
      clearTimeout(reconnect);
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const media = gsap.matchMedia();
    media.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        gsap.from(".reveal", {
          opacity: 0,
          y: 12,
          duration: 0.55,
          stagger: 0.055,
          ease: "power2.out",
          clearProps: "all",
        });
        gsap.from(".chart-line", { opacity: 0, duration: 1.1, delay: 0.2 });
      },
      root,
    );
    return () => media.revert();
  }, [loaded]);
  useEffect(() => {
    if (!modal) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [modal]);

  const metrics = useMemo(() => {
    const buys = data.trades.filter((t) => t.side === "BUY");
    return {
      value: data.trades.reduce(
        (sum, t) => sum + (t.quantity * t.pricePaise) / 100,
        0,
      ),
      buyShare: data.trades.length
        ? (buys.length / data.trades.length) * 100
        : 0,
      clients: new Set(data.trades.map((t) => t.client)).size,
      units: data.trades.reduce((sum, t) => sum + t.quantity, 0),
    };
  }, [data.trades]);
  const assets = useMemo(
    () =>
      SYMBOLS.map((asset) => {
        const trades = data.trades.filter((t) => t.symbol === asset.symbol);
        const first = trades.at(-1)?.pricePaise ?? asset.price;
        const last = trades[0]?.pricePaise ?? asset.price;
        const samples = [...trades]
          .reverse()
          .filter(
            (_, i) => i % Math.max(1, Math.floor(trades.length / 22)) === 0,
          )
          .map((t) => t.pricePaise);
        return {
          ...asset,
          last,
          change: ((last - first) / first) * 100,
          samples,
        };
      }),
    [data.trades],
  );
  const filtered = useMemo(
    () =>
      data.trades.filter(
        (t) =>
          (side === "All sides" || t.side === side) &&
          (symbol === "All symbols" || t.symbol === symbol) &&
          `${t.id} ${t.client} ${t.symbol}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [data.trades, side, symbol, query],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * 8, safePage * 8 + 8);
  const chartTrades =
    range === "Last hour"
      ? data.trades.filter(
          (t) =>
            new Date(t.timestamp).getTime() >=
            new Date(data.trades[0]?.timestamp ?? 0).getTime() - 3600000,
        )
      : data.trades;

  function navigate(value: string) {
    setSection(value);
    setMobileNav(false);
    requestAnimationFrame(() =>
      document
        .getElementById(
          value === "Trade blotter"
            ? "trades"
            : value === "Import activity"
              ? "imports"
              : "overview",
        )
        ?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        }),
    );
  }
  function toggleTheme() {
    const value =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("folio-theme", value);
    } catch {}
  }
  async function pullTrades() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/pulls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delayMs: Number(delay) }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not start the pull.");
      setData((current) => ({
        ...current,
        pulls: [
          result.pull,
          ...current.pulls.filter((p) => p.id !== result.pull.id),
        ],
      }));
      setModal(null);
      setNotice(
        result.reused
          ? "The current pull is already running."
          : "Pull started. You can keep working.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the pull.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell" ref={root}>
      {mobileNav && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <Link className="brand" href="/" aria-label="Folio home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          folio<span className="brand-period">.</span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">
            <Activity size={18} />
          </span>
          <div>
            Trade desk<small>Personal workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">Workspace</div>
        <nav aria-label="Main navigation">
          {[
            { title: "Overview", icon: LayoutGrid },
            { title: "Trade blotter", icon: Table2 },
            { title: "Import activity", icon: Clock3 },
          ].map(({ title, icon: Icon }) => (
            <button
              key={title}
              className={section === title ? "nav-item active" : "nav-item"}
              onClick={() => navigate(title)}
              aria-current={section === title ? "page" : undefined}
            >
              <Icon size={18} />
              {title}
              {title === "Import activity" && active && (
                <span className="nav-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-note">
            <span className="source-icon">
              <Database size={18} />
            </span>
            <strong>Your data, connected.</strong>
            <p>
              Import once. Stay in the flow.
              <br />
              Your trades update automatically.
            </p>
            <button onClick={() => setModal("pull")}>
              Manage imports <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="help-link" onClick={() => setModal("help")}>
            <CircleHelp size={17} />
            How Folio works
            <ArrowUpRight size={14} />
          </button>
          <div className="profile">
            <span className="avatar">TD</span>
            <div>
              Trade desk<small>Assessment workspace</small>
            </div>
            <span className="demo-tag">Demo</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{section}</strong>
          </div>
          <div className="top-actions">
            <span className="mock-badge">
              <span />
              BSE sandbox
            </span>
            <span className="top-divider" />
            <button
              className="icon-button theme-toggle"
              aria-label="Toggle color theme"
              onClick={toggleTheme}
            >
              <Moon className="moon-icon" size={18} />
              <Sun className="sun-icon" size={18} />
            </button>
            <span className="avatar small">TD</span>
          </div>
        </header>
        <main id="overview">
          <div className="page-heading reveal">
            <div>
              <div className="date-label">
                Monday, 9 November 2026 <span>•</span> Mock trading session
              </div>
              <h1>
                A clear view of your trades<span>.</span>
              </h1>
              <p>Your activity, your numbers. All in one place.</p>
            </div>
            <button
              className="primary-button"
              onClick={() => setModal("pull")}
              disabled={!!active || !loaded}
            >
              <Plus size={17} />
              {active ? "Pull in progress" : "Pull trades"}
            </button>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={16} />
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="connection-strip reveal">
            <div>
              <span className={`status-dot ${connected ? "" : "offline"}`} />
              <strong>
                {connected ? "Updates connected" : "Reconnecting updates"}
              </strong>
              <span className="strip-divider" />
              <span>
                {active
                  ? `Importing trades · ${Math.round((active.nextPage / active.totalPages) * 100)}%`
                  : loaded
                    ? `${data.total.toLocaleString("en-IN")} saved trades, ready to explore`
                    : "Opening your trade desk…"}
              </span>
            </div>
            <span className="strip-right">
              <Radio size={14} />
              Automatic updates
            </span>
          </div>
          <section className="metrics reveal" aria-label="Trading summary">
            <div className="metric">
              <span>
                Total traded value <ArrowUpRight size={15} />
              </span>
              <strong>
                {loaded ? `₹${(metrics.value / 10000000).toFixed(2)}` : "—"}
                <small> Cr</small>
              </strong>
              <p>
                <span className="metric-indicator blue" />
                Gross value across all saved trades
              </p>
            </div>
            <div className="metric">
              <span>
                Trades executed <Table2 size={15} />
              </span>
              <strong data-testid="trade-count">
                {loaded ? data.total.toLocaleString("en-IN") : "—"}
              </strong>
              <p>
                <span className="metric-indicator purple" />
                {metrics.units.toLocaleString("en-IN")} shares traded
              </p>
            </div>
            <div className="metric">
              <span>
                Buy-side activity <ArrowUpRight size={15} />
              </span>
              <strong>
                {loaded ? metrics.buyShare.toFixed(1) : "—"}
                <small>%</small>
              </strong>
              <p>
                <span className="positive">
                  {metrics.buyShare >= 50 ? "Buy-led" : "Sell-led"}
                </span>
                <span> share of trade count</span>
              </p>
            </div>
            <div className="metric">
              <span>
                Active clients <Activity size={15} />
              </span>
              <strong>{loaded ? metrics.clients : "—"}</strong>
              <p>
                <span className="metric-indicator orange" />
                Across {SYMBOLS.length} listed symbols
              </p>
            </div>
          </section>
          <div className="analytics-grid">
            <section className="panel activity-panel reveal">
              <div className="panel-heading">
                <div>
                  <h2>Trade activity</h2>
                  <p>
                    Cumulative traded value <span className="legend-dot" /> INR
                  </p>
                </div>
                <label className="select-wrap">
                  <span className="sr-only">Chart period</span>
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                  >
                    <option>Full session</option>
                    <option>Last hour</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
              <div className="chart-summary">
                <strong>
                  {rupee(
                    chartTrades.reduce(
                      (v, t) => v + (t.quantity * t.pricePaise) / 100,
                      0,
                    ),
                    0,
                  )}
                </strong>
                <span>
                  Gross turnover <ArrowUpRight size={14} />
                </span>
              </div>
              <ActivityChart trades={chartTrades} />
              <div className="chart-footer">
                <span>
                  <i />
                  Traded value
                </span>
                <span>
                  <i />
                  Value per interval
                </span>
                <small>IST · 9 Nov 2026</small>
              </div>
            </section>
            <section className="panel balance-panel reveal">
              <div className="panel-heading">
                <div>
                  <h2>Order flow</h2>
                  <p>Every trade has a direction.</p>
                </div>
                <Activity size={18} className="muted" />
              </div>
              <div
                className="donut"
                style={
                  { "--buy": `${metrics.buyShare}%` } as React.CSSProperties
                }
              >
                <div>
                  <small>Total trades</small>
                  <strong>{data.total.toLocaleString("en-IN")}</strong>
                  <span>Buy / sell split</span>
                </div>
              </div>
              <div className="flow-legends">
                <div>
                  <span>
                    <i className="buy-dot" />
                    Buy orders
                  </span>
                  <strong>{metrics.buyShare.toFixed(1)}%</strong>
                </div>
                <div>
                  <span>
                    <i className="sell-dot" />
                    Sell orders
                  </span>
                  <strong>{(100 - metrics.buyShare).toFixed(1)}%</strong>
                </div>
              </div>
              <div className="flow-note">
                <span className="positive">
                  <ArrowUpRight size={14} />
                  {metrics.buyShare >= 50 ? "Buy" : "Sell"}-side majority
                </span>
                <span>By trade count</span>
              </div>
            </section>
          </div>
          <section
            className="market-section reveal"
            aria-label="Symbol overview"
          >
            <div className="section-heading">
              <h2>
                On your radar <span>{SYMBOLS.length} symbols</span>
              </h2>
              <small>Last trade vs. first trade · simulated prices</small>
            </div>
            <div className="symbol-grid">
              {assets.map((a) => (
                <button
                  key={a.symbol}
                  className={`symbol-card ${symbol === a.symbol ? "selected" : ""}`}
                  onClick={() => {
                    setSymbol(symbol === a.symbol ? "All symbols" : a.symbol);
                    setPage(0);
                    navigate("Trade blotter");
                  }}
                  aria-label={`Filter trades for ${a.symbol}`}
                >
                  <div className="symbol-top">
                    <span
                      className="symbol-logo"
                      aria-hidden="true"
                      style={{ color: a.color, background: `${a.color}15` }}
                    >
                      {a.symbol.slice(0, 1)}
                    </span>
                    <span>
                      <strong>{a.symbol}</strong>
                      <small>{a.name}</small>
                    </span>
                    <ArrowUpRight size={13} />
                  </div>
                  <div className="symbol-bottom">
                    <div>
                      <strong>{rupee(a.last / 100)}</strong>
                      <span className={a.change >= 0 ? "positive" : "negative"}>
                        {a.change >= 0 ? "+" : ""}
                        {a.change.toFixed(2)}%
                      </span>
                    </div>
                    <Sparkline values={a.samples} positive={a.change >= 0} />
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section className="panel trades-panel reveal" id="trades">
            <div className="panel-heading">
              <div>
                <h2>
                  Trade blotter{" "}
                  <span className="count-badge">
                    {filtered.length.toLocaleString("en-IN")}
                  </span>
                </h2>
                <p>A little more detail. A lot more clarity.</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => downloadCsv(filtered)}
                disabled={!filtered.length}
              >
                <ArrowDownToLine size={15} />
                Export CSV
              </button>
            </div>
            <div className="table-toolbar">
              <label className="search-field">
                <Search size={16} />
                <input
                  placeholder="Search symbol, client or trade ID…"
                  aria-label="Search trades"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
                {query && (
                  <button
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      setPage(0);
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <div className="table-filters">
                <ListFilter size={16} />
                <label className="select-wrap">
                  <span className="sr-only">Filter symbol</span>
                  <select
                    value={symbol}
                    onChange={(e) => {
                      setSymbol(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option>All symbols</option>
                    {SYMBOLS.map((s) => (
                      <option key={s.symbol}>{s.symbol}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} />
                </label>
                <label className="select-wrap">
                  <span className="sr-only">Filter side</span>
                  <select
                    value={side}
                    onChange={(e) => {
                      setSide(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option>All sides</option>
                    <option value="BUY">Buy</option>
                    <option value="SELL">Sell</option>
                  </select>
                  <ChevronDown size={12} />
                </label>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Trade ID</th>
                    <th>Client</th>
                    <th>Side</th>
                    <th className="numeric">Quantity</th>
                    <th className="numeric">Price</th>
                    <th className="numeric">Trade value</th>
                    <th className="numeric">
                      Time (IST) <ArrowDown size={11} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <span className="table-symbol">
                          <span
                            className="tiny-logo"
                            aria-hidden="true"
                            style={{
                              color: SYMBOLS.find((s) => s.symbol === t.symbol)
                                ?.color,
                            }}
                          >
                            {t.symbol[0]}
                          </span>
                          {t.symbol}
                        </span>
                      </td>
                      <td className="trade-id">{t.id}</td>
                      <td className="muted">{t.client}</td>
                      <td>
                        <span className={`side-pill ${t.side.toLowerCase()}`}>
                          {t.side === "BUY" ? (
                            <ArrowDownLeft size={11} />
                          ) : (
                            <ArrowUpRight size={11} />
                          )}
                          {t.side === "BUY" ? "Buy" : "Sell"}
                        </span>
                      </td>
                      <td className="numeric">
                        {t.quantity.toLocaleString("en-IN")}
                      </td>
                      <td className="numeric">{rupee(t.pricePaise / 100)}</td>
                      <td className="numeric trade-value">
                        {rupee((t.pricePaise / 100) * t.quantity)}
                      </td>
                      <td className="numeric muted">{time(t.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visible.length && (
                <div className="empty-state">
                  <Search size={24} />
                  <strong>
                    {loaded ? "No trades found" : "Loading your saved trades"}
                  </strong>
                  <p>
                    {loaded
                      ? "Try another symbol, client or trade ID."
                      : "Your workspace will appear in a moment."}
                  </p>
                  {loaded && (
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setQuery("");
                        setSide("All sides");
                        setSymbol("All symbols");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="table-pagination">
              <span>
                {filtered.length
                  ? `${safePage * 8 + 1}–${Math.min(safePage * 8 + 8, filtered.length)}`
                  : "0"}{" "}
                of {filtered.length.toLocaleString("en-IN")} trades
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={!safePage}
                  onClick={() => setPage(safePage - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page {safePage + 1} of {pageCount}
                </span>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={safePage + 1 >= pageCount}
                  onClick={() => setPage(safePage + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>
          <section className="panel import-panel reveal" id="imports">
            <div className="panel-heading">
              <div>
                <h2>Import activity</h2>
                <p>Your imports keep moving, even when you leave.</p>
              </div>
              <span className="subtle-badge">
                <Database size={12} />
                Persistent storage
              </span>
            </div>
            {active && (
              <div className="import-progress">
                <div>
                  <span className="status-dot" />
                  Pull in progress{" "}
                  <strong>
                    {Math.round((active.nextPage / active.totalPages) * 100)}%
                  </strong>
                </div>
                <progress
                  aria-label="Import progress"
                  value={active.nextPage}
                  max={active.totalPages}
                />
                <p>
                  Your saved trades stay available. New trades appear when this
                  pull is complete.
                </p>
              </div>
            )}
            {data.pulls
              .filter((p) => p.status !== "running")
              .slice(0, 3)
              .map((p) => (
                <ImportRow key={p.id} pull={p} />
              ))}
            {!data.pulls.length && (
              <div className="initial-import">
                <span className="import-check">
                  <Check size={17} />
                </span>
                <div>
                  <strong>Demo workspace is ready</strong>
                  <p>5,000 seeded trades · 6 symbols · 120 clients</p>
                </div>
                <span className="subtle-badge">Seeded</span>
              </div>
            )}
          </section>
          <footer className="footer">
            <span>
              <span className="mini-brand">f.</span> Less noise. More
              perspective.
            </span>
            <span>
              Simulated data only <span>•</span> No real orders or market feed
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <dialog
          ref={dialog}
          aria-label={modal === "pull" ? "Import trades" : "How Folio works"}
          className="modal"
          onCancel={() => setModal(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="modal-heading">
            <span className="modal-icon">
              {modal === "pull" ? (
                <Database size={22} />
              ) : (
                <CircleHelp size={22} />
              )}
            </span>
            <button
              className="icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
          </div>
          {modal === "pull" ? (
            <>
              <h2>Bring your trades into focus.</h2>
              <p>
                Pull 5,000 new simulated trades from the BSE sandbox. Your
                existing trades stay right where they are.
              </p>
              <label className="delay-label">
                Simulated import duration
                <select
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                >
                  <option value="12000">12 seconds · quick demo</option>
                  <option value="35000">
                    35 seconds · timeout demonstration
                  </option>
                  <option value="900000">15 minutes · full assessment</option>
                  <option value="0">No delay · instant import</option>
                </select>
              </label>
              <div className="modal-note">
                <Radio size={17} />
                <span>
                  Start the pull and keep exploring. New trades appear
                  automatically when it finishes.
                </span>
              </div>
              {error && (
                <p className="negative" role="alert">
                  {error}
                </p>
              )}
              <button
                className="primary-button full-width"
                disabled={submitting || !!active}
                onClick={pullTrades}
              >
                {active
                  ? "A pull is already running"
                  : submitting
                    ? "Starting pull…"
                    : "Start pull"}
                <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <>
              <h2>A quieter kind of trade desk.</h2>
              <p>
                Folio gives you a view of simulated BSE trade data. Pull trades
                to add another batch; the dashboard updates automatically.
              </p>
              <ul className="help-list">
                <li>
                  <Check size={16} />
                  Your saved trades remain visible during every import.
                </li>
                <li>
                  <Check size={16} />
                  Imports resume after a server restart.
                </li>
                <li>
                  <Check size={16} />
                  Charts and totals come from saved trade records.
                </li>
                <li>
                  <Check size={16} />
                  All prices are synthetic. No real trades are placed.
                </li>
              </ul>
              <button
                className="secondary-button full-width"
                onClick={() => setModal(null)}
              >
                Got it
              </button>
            </>
          )}
        </dialog>
      )}
    </div>
  );
}

function ImportRow({ pull }: { pull: Pull }) {
  return (
    <div className="initial-import">
      <span
        className={`import-check ${pull.status === "failed" ? "failed" : ""}`}
      >
        {pull.status === "completed" ? <Check size={17} /> : <X size={17} />}
      </span>
      <div>
        <strong>
          {pull.status === "completed"
            ? `${pull.inserted.toLocaleString("en-IN")} trades imported`
            : "Pull failed"}
        </strong>
        <p>{pull.error || `Completed at ${time(pull.completedAt!)} IST`}</p>
      </div>
      <span className="subtle-badge">
        {pull.status === "completed" ? "Complete" : "Try a new pull"}
      </span>
    </div>
  );
}
