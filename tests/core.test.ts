import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generateTrades,
  integer,
  validatePage,
  TOTAL_PAGES,
  PAGE_SIZE,
} from "../src/server/mock";
import { Store } from "../src/server/store";

test("the seed is deterministic, realistic in shape and contains 5,000 unique trades", () => {
  const trades = generateTrades(0);
  assert.equal(trades.length, 5000);
  assert.deepEqual(trades, generateTrades(0));
  assert.equal(new Set(trades.map((t) => t.id)).size, 5000);
  assert.equal(new Set(trades.map((t) => t.client)).size, 120);
  assert.equal(new Set(trades.map((t) => t.symbol)).size, 6);
  assert.ok(
    trades.every(
      (t) =>
        Number.isSafeInteger(t.pricePaise) &&
        t.pricePaise > 0 &&
        t.quantity > 0,
    ),
  );
});

test("all data pages reconstruct exactly the complete slow endpoint", () => {
  const pages = Array.from({ length: TOTAL_PAGES }, (_, page) =>
    generateTrades(3, page * PAGE_SIZE, PAGE_SIZE),
  ).flat();
  assert.deepEqual(pages, generateTrades(3));
  assert.ok(900000 / TOTAL_PAGES < 25000);
});

test("query and body boundaries reject fractional, negative, excessive and nonnumeric values", () => {
  for (const value of [-1, 900001, NaN, 1.5, "12000", null])
    assert.throws(() => integer(value, 0, 900000, "delayMs"));
  assert.equal(integer(900000, 0, 900000, "delayMs"), 900000);
});

test("upstream validation rejects corrupt rows and wrong IDs before staging", () => {
  const trades = generateTrades(1, 0, PAGE_SIZE);
  assert.deepEqual(validatePage({ trades }, 1, 0), trades);
  assert.throws(() => validatePage({ trades: [] }, 1, 0));
  assert.throws(() =>
    validatePage(
      { trades: [{ ...trades[0], pricePaise: -1 }, ...trades.slice(1)] },
      1,
      0,
    ),
  );
  assert.throws(() => validatePage({ trades }, 2, 0));
});

test("parallel clicks reuse the active job and staging never changes the read model", () => {
  const store = new Store(":memory:");
  try {
    const first = store.createPull(0),
      second = store.createPull(0);
    assert.equal(first.pull.id, second.pull.id);
    assert.equal(second.reused, true);
    store.stage(first.pull.id, 0, generateTrades(1, 0, PAGE_SIZE));
    assert.equal(store.snapshot().total, 5000);
    assert.equal(store.active()!.nextPage, 1);
    assert.throws(() => store.complete(first.pull.id));
    assert.equal(store.snapshot().total, 5000);
  } finally {
    store.db.close();
  }
});

test("completion atomically publishes all pages and retries cannot duplicate trade IDs", () => {
  const store = new Store(":memory:");
  try {
    const { pull } = store.createPull(0);
    for (let page = 0; page < TOTAL_PAGES; page++)
      store.stage(
        pull.id,
        page,
        generateTrades(1, page * PAGE_SIZE, PAGE_SIZE),
      );
    store.complete(pull.id);
    assert.equal(store.snapshot().total, 10000);
    assert.equal(store.pulls()[0].inserted, 5000);
    assert.equal(store.active(), undefined);
    assert.equal(store.insertTrades(generateTrades(1)), 0);
    assert.equal(store.snapshot().total, 10000);
  } finally {
    store.db.close();
  }
});

test("a failed import preserves the last committed dataset", () => {
  const store = new Store(":memory:");
  try {
    const { pull } = store.createPull(0);
    store.stage(pull.id, 0, generateTrades(1, 0, PAGE_SIZE));
    store.fail(pull.id, "Upstream unavailable");
    assert.equal(store.snapshot().total, 5000);
    assert.equal(store.pulls()[0].status, "failed");
    assert.equal(store.pulls()[0].error, "Upstream unavailable");
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM staging").get()!.n,
      0,
    );
  } finally {
    store.db.close();
  }
});

test("a process restart retains committed trades, staged data and the resume cursor", () => {
  const dir = mkdtempSync(join(tmpdir(), "folio-"));
  const path = join(dir, "test.sqlite");
  try {
    const first = new Store(path);
    const { pull } = first.createPull(12000);
    first.stage(pull.id, 0, generateTrades(1, 0, PAGE_SIZE));
    first.db.close();
    const second = new Store(path);
    try {
      assert.equal(second.active()!.id, pull.id);
      assert.equal(second.active()!.nextPage, 1);
      assert.equal(second.snapshot().total, 5000);
      assert.equal(
        second.db.prepare("SELECT count(*) n FROM staging").get()!.n,
        1,
      );
    } finally {
      second.db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
