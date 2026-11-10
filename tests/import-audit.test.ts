import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pull, Trade } from "../src/shared/types";
import { completedImports, summarizeImport } from "../src/shared/import-audit";

const pull: Pull = {
  id: "job-1",
  batch: 1,
  status: "completed",
  delayMs: 0,
  nextPage: 50,
  totalPages: 50,
  createdAt: "2026-11-09T03:45:00.000Z",
  completedAt: "2026-11-09T03:46:00.000Z",
  error: null,
  inserted: 2,
};
const trade: Trade = {
  id: "BSE-0001-000000",
  client: "CL-01001",
  symbol: "TCS",
  side: "BUY",
  quantity: 3,
  pricePaise: 10025,
  timestamp: "2026-11-09T03:45:10.000Z",
};

test("import audit separates batch one from batch ten and reconciles exact quantities and value", () => {
  const second = {
    ...trade,
    id: "BSE-0001-000001",
    side: "SELL" as const,
    quantity: 2,
    pricePaise: 11000,
    timestamp: "2026-11-09T03:45:00.000Z",
  };
  const audit = summarizeImport(
    [trade, { ...trade, id: "BSE-0010-000000" }, second],
    pull,
  );
  assert.equal(audit.received, 2);
  assert.equal(audit.unique, 2);
  assert.equal(audit.grossPaise, 52075);
  assert.equal(audit.quantity, 5);
  assert.equal(audit.buys, 1);
  assert.equal(audit.sells, 1);
  assert.equal(audit.first, second.timestamp);
  assert.equal(audit.last, trade.timestamp);
  assert.equal(audit.reconciled, true);
});

test("duplicate IDs and inserted count mismatches cannot be marked reconciled", () => {
  const duplicate = summarizeImport([trade, trade], pull);
  assert.equal(duplicate.duplicates, 1);
  assert.equal(duplicate.reconciled, false);
  assert.equal(summarizeImport([trade], pull).reconciled, false);
  assert.equal(summarizeImport([], { ...pull, inserted: 0 }).reconciled, false);
});

test("only completed valid batches are selectable, newest batch first", () => {
  const failed = { ...pull, id: "failed", status: "failed" as const };
  const running = { ...pull, id: "running", status: "running" as const };
  const later = { ...pull, id: "job-10", batch: 10 };
  const imports = completedImports([
    pull,
    failed,
    running,
    later,
    { ...pull, batch: NaN },
  ]);
  assert.deepEqual(
    imports.map((item) => item.id),
    ["job-10", "job-1"],
  );
  assert.equal(summarizeImport([trade], failed).received, 0);
  assert.equal(summarizeImport([trade], running).received, 0);
  assert.equal(summarizeImport([trade], { ...pull, batch: -1 }).received, 0);
});
