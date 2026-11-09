# Assignment compliance audit

Scope: the technical assessment screenshot supplied by the user. Extra product features are deferred; see the separate [replay proposal](NEXT_FEATURE.md).

| Assignment requirement | Implementation | Evidence / qualification |
| --- | --- | --- |
| Mock `GET /getTrades` | Full seeded JSON export; paginated extension on the same endpoint | Browser API check receives 5,000 rows; unit check proves pages reconstruct the identical full batch. |
| A few thousand seeded trades | 5,000 trades per batch, 6 symbols, 120 mock clients | Deterministic seed and unique-ID unit checks pass. |
| Trade ID, client, symbol, quantity, price, timestamp | `id`, `client`, `symbol`, `quantity`, integer `pricePaise`, ISO UTC `timestamp`; plus side | Shape validation and documented currency/time representation. No real BSE data is claimed. |
| Configurable delay up to 15 minutes | `delayMs` / `MOCK_DELAY_MS`, validated from 0 through 900,000 ms | A real full-duration run completed in 900,963 ms, publishing exactly 5,000 additional trades with no duplicate IDs. [Recorded evidence](evidence/full-pull-verification.json). |
| Dashboard consumes the mock API | Background importer calls bounded `/getTrades?batch=...&page=...` reads | Published trades come from the fetched and validated pages; the browser reads the committed view. |
| Dashboard opens with already-pulled trades during a pull | Separate committed table and private staging pages | Browser scenario opens a third tab during a running import and sees all previous trades; staged rows do not leak into totals. |
| Automatic completion without refreshing | Authoritative WebSocket snapshot after the SQLite transaction | Three open dashboards receive the completed 5,000-record batch without reload. |
| No polling loop | No browser trade/status polling; no background job-status polling | Captured browser traffic during the import has no repeated read/status requests. The data-page loop fetches actual records, and WebSocket heartbeat only tests transport liveness. |
| No cron job / scheduler | Request acceptance and application startup wake the durable consumer | No scheduled data fetch or job scan is used. |
| Survive the 30-second HTTP limit | Short HTTP acceptance; bounded data-page requests; separate upgraded WebSocket transport | A slow 35-second full request is cut off while the same-duration paginated import succeeds. See the necessary upstream assumption below. |
| One Git repository with setup README | Local Git repository, lockfile, scripts and README | Node/npm setup, production startup, configuration, API and verification commands are documented. |
| Short architecture note and diagram | `docs/ARCHITECTURE.md` | Sequence diagram, consistency guarantees, recovery behavior, design rationale and limits. |

## Necessary upstream-contract assumption

This is the one point that must be explicit in a submission: **an unchanged blocking 15-minute HTTP response cannot complete over a network that terminates it at 30 seconds.** Moving that same call into a background job does not fix the upstream connection.

The repository therefore preserves the requested slow mock endpoint but adds immutable-batch pagination for the importer. Fifty 100-record responses split a 15-minute pull into 18-second data requests, with a 25-second client timeout and an enforced 30-second HTTP cutoff. WebSocket upgrades must also be permitted.

The implementation meets the operational behavior with that documented extension. It should not be described as supporting an unchanged real BSE API that only provides one blocking 15-minute response. If the assessor requires that exact upstream contract, pagination, async export/callback support or a network exception needs agreement first.

## Reliability checks beyond the minimum

- Primary-key deduplication, one active import slot and atomic publication.
- Saved page/cursor transactions and a real process crash/restart integration test.
- Bounded upstream retries and corrupt-page rejection without losing committed trades.
- Browser response-ordering regressions: newer live data must win over an older HTTP error or acceptance response.
- Responsive light/true-black UI, vendored liquid glass with licence, keyboard-accessible custom controls, and mobile scrolling without visible scrollbars.

The full executed test record and remaining limits are in [VERIFICATION.md](VERIFICATION.md). No additional product feature is bundled into this baseline audit.
