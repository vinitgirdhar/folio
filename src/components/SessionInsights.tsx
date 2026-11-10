"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChartNoAxesCombined, ChevronDown } from "lucide-react";
import { gsap } from "gsap";
import type { Trade } from "../shared/types";
import { sessionInsights } from "../shared/session-insights";
import "./SessionInsights.css";

const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
const number = (value: number) => value.toLocaleString("en-IN");

export function SessionInsights({ trades }: { trades: Trade[] }) {
  const insights = useMemo(() => sessionInsights(trades), [trades]);
  const animation = useRef<gsap.Context | null>(null);
  useEffect(
    () => () => {
      animation.current?.revert();
    },
    [],
  );

  return (
    <details
      className="session-insights"
      id="insights"
      onToggle={(event) => {
        animation.current?.revert();
        if (
          !event.currentTarget.open ||
          matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return;
        animation.current = gsap.context(() => {
          gsap.fromTo(
            ".insight-section",
            { opacity: 0, y: 6 },
            {
              opacity: 1,
              y: 0,
              duration: 0.3,
              stagger: 0.06,
              clearProps: "transform,opacity",
            },
          );
          gsap.fromTo(
            ".insight-fill",
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 0.65,
              ease: "power2.out",
              clearProps: "transform",
            },
          );
        }, event.currentTarget);
      }}
    >
      <summary>
        <span className="insights-summary-label">
          <ChartNoAxesCombined size={18} aria-hidden="true" />
          Session insights
        </span>
        <span className="insights-summary-count">
          {number(insights.count)} trades
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      </summary>
      <div className="insights-content">
        <p className="insights-note">
          Calculated from the current session view. Turnover measures executed
          trade value, not holdings or profit and loss.
        </p>
        {!insights.count ? (
          <p className="insights-empty">No trades in this view yet.</p>
        ) : (
          <>
            <div className="insights-flow insight-section">
              <div>
                <span>Buy turnover</span>
                <strong>{money(insights.buyPaise)}</strong>
                <small>{number(insights.buyCount)} trades</small>
              </div>
              <div>
                <span>Sell turnover</span>
                <strong>{money(insights.sellPaise)}</strong>
                <small>{number(insights.sellCount)} trades</small>
              </div>
              <div>
                <span>Executed quantity</span>
                <strong>{number(insights.quantity)}</strong>
                <small>Shares across {insights.symbols.length} symbols</small>
              </div>
            </div>
            <div className="insights-grid">
              <section className="insight-section">
                <h2>Symbol concentration</h2>
                <p>Share of gross turnover in this view</p>
                <ul className="insights-symbols">
                  {insights.symbols.map((symbol) => {
                    const share =
                      (symbol.turnoverPaise / insights.turnoverPaise) * 100;
                    return (
                      <li key={symbol.key}>
                        <div className="insights-symbol-heading">
                          <strong>{symbol.key}</strong>
                          <span>{share.toFixed(1)}%</span>
                        </div>
                        <div className="insight-track" aria-hidden="true">
                          <span
                            className="insight-fill"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <div className="insights-symbol-detail">
                          <span>{money(symbol.turnoverPaise)}</span>
                          <span>VWAP {money(symbol.vwapPaise)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="insights-definition">
                  VWAP is the quantity-weighted average execution price for each
                  symbol.
                </p>
              </section>
              <section className="insight-section">
                <h2>Top clients</h2>
                <p>
                  Top {Math.min(5, insights.clients.length)} of{" "}
                  {number(insights.clients.length)} clients by gross turnover
                </p>
                <ul
                  className="insights-clients"
                  aria-label="Top clients by turnover"
                >
                  {insights.clients.slice(0, 5).map((client) => (
                    <li key={client.key}>
                      <div>
                        <strong>{client.key}</strong>
                        <span>{number(client.count)} trades</span>
                      </div>
                      <strong>{money(client.turnoverPaise)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
