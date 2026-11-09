import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { Store } from "../src/server/store";
import type { Pull, Snapshot } from "../src/shared/types";

type Event =
  { type: "snapshot"; data: Snapshot } | { type: "pulls"; data: Pull[] };
function message(socket: WebSocket, matches: (event: Event) => boolean) {
  return new Promise<Event>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Expected push event did not arrive."));
    }, 15000);
    function cleanup() {
      clearTimeout(timer);
      socket.off("message", receive);
    }
    function receive(raw: WebSocket.RawData) {
      const event = JSON.parse(raw.toString()) as Event;
      if (matches(event)) {
        cleanup();
        resolve(event);
      }
    }
    socket.on("message", receive);
  });
}

test(
  "a real process crash resumes the saved import without losing or duplicating trades",
  { timeout: 45000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "folio-recovery-"));
    const database = join(directory, "trades.sqlite");
    const reservation = createServer();
    await new Promise<void>((resolve) =>
      reservation.listen(0, "127.0.0.1", resolve),
    );
    const port = (reservation.address() as AddressInfo).port;
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    let child: ChildProcess | undefined;
    const sockets: WebSocket[] = [];
    async function start() {
      child = spawn(
        process.execPath,
        ["--import", "tsx", "server.ts", "--production"],
        {
          env: {
            ...process.env,
            PORT: String(port),
            HOST: "127.0.0.1",
            DATABASE_PATH: database,
            MOCK_DELAY_MS: "5000",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const current = child;
      await new Promise<void>((resolve, reject) => {
        let log = "";
        const timer = setTimeout(
          () => reject(new Error(`Server startup timed out: ${log}`)),
          10000,
        );
        current.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        current.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Server exited (${code}): ${log}`));
        });
        current.stderr!.on("data", (chunk) => {
          log += chunk.toString();
        });
        current.stdout!.on("data", (chunk) => {
          log += chunk.toString();
          if (log.includes("Folio is ready")) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
    async function stop() {
      const current = child;
      child = undefined;
      if (current && current.exitCode === null && current.signalCode === null) {
        const exited = once(current, "exit");
        current.kill("SIGKILL");
        await exited;
      }
    }
    function connect() {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      socket.on("error", () => {});
      sockets.push(socket);
      return socket;
    }
    try {
      await start();
      const first = connect();
      await message(
        first,
        (event) => event.type === "snapshot" && event.data.total === 5000,
      );
      const progressed = message(
        first,
        (event) =>
          event.type === "pulls" &&
          event.data.some((pull) => pull.nextPage >= 3),
      );
      const accepted = await fetch(`http://127.0.0.1:${port}/api/pulls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delayMs: 5000 }),
      });
      assert.equal(accepted.status, 202);
      const { pull } = (await accepted.json()) as { pull: Pull };
      await progressed;
      await stop();
      const persisted = new Store(database);
      assert.equal(persisted.active()!.id, pull.id);
      assert.ok(persisted.active()!.nextPage >= 3);
      assert.equal(persisted.snapshot().total, 5000);
      persisted.db.close();
      await start();
      const resumed = connect();
      const complete = await message(
        resumed,
        (event) =>
          event.type === "snapshot" &&
          event.data.pulls.some(
            (item) => item.id === pull.id && item.status === "completed",
          ),
      );
      assert.equal(complete.type, "snapshot");
      if (complete.type !== "snapshot")
        throw new Error("Expected a committed snapshot.");
      assert.equal(complete.data.total, 10000);
      assert.equal(complete.data.pulls[0].inserted, 5000);
      assert.equal(
        new Set(complete.data.trades.map((trade) => trade.id)).size,
        10000,
      );
    } finally {
      for (const socket of sockets) socket.terminate();
      await stop();
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
