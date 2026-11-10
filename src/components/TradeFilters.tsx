"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Bookmark, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { gsap } from "gsap";
import type { Trade } from "../shared/types";
import {
  EMPTY_TRADE_FILTERS,
  parseSavedTradeViews,
  tradeFilterError,
  type SavedTradeView,
  type TradeViewState,
} from "../shared/trade-filters";
import { Dropdown } from "./Dropdown";
import "./TradeFilters.css";

const storageKey = "folio-trade-views";
const changeEvent = "folio-trade-views-change";
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(storageKey) ?? "[]";
  } catch {
    return "[]";
  }
}

export function TradeFilters({
  trades,
  value,
  onChange,
}: {
  trades: Trade[];
  value: TradeViewState;
  onChange: (value: TradeViewState) => void;
}) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const views = useMemo(() => parseSavedTradeViews(raw), [raw]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState("");
  const appliedName = views.some(
    (view) =>
      view.name === selected &&
      (Object.keys(value) as (keyof TradeViewState)[]).every(
        (key) => view.filters[key] === value[key],
      ),
  )
    ? selected
    : "";
  const error = tradeFilterError(value);
  const count = Object.keys(EMPTY_TRADE_FILTERS).filter(
    (key) => value[key as keyof typeof EMPTY_TRADE_FILTERS] !== "",
  ).length;
  const clients = useMemo(() => {
    const ids = new Set(trades.map((trade) => trade.client));
    if (value.client) ids.add(value.client);
    return [...ids].sort();
  }, [trades, value.client]);
  function persist(next: SavedTradeView[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event(changeEvent));
      return true;
    } catch {
      setFeedback(
        "Browser storage is unavailable. Saved views could not be changed.",
      );
      return false;
    }
  }
  function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 40) {
      setFeedback("Enter a view name of 1–40 characters.");
      return;
    }
    if (error) {
      setFeedback("Fix the filters before saving this view.");
      return;
    }
    const candidate = { name: trimmed, filters: { ...value } };
    if (!parseSavedTradeViews(JSON.stringify([candidate])).length) {
      setFeedback(
        "This view contains an unsupported filter or a value longer than 200 characters.",
      );
      return;
    }
    const remaining = views.filter(
      (view) => view.name.toLowerCase() !== trimmed.toLowerCase(),
    );
    if (remaining.length >= 10) {
      setFeedback(
        "You can save up to 10 views. Delete one before adding another.",
      );
      return;
    }
    if (persist([...remaining, candidate])) {
      setSelected(trimmed);
      setName("");
      setFeedback(`Saved “${trimmed}” in this browser.`);
    }
  }
  function update(key: keyof TradeViewState, next: string) {
    setSelected("");
    setFeedback("");
    onChange({ ...value, [key]: next });
  }

  return (
    <section className="trade-filters" aria-label="Advanced trade filters">
      <details
        onToggle={(event) => {
          if (
            event.newState === "open" &&
            !matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            gsap.fromTo(
              event.currentTarget.querySelector(".trade-filter-content"),
              { opacity: 0, y: -5 },
              {
                opacity: 1,
                y: 0,
                duration: 0.2,
                overwrite: "auto",
                clearProps: "transform,opacity",
              },
            );
        }}
      >
        <summary>
          <SlidersHorizontal size={14} /> More filters{" "}
          {count > 0 && (
            <span className="trade-filter-count">{count} active</span>
          )}
        </summary>
        <div className="trade-filter-content">
          <div className="trade-filter-grid">
            <div className="trade-filter-field">
              <span>Client</span>
              <Dropdown
                label="Filter client"
                value={value.client}
                onChange={(next) => update("client", next)}
                options={[
                  { value: "", label: "All clients" },
                  ...clients.map((client) => ({
                    value: client,
                    label: client,
                  })),
                ]}
              />
            </div>
            <label className="trade-filter-field">
              Minimum trade value (₹)
              <input
                inputMode="decimal"
                value={value.minNotional}
                onChange={(event) => update("minNotional", event.target.value)}
                placeholder="No minimum"
              />
            </label>
            <label className="trade-filter-field">
              Maximum trade value (₹)
              <input
                inputMode="decimal"
                value={value.maxNotional}
                onChange={(event) => update("maxNotional", event.target.value)}
                placeholder="No maximum"
              />
            </label>
            <label className="trade-filter-field">
              From time (IST)
              <input
                type="time"
                value={value.fromTime}
                onChange={(event) => update("fromTime", event.target.value)}
              />
            </label>
            <label className="trade-filter-field">
              To time (IST)
              <input
                type="time"
                value={value.toTime}
                onChange={(event) => update("toTime", event.target.value)}
              />
            </label>
          </div>
          {count > 0 && (
            <button
              className="trade-filter-reset"
              onClick={() => {
                setSelected("");
                onChange({ ...value, ...EMPTY_TRADE_FILTERS });
              }}
            >
              <RotateCcw size={13} /> Reset advanced filters
            </button>
          )}
          <div className="trade-view-controls">
            <div className="trade-filter-field">
              <span>Saved views</span>
              <Dropdown
                label="Saved trade views"
                value={appliedName}
                options={[
                  { value: "", label: "Choose a saved view" },
                  ...views.map((view) => ({
                    value: view.name,
                    label: view.name,
                  })),
                ]}
                onChange={(next) => {
                  setSelected(next);
                  const view = views.find((item) => item.name === next);
                  if (view) {
                    onChange({ ...view.filters });
                    setFeedback(`Applied “${next}”.`);
                  }
                }}
              />
            </div>
            <button
              className="icon-button"
              disabled={!appliedName}
              aria-label="Delete saved view"
              onClick={() => {
                if (persist(views.filter((view) => view.name !== selected))) {
                  setSelected("");
                  setFeedback("Saved view deleted.");
                }
              }}
            >
              <Trash2 size={15} />
            </button>
            <label className="trade-filter-field trade-view-name">
              View name
              <input
                value={name}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Morning buys"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    save();
                  }
                }}
              />
            </label>
            <button className="secondary-button" onClick={save}>
              <Bookmark size={14} /> Save view
            </button>
          </div>
          <p className="trade-filter-note">
            Saved views include search, symbol, side and advanced filters.
            Stored only in this browser.
          </p>
          {feedback && (
            <p className="trade-filter-feedback" role="status">
              {feedback}
            </p>
          )}
        </div>
      </details>
      {error && (
        <p className="trade-filter-error" role="alert">
          {error} No trades are shown until this is corrected.
        </p>
      )}
    </section>
  );
}
