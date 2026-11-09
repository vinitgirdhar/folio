import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { generateTrades, TOTAL_PAGES } from "./mock";
import type { Pull, Snapshot, Trade } from "../shared/types";

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS trades (id TEXT PRIMARY KEY, client TEXT NOT NULL, symbol TEXT NOT NULL, side TEXT NOT NULL, quantity INTEGER NOT NULL, pricePaise INTEGER NOT NULL, timestamp TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS trade_time ON trades(timestamp DESC);
      CREATE TABLE IF NOT EXISTS pulls (id TEXT PRIMARY KEY, batch INTEGER NOT NULL UNIQUE, status TEXT NOT NULL, delayMs INTEGER NOT NULL, nextPage INTEGER NOT NULL DEFAULT 0, totalPages INTEGER NOT NULL, createdAt TEXT NOT NULL, completedAt TEXT, error TEXT, inserted INTEGER NOT NULL DEFAULT 0);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_pull ON pulls(status) WHERE status='running';
      CREATE TABLE IF NOT EXISTS staging (job TEXT NOT NULL, page INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(job,page));`);
    if (
      !(this.db.prepare("SELECT COUNT(*) AS n FROM trades").get()!.n as number)
    ) {
      this.transaction(() => this.insertTrades(generateTrades(0)));
    }
  }
  transaction<T>(run: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = run();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  insertTrades(trades: Trade[]) {
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO trades VALUES (?,?,?,?,?,?,?)",
    );
    let count = 0;
    for (const t of trades)
      count += Number(
        insert.run(
          t.id,
          t.client,
          t.symbol,
          t.side,
          t.quantity,
          t.pricePaise,
          t.timestamp,
        ).changes,
      );
    return count;
  }
  snapshot(): Snapshot {
    const trades = this.db
      .prepare("SELECT * FROM trades ORDER BY timestamp DESC, id DESC")
      .all() as Trade[];
    return { trades, pulls: this.pulls(), total: trades.length };
  }
  pulls(): Pull[] {
    return this.db
      .prepare("SELECT * FROM pulls ORDER BY rowid DESC LIMIT 20")
      .all() as Pull[];
  }
  active(): (Pull & { batch: number }) | undefined {
    return this.db
      .prepare("SELECT * FROM pulls WHERE status='running'")
      .get() as (Pull & { batch: number }) | undefined;
  }
  createPull(delayMs: number): { pull: Pull; reused: boolean } {
    return this.transaction(() => {
      const active = this.active();
      if (active) return { pull: active, reused: true };
      const batch = Number(
        this.db
          .prepare("SELECT COALESCE(MAX(batch),0)+1 AS batch FROM pulls")
          .get()!.batch,
      );
      const id = randomUUID();
      this.db
        .prepare(
          "INSERT INTO pulls(id,batch,status,delayMs,totalPages,createdAt) VALUES (?,?,'running',?,?,?)",
        )
        .run(id, batch, delayMs, TOTAL_PAGES, new Date().toISOString());
      return { pull: this.active()!, reused: false };
    });
  }
  stage(id: string, page: number, trades: Trade[]) {
    this.transaction(() => {
      this.db
        .prepare("INSERT OR REPLACE INTO staging VALUES (?,?,?)")
        .run(id, page, JSON.stringify(trades));
      this.db
        .prepare("UPDATE pulls SET nextPage=? WHERE id=?")
        .run(page + 1, id);
    });
  }
  complete(id: string) {
    this.transaction(() => {
      const pages = this.db
        .prepare("SELECT payload FROM staging WHERE job=? ORDER BY page")
        .all(id);
      if (pages.length !== TOTAL_PAGES)
        throw new Error(
          "Incomplete export; committed trades have been preserved.",
        );
      let inserted = 0;
      for (const page of pages)
        inserted += this.insertTrades(JSON.parse(page.payload as string));
      this.db
        .prepare(
          "UPDATE pulls SET status='completed',completedAt=?,inserted=? WHERE id=? AND status='running'",
        )
        .run(new Date().toISOString(), inserted, id);
      this.db.prepare("DELETE FROM staging WHERE job=?").run(id);
    });
  }
  fail(id: string, error: string) {
    this.transaction(() => {
      this.db
        .prepare(
          "UPDATE pulls SET status='failed',error=?,completedAt=? WHERE id=?",
        )
        .run(error, new Date().toISOString(), id);
      this.db.prepare("DELETE FROM staging WHERE job=?").run(id);
    });
  }
}
