# Verification record

Environment: Windows, Node 22.23.4, npm 10.9.9. Original assessment: 9 November 2026. Review-tool verification: 10 November 2026.

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`) | Passed |
| ESLint (`npm run lint`) | Passed, no warnings |
| Optimized Next.js production build | Passed |
| Unit/integration suite (`npm test`) | 26 passed |
| Chromium browser suite (`npm run test:e2e`) | 19 passed |
| Coverage of `src/server/{importer,mock,store}.ts` | 99.65% lines, 92.75% branches, 100% functions |
| Production dependency audit (`npm audit --omit=dev`) | Zero vulnerabilities |
| Full dependency audit | Eight moderate findings in the development ESLint/TypeScript ESLint dependency chain, rooted in a minimatch advisory. No high/critical findings. |

## Behavioral evidence

- A real configured **15-minute** import completed in **900,963 ms (15 minutes 0.963 seconds)**. The previously committed 5,000 records remained available during the run; completion delivered an authoritative 10,000-record snapshot with exactly 5,000 new unique trades. The observer used WebSocket events, not status polling. [Recorded evidence](evidence/full-pull-verification.json).

- The slow full export with a 35-second delay is terminated by the simulated 30-second HTTP lifetime.
- During the same test, the 35-second paginated import succeeds. Existing trades remain visible; completion adds exactly 5,000 records to three open dashboards, including one opened during the pull.
- Captured dashboard HTTP traffic contains no repeated trade/status GET requests during that import.
- A browser reconnection test closes the live transport, publishes another batch, and verifies that reconnect restores the correct trade total without browser HTTP polling.
- Parallel pull submissions reuse the same job.
- A staged partial import does not change the read model. Incomplete publication rolls back; failure preserves the committed dataset.
- Closing/reopening the database retains job ID, staged pages and cursor. An importer integration check starts from a saved cursor, skips already-staged pages, and completes the batch. A separate integration test kills an actual server process mid-import, starts a new process against the same temporary database, and verifies a completed 10,000-record snapshot with no duplicate IDs.
- Transient 503 responses are retried; corrupt upstream data marks a job failed without losing saved trades.
- Regression tests verify that a delayed failed initial HTTP read does not override a successful live snapshot, and a delayed HTTP acceptance cannot regress a completed import back to running.
- Search, symbol/side filters, empty-state recovery, pagination, CSV download, persistent theme choice, dialog dismissal and mobile navigation pass browser checks.
- Layout checks show no document overflow at widths 320, 390, 768 and 1440 pixels. The trade table intentionally scrolls within its own container on narrow screens.
- Axe WCAG 2 A/AA and 2.1 AA scans report zero violations on the desktop dashboard in both themes and on the import dialog. These automated scans do not constitute a complete accessibility audit.
- Mobile and desktop screenshots in both themes were inspected. Reduced-motion mode is used for accessibility checks and is supported by CSS and GSAP.

## Liquid-glass UI refinement

- The original `deepika-builds/liquid-glass` source is pinned and vendored with the MIT notice. Browser checks confirm the toolbar receives its SVG filter, displacement maps are generated, and dialog instances are removed when closed.
- Dark mode's body background computes to exactly `rgb(0, 0, 0)`. Translucent neutral panels preserve the glass surface.
- Sidebar navigation is removed; secondary actions are in a compact workspace disclosure and import history starts collapsed. Menu actions, dismissal, history expansion/collapse, home link and full CSV export pass.
- Every selection control is a custom combobox/popover. Arrow keys, Home/End, rapid selection/reopen, typeahead, Enter, Escape, outside dismissal, resize dismissal and dialog layering pass.
- The time header sorts trades in both directions. Symbol-card arrows filter the table, and pagination arrows move and return to the same records.
- Hidden scrollbars preserve native horizontal keyboard scrolling and directional buttons. The discovery cue appears when needed; buttons disable at the real scroll boundaries.
- Additional Axe scans with an open custom dropdown pass in light/dark themes at desktop and mobile widths. The refraction remains decorative, with semantic labels and controls independent of its rendering.

## Visible import activity

- A real 12-second import verifies the animated activity card, enabled **Pull in progress** button, toolbar shortcut, larger progress dialog, continued search, actual percentage updates and dismissible completion with exactly 5,000 added records.
- Closing the WebSocket pauses the busy animation, shows **Reconnecting**, and resumes live progress after transport recovery.
- Mobile checks at widths 320 and 390 pixels find no document overflow. Reduced-motion mode disables the orbit animation; Axe WCAG 2 A/AA and 2.1 AA scans of the mobile card and progress dialog report zero violations.
- Percentages come from acknowledged server pages. The moving activity indicators do not estimate progress or remaining time. The backend and its previously recorded 15-minute verification are unchanged.

## Review tools — 10 November 2026

- Session replay: inclusive seeking, one-minute keyboard navigation, play/pause, speed, restart and return to the saved dataset pass. An import completed during replay without changing its pinned snapshot; exit restored the additional 5,000 records. The local playback clock makes no network requests.
- Trade inspection: exact notional and client navigation pass; opening an execution pauses replay. Symbol price context uses quantity-weighted executed prices, not a simple average.
- Advanced filters: client, exact paise bounds and IST minute ranges are tested. Invalid ranges show errors; saved views restore search, symbol, side and advanced criteria after reload, and can be deleted.
- Session analytics: buy/sell turnover is independently checked against the API dataset; concentration and top-client figures use the current replay/saved scope.
- Import verification: batch-only CSV contains exactly 5,000 unique records from the selected completed mock batch. Duplicate and count mismatch fixtures cannot report reconciliation. This relies on mock batch-prefixed IDs and is not exchange certification.
- All review panels and the detail dialog pass light/dark Axe WCAG 2 A/AA and 2.1 AA scans at 320/390 pixels, with no document overflow. Desktop, mobile and inspector screenshots were reviewed. Mobile turnover totals use stacked rows to keep full currency values readable.
- TypeScript, ESLint, production build and code review pass. The original import/reconnection browser checks remain green. The previously recorded full 15-minute run was not repeated for these frontend additions.

## Deliberate verification limits

- The full 15-minute pull and shorter 35-second cutoff demonstration are verified on the local mock. No claim is made about actual exchange transport behavior.
- No real BSE endpoint, exchange licence, production deployment, external proxy, or real trading workflow was tested. Pagination and permitted WebSocket upgrades remain explicit integration assumptions.
- Tested browser engine: Chromium. No physical iOS/Android device, Safari/WebKit or Firefox check was performed.
- SQLite restart state and importer recovery are tested; host-level failover, filesystem corruption and power-loss fault injection are not.
- The npm audit suggestion to downgrade the Next ESLint configuration across a major release was not applied. The remaining moderate findings affect development tooling; production dependencies audit clean.
