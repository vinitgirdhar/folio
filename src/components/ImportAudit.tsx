"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ChevronDown, ListChecks } from "lucide-react";
import type { Pull, Trade } from "../shared/types";
import { completedImports, summarizeImport } from "../shared/import-audit";
import { Dropdown } from "./Dropdown";
import "./ImportAudit.css";

const count = (value: number) => value.toLocaleString("en-IN");
const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
const date = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export function ImportAudit({
  trades,
  pulls,
  onExport,
}: {
  trades: Trade[];
  pulls: Pull[];
  onExport: (trades: Trade[]) => void;
}) {
  const [selected, setSelected] = useState("");
  const completed = useMemo(() => completedImports(pulls), [pulls]);
  const pull = completed.find((item) => item.id === selected) ?? completed[0];
  const previous = pull && completed.find((item) => item.batch < pull.batch);
  const audit = useMemo(
    () => (pull ? summarizeImport(trades, pull) : null),
    [trades, pull],
  );
  const prior = useMemo(
    () => (previous ? summarizeImport(trades, previous) : null),
    [trades, previous],
  );
  return (
    <details className="panel import-audit" id="import-audit">
      <summary className="import-audit-summary">
        <span>
          <ListChecks size={17} aria-hidden="true" />
          Import verification
        </span>
        <small>Review a completed batch</small>
        <ChevronDown
          size={16}
          className="import-audit-chevron"
          aria-hidden="true"
        />
      </summary>
      <div className="import-audit-content">
        <p className="import-audit-intro">
          Reconcile each completed mock import against the saved trade records.
          This view uses the complete saved dataset, including during session
          replay.
        </p>
        {pull && audit ? (
          <>
            <div className="import-audit-toolbar">
              <Dropdown
                label="Verified import batch"
                value={pull.id}
                onChange={setSelected}
                options={completed.map((item) => ({
                  value: item.id,
                  label: `Batch ${item.batch} · ${date(item.completedAt ?? item.createdAt)} IST`,
                }))}
              />
              <button
                className="secondary-button"
                disabled={!audit.records.length}
                onClick={() => onExport(audit.records)}
              >
                <ArrowDownToLine size={15} />
                Export batch CSV
              </button>
            </div>
            <p
              className={`import-audit-status ${audit.reconciled ? "positive" : "negative"}`}
              role="status"
            >
              {audit.reconciled
                ? "Record count reconciled"
                : "Record count needs review"}
              <span>
                {count(audit.received)} saved · {count(pull.inserted)} reported
                inserted
              </span>
            </p>
            <dl className="import-audit-metrics">
              <div>
                <dt>Distinct trade IDs</dt>
                <dd>{count(audit.unique)}</dd>
              </div>
              <div>
                <dt>Duplicate IDs</dt>
                <dd>{count(audit.duplicates)}</dd>
              </div>
              <div>
                <dt>Gross turnover</dt>
                <dd>{money(audit.grossPaise)}</dd>
              </div>
              <div>
                <dt>Shares traded</dt>
                <dd>{count(audit.quantity)}</dd>
              </div>
              <div>
                <dt>Buy / sell records</dt>
                <dd>
                  {count(audit.buys)} / {count(audit.sells)}
                </dd>
              </div>
              <div>
                <dt>Trade time range · IST</dt>
                <dd className="import-audit-date">
                  {audit.first && audit.last
                    ? `${date(audit.first)} – ${date(audit.last)}`
                    : "No saved records"}
                </dd>
              </div>
            </dl>
            {previous && prior && prior.received > 0 && audit.received > 0 && (
              <div className="import-audit-comparison">
                <h3>Compared with batch {previous.batch}</h3>
                <p>
                  {audit.received - prior.received >= 0 ? "+" : ""}
                  {count(audit.received - prior.received)} records ·{" "}
                  {audit.grossPaise - prior.grossPaise >= 0 ? "+" : ""}
                  {money(audit.grossPaise - prior.grossPaise)} gross turnover
                </p>
                <small>
                  Compares the saved records in these two batches, rather than
                  portfolio performance.
                </small>
              </div>
            )}
            <p className="import-audit-note">
              Batch membership follows the mock API’s deterministic trade IDs.
              Reconciliation checks record counts and duplicate IDs; it does not
              certify exchange execution or cryptographic integrity.
            </p>
          </>
        ) : (
          <div className="import-audit-empty">
            <strong>No completed imports yet</strong>
            <p>
              Start a trade pull. Its saved records will be available here after
              completion.
            </p>
          </div>
        )}
      </div>
    </details>
  );
}
