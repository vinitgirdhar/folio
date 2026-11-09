# Engineering research and implementation plan

Researched 9 November 2026. Scope: a reviewable assignment implementation, not a real brokerage system. Sources below are primary documentation or standards. Design choices are engineering judgments derived from those sources and the supplied brief.

## 1. Can a 15-minute pull survive a 30-second HTTP lifetime?

**No, if it is one blocking response over that constrained network.** This follows directly from the two limits in the brief. Neither a queue nor a longer client-side timeout changes a network-enforced connection lifetime. A background job solves the *browser request* lifetime; the job's *upstream request* must also fit the transport limit.

HTTP 202 acknowledges acceptance without promising completion; it allows the caller to continue while processing happens separately. [RFC 9110, section 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#name-202-accepted)

Microsoft's asynchronous request/reply pattern separates acceptance from background work. Its common status-polling variant is excluded by this assignment; the documentation also discusses callback and persistent-notification alternatives. [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply)

**Decision:** return 202 only after persisting the job, then wake a background consumer. Preserve the full slow mock GET, but extend GET with immutable batch pagination. Divide total source work across bounded pages. This is a deliberate upstream contract assumption, not an assertion about real BSE capabilities. If real BSE only has a blocking export, request async export/callback support or a network exception.

## 2. How do open dashboards receive completion without polling?

EventSource keeps an HTTP event-stream connection open. Heartbeats can address idle timeouts, but do not logically defeat the brief's absolute connection-age limit. Repeatedly restarting SSE would also introduce avoidable connection turnover. [MDN EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

WebSocket establishes an opening handshake and then uses its own framing over TCP. It supports server-initiated messages without repeated HTTP data fetches. [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455.html), [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

**Decision:** one WebSocket per dashboard. Send an authoritative snapshot at connection and after publication; send smaller progress messages between those events. Recover by reconnecting and receiving another snapshot. Browser transport reconnection and server ping/pong are not trade-status polling. This assumes the network permits persistent upgraded connections; if it forbids all long-lived transport and all polling, another push channel must be agreed with the evaluator.

## 3. Next.js, React-only, or a separate backend?

Next.js supports a custom Node server when its integrated routing cannot meet application requirements. Its documentation warns about lost framework optimizations and incompatibility with standalone output tracing. [Next.js custom server](https://nextjs.org/docs/app/guides/custom-server)

Self-hosting supports persistent application processes; the guide recommends a reverse proxy for a publicly exposed application. [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)

| Option | Judgment for this assignment |
| --- | --- |
| React + Vite + separate Node backend | Good technical fit, but two toolchains and origins provide little value here. |
| Next.js serverless endpoints only | A poor fit for durable in-process work and process-local live connections; requires additional managed services. |
| Next.js with an always-on custom Node server | Chosen: one repository, one port, one process, frontend and backend TypeScript. Custom routing is small and explicit. |
| PostgreSQL + Redis queue + dedicated workers | Sensible for multi-replica production, unnecessary infrastructure for a few thousand mock trades. |

**Decision:** Next.js App Router for UI, Node's standard HTTP server for the mock/API and `ws` for live delivery. No Express wrapper or ORM is needed. Use standard, documented APIs rather than experimental framework WebSocket route features. Start through `server.ts`, not `next start`.

## 4. How do imports stay durable and consistent?

SQLite transactions make related changes atomic: a reader should observe either the old state or the committed new state. [SQLite atomic commit](https://www.sqlite.org/atomiccommit.html)

WAL mode permits readers and a writer to coexist and has local filesystem and backup considerations; it is not a shared network-file scaling strategy. [SQLite WAL](https://www.sqlite.org/wal.html)

Node 22 includes a built-in SQLite API, including prepared statements and synchronous database access. The synchronous interface is suitable for this small local workload; it should be reassessed for substantially larger read models. [Node 22 SQLite](https://nodejs.org/download/release/v22.23.0/docs/api/sqlite.html)

**Decision:** SQLite stores jobs, staged pages, and published trades. Stage a page and update its cursor in one transaction. Publish all pages and mark the job complete in another transaction. Deterministic IDs make re-fetch safe. A database uniqueness rule allows only one running pull. An interrupted pull resumes on startup. No independent scheduler is needed because request acceptance and startup are sufficient wake-up events.

For bursty production workloads, a dedicated queue can buffer demand and isolate workers, but that introduces operational components. [Azure queue-based load leveling](https://learn.microsoft.com/en-us/azure/architecture/patterns/queue-based-load-leveling)

## 5. What data and UI are appropriate?

**Engineering judgment:** 5,000 deterministic synthetic records satisfy the brief's “few thousand” requirement and make tests reproducible. Real exchange data would add access/licensing dependencies without demonstrating the required concurrency behavior. Six recognisable Indian equity symbols and 120 simulated clients make filters useful. A fixed mock trading day avoids falsely implying a live market feed. Each pull adds a distinct 5,000-record batch; restarting never reseeds an existing non-empty database.

**Current design:** platform typography, tabular numerals and a floating glass toolbar follow the user's revised Apple-style direction. The light canvas is `#F3F4F6`; dark mode uses an exact `#000000` base with translucent neutral surfaces, with colour reserved for data. Navigation and secondary actions are consolidated in a workspace menu; import history is collapsed. Summary → activity/order flow → symbol cards → trade table establishes the primary hierarchy. Tables retain horizontal scrolling on narrow screens, with hidden scrollbars, edge fades, a discovery animation and directional controls.

```text
Desktop:        [floating glass toolbar + workspace menu]
         [heading + pull action]
         [saved-data status]
         [four trading summaries]
         [activity chart | order flow]
         [six symbol summaries]
         [search + filters + trade blotter]
         [collapsed import activity]

Mobile:  [floating glass toolbar + theme + workspace menu]
         [heading + pull action]
         [two-by-two summaries]
         [activity] [order flow]
         [two-column symbols]
         [filters + scrollable table]
         [collapsed import history]
```

Review against the brief: this is an operational dashboard, so clear numbers and familiar cards are intentional. No invented market signals, portfolio P&L, recommendation engine, order placement, or fake live index quotes. The strongest visual emphasis is the readable activity chart; decorative gradients are limited to its area fill.

GSAP's media-query helper supports matching reduced-motion preferences and cleaning up animations. Reduced-motion CSS is a standard user preference. [GSAP matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/), [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)

**Decision:** one restrained page entrance, brief user-action transitions, and no continuous ornamental animation. Native dialog semantics, keyboard focus, named controls, and text labels accompany colour-coded states.

The later UI refinement integrates the original [deepika-builds/liquid-glass](https://github.com/deepika-builds/liquid-glass) DOM library at commit `98ed97bd99def529493fd37177228810f6422f6d`. React effects initialize and destroy its instances; the pinned source and MIT licence live in `public/vendor`. SVG displacement is limited to smaller surfaces, with ordinary CSS frosting on large panels. The upstream's non-Chromium fallback is retained. Chart drawing, popover/dialog entrances, theme-button motion and hover/press feedback answer real interactions. Dropdowns use a select-only combobox with the native Popover API for top-layer placement and dismissal, with keyboard navigation implemented following the [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).

## Implementation sequence and acceptance criteria

1. Deterministic source data; default slow GET and bounded page extension. Verify pages reconstruct the same full batch.
2. SQLite read model and durable job state. Verify old data remains visible, publication is atomic, and duplicate IDs do not grow the dataset.
3. Background importer. Verify saved-page recovery, bounded retries, invalid payload handling, and failure preservation.
4. HTTP 202 acceptance and WebSocket fan-out. Verify live completion reaches multiple already-open dashboards without status requests.
5. Responsive frontend, light/dark persistence, data-derived charts, filters, export and import feedback.
6. Type checking, lint, unit/integration checks, real 35-second browser test under the HTTP cutoff, mobile screenshots and accessibility checks. Document unexecuted checks honestly.

## Limits and open production questions

- No real BSE protocol, credentials, pagination guarantees or licensing were supplied or verified.
- Pagination is the selected contract extension. If the evaluator disallows changing upstream semantics, clarify the network path before claiming feasibility.
- WebSocket upgrades must be allowed by the actual proxy/network; HTTP and upgraded-connection timeouts are different deployment settings.
- The full snapshot approach targets the requested scale; larger histories require SQL-based pagination/aggregation and bounded notifications.
- Single-process scheduling is event driven and durable on disk, but not highly available. A host/process manager must restart the app after a crash.
- Public multi-user use requires a separate security and operations scope. No real trading or investment decisions should rely on the synthetic demonstration.

Method: researched transport semantics, HTTP job acceptance, deployment options, persistence and UI accessibility through Exa, Context7 and primary documentation. Compared alternatives against the exact assignment constraints. Feasibility conclusions and stack selection are explicitly engineering judgments; no benchmark or production certification is claimed.
