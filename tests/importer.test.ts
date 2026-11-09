import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Store } from "../src/server/store";
import { Importer } from "../src/server/importer";
import { generateTrades, PAGE_SIZE } from "../src/server/mock";

test("the importer resumes at the persisted cursor and publishes only after the last page", async () => {
  const store = new Store(":memory:");
  const { pull } = store.createPull(0);
  store.stage(pull.id, 0, generateTrades(1, 0, PAGE_SIZE));
  const requested: number[] = [];
  const server = createServer((req, res) => {
    const page = Number(
      new URL(req.url!, "http://localhost").searchParams.get("page"),
    );
    requested.push(page);
    res.end(
      JSON.stringify({
        trades: generateTrades(1, page * PAGE_SIZE, PAGE_SIZE),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  let completionEvents = 0;
  const worker = new Importer(
    store,
    `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    (complete) => {
      if (complete) {
        completionEvents++;
        assert.equal(store.snapshot().total, 10000);
      } else assert.equal(store.snapshot().total, 5000);
    },
  );
  try {
    await worker.wake();
    assert.equal(requested[0], 1);
    assert.equal(requested.length, 49);
    assert.equal(completionEvents, 1);
    assert.equal(store.pulls()[0].status, "completed");
  } finally {
    worker.stop();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.db.close();
  }
});

test("transient upstream failures retry data reads rather than polling job status", async () => {
  const store = new Store(":memory:");
  store.createPull(0);
  let attempts = 0;
  const server = createServer((req, res) => {
    attempts++;
    if (attempts <= 2) {
      res.writeHead(503);
      res.end();
      return;
    }
    const page = Number(
      new URL(req.url!, "http://localhost").searchParams.get("page"),
    );
    res.end(
      JSON.stringify({
        trades: generateTrades(1, page * PAGE_SIZE, PAGE_SIZE),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const worker = new Importer(
    store,
    `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    () => {},
  );
  try {
    await worker.wake();
    assert.equal(attempts, 52);
    assert.equal(store.pulls()[0].status, "completed");
    assert.equal(store.snapshot().total, 10000);
  } finally {
    worker.stop();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.db.close();
  }
});

test("invalid upstream payload fails the job and preserves all committed trades", async () => {
  const store = new Store(":memory:");
  store.createPull(0);
  const server = createServer((_, res) =>
    res.end(JSON.stringify({ trades: [] })),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const worker = new Importer(
    store,
    `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    () => {},
  );
  try {
    await worker.wake();
    assert.equal(store.pulls()[0].status, "failed");
    assert.equal(store.snapshot().total, 5000);
    assert.equal(store.active(), undefined);
  } finally {
    worker.stop();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.db.close();
  }
});
