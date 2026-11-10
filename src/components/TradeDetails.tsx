"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { gsap } from "gsap";
import type { Trade } from "../shared/types";
import { tradeContext } from "../shared/trade-details";
import "./TradeDetails.css";

const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
const count = (value: number) => value.toLocaleString("en-IN");
const executedAt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "medium",
});

export function TradeDetails({
  trade,
  trades,
  onClient,
}: {
  trade: Trade;
  trades: Trade[];
  onClient: (client: string) => void;
}) {
  const root = useRef<HTMLElement>(null);
  const context = useMemo(() => tradeContext(trade, trades), [trade, trades]);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = gsap.fromTo(
      root.current?.querySelectorAll(".trade-detail-section") ?? [],
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.3,
        stagger: 0.06,
        ease: "power2.out",
        clearProps: "opacity,transform",
      },
    );
    return () => {
      animation.revert();
    };
  }, [trade.id]);

  return (
    <section className="trade-details" ref={root} aria-label="Trade details">
      <header className="trade-detail-section trade-detail-heading">
        <h2>{trade.symbol}</h2>
        <span className="trade-details-side" data-side={trade.side}>
          {trade.side === "BUY" ? "Buy" : "Sell"}
        </span>
      </header>
      <dl className="trade-detail-section trade-detail-identifiers">
        <div>
          <dt>Trade ID</dt>
          <dd>{trade.id}</dd>
        </div>
        <div>
          <dt>Client</dt>
          <dd>{trade.client}</dd>
        </div>
        <div>
          <dt>Executed at · IST</dt>
          <dd>
            <time dateTime={trade.timestamp}>
              {executedAt.format(new Date(trade.timestamp))}
            </time>
          </dd>
        </div>
      </dl>
      <dl className="trade-detail-section trade-detail-values">
        <div>
          <dt>Quantity</dt>
          <dd>{count(trade.quantity)} shares</dd>
        </div>
        <div>
          <dt>Price per share</dt>
          <dd>{money(trade.pricePaise)}</dd>
        </div>
        <div className="trade-detail-notional">
          <dt>Gross trade value</dt>
          <dd data-testid="trade-detail-notional">
            {money(trade.quantity * trade.pricePaise)}
          </dd>
        </div>
      </dl>
      <div className="trade-detail-section trade-detail-context">
        <h3>Trade context</h3>
        <p>Within the current review scope.</p>
        <dl>
          <div>
            <dt>Trades for {trade.client}</dt>
            <dd>{count(context.clientCount)}</dd>
          </div>
          <div>
            <dt>Client gross turnover</dt>
            <dd>{money(context.clientTurnoverPaise)}</dd>
          </div>
          <div>
            <dt>{trade.symbol} volume</dt>
            <dd>{count(context.symbolQuantity)} shares</dd>
          </div>
          <div>
            <dt>{trade.symbol} volume-weighted price</dt>
            <dd>
              {context.symbolVwapPaise === null
                ? "No trades in scope"
                : money(context.symbolVwapPaise)}
            </dd>
          </div>
        </dl>
        <p>Volume-weighted price uses each trade’s share quantity as its weight.</p>
      </div>
      <button
        className="secondary-button full-width"
        onClick={() => onClient(trade.client)}
      >
        View client trades <ArrowUpRight size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
