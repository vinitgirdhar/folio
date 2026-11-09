import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import next from "next";
import nextEnv from "@next/env";
import { WebSocketServer, WebSocket } from "ws";
import { Store } from "./src/server/store";
import { Importer } from "./src/server/importer";
import {
  generateTrades,
  integer,
  PAGE_SIZE,
  TOTAL_PAGES,
} from "./src/server/mock";

const dev = !process.argv.includes("--production");
nextEnv.loadEnvConfig(process.cwd(), dev);
const port = integer(Number(process.env.PORT || 3000), 1024, 65535, "PORT");
const host = process.env.HOST || "127.0.0.1";
const defaultDelay = integer(
  Number(process.env.MOCK_DELAY_MS || 12000),
  0,
  900000,
  "MOCK_DELAY_MS",
);
const app = next({ dev, port, hostname: host });
await app.prepare();
const handle = app.getRequestHandler();
const store = new Store(process.env.DATABASE_PATH || "./data/folio.sqlite");
const sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 });
function broadcast(complete: boolean) {
  const message = JSON.stringify(
    complete
      ? { type: "snapshot", data: store.snapshot() }
      : { type: "pulls", data: store.pulls() },
  );
  for (const socket of sockets.clients) {
    if (socket.readyState !== WebSocket.OPEN) continue;
    if (socket.bufferedAmount > 4 * 1024 * 1024) {
      socket.terminate();
      continue;
    }
    socket.send(message);
  }
}
// shortcut: one process owns imports and sockets; introduce shared coordination before adding replicas.
const importer = new Importer(store, `http://127.0.0.1:${port}`, broadcast);
function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Connection: "close",
  });
  res.end(JSON.stringify(data));
}
function sameOrigin(req: IncomingMessage) {
  if (!req.headers.origin) return true;
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}
async function body(req: IncomingMessage) {
  let value = "";
  for await (const chunk of req) {
    value += chunk.toString();
    if (Buffer.byteLength(value) > 1024)
      throw new Error("Request body exceeds 1 KB.");
  }
  const parsed: unknown = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Request body must be a JSON object.");
  return parsed as Record<string, unknown>;
}
async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", "http://localhost");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (url.pathname === "/getTrades" && req.method === "GET") {
    const batch = integer(
      Number(url.searchParams.get("batch") ?? 1),
      0,
      1000000,
      "batch",
    );
    const delay = integer(
      Number(url.searchParams.get("delayMs") ?? defaultDelay),
      0,
      900000,
      "delayMs",
    );
    const pageValue = url.searchParams.get("page");
    const page =
      pageValue === null
        ? null
        : integer(Number(pageValue), 0, TOTAL_PAGES - 1, "page");
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    try {
      await sleep(page === null ? delay : delay / TOTAL_PAGES, undefined, {
        signal: abort.signal,
      });
    } catch {
      return;
    }
    return json(res, 200, {
      trades: generateTrades(
        batch,
        (page ?? 0) * PAGE_SIZE,
        page === null ? 5000 : PAGE_SIZE,
      ),
      page,
      totalPages: TOTAL_PAGES,
    });
  }
  if (url.pathname === "/api/trades" && req.method === "GET")
    return json(res, 200, store.snapshot());
  if (url.pathname === "/api/pulls" && req.method === "POST") {
    if (!sameOrigin(req) || req.headers["sec-fetch-site"] === "cross-site")
      return json(res, 403, {
        error: "Cross-origin requests are not allowed.",
      });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return json(res, 415, { error: "Use application/json." });
    const input = await body(req);
    const delayMs = integer(
      input.delayMs ?? defaultDelay,
      0,
      900000,
      "delayMs",
    );
    const result = store.createPull(delayMs);
    res.setHeader("Location", `/api/pulls/${result.pull.id}`);
    json(res, 202, result);
    broadcast(false);
    setImmediate(() => void importer.wake());
    return;
  }
  if (url.pathname.startsWith("/api/pulls/") && req.method === "GET") {
    const pull = store.db
      .prepare("SELECT * FROM pulls WHERE id=?")
      .get(url.pathname.split("/").pop()!);
    return json(res, pull ? 200 : 404, pull || { error: "Pull not found." });
  }
  if (url.pathname.startsWith("/api/") || url.pathname === "/getTrades")
    return json(res, 405, { error: "Unsupported endpoint or method." });
  return handle(req, res);
}
const server = createServer((req, res) => {
  // Reproduce the assignment's absolute HTTP lifetime; upgraded WebSockets are separate.
  if (req.url?.startsWith("/api/") || req.url?.startsWith("/getTrades")) {
    const deadline = setTimeout(() => res.destroy(), 30000);
    res.on("close", () => clearTimeout(deadline));
  }
  void route(req, res).catch((error) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && /must be|body exceeds/.test(error.message))
    )
      return json(res, 400, { error: error.message });
    console.error(error);
    json(res, 500, { error: "The server could not complete the request." });
  });
});
server.on("upgrade", (req, socket, head) => {
  if (new URL(req.url || "/", "http://localhost").pathname !== "/ws") return;
  if (!sameOrigin(req)) {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(req, socket, head, (ws) =>
    sockets.emit("connection", ws, req),
  );
});
sockets.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "snapshot", data: store.snapshot() }));
  socket.on("error", () => socket.terminate());
  socket.on("pong", () => {
    socketAlive.set(socket, true);
  });
  socketAlive.set(socket, true);
  socket.on("close", () => socketAlive.delete(socket));
});
const socketAlive = new Map<WebSocket, boolean>();
// Transport liveness only: this never requests trade or job status.
const heartbeat = setInterval(() => {
  for (const socket of sockets.clients) {
    if (!socketAlive.get(socket)) {
      socket.terminate();
      continue;
    }
    socketAlive.set(socket, false);
    socket.ping();
  }
}, 15000);
server.listen(port, host, () => {
  console.log(`Folio is ready at http://${host}:${port}`);
  void importer.wake();
});
function shutdown() {
  importer.stop();
  clearInterval(heartbeat);
  for (const socket of sockets.clients) socket.terminate();
  server.close(() => {
    store.db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
