# Proposed next feature: Trading Session Replay

**Proposal only. The assignment and its reliability checks come first; this feature is not implemented in the current version.**

Turn the saved trade history into a reviewable session. A reviewer can play the session, pause on a moment, and scrub through time while the totals, chart and trade list stay synchronized.

## One coherent workflow

- **Play, pause and change speed:** review the mock session in a short demonstration instead of watching hours of trade timestamps.
- **Scrub to a moment:** inspect only trades that existed at the chosen point in the session.
- **Focus on a symbol or client:** follow a particular participant without changing the imported source data.
- **Jump to a notable trade:** mark the largest fills with their actual quantity, price and notional; explain the marker rather than presenting a prediction.
- **Return to the current dashboard:** clearly distinguish historical replay from the complete saved dataset, while background imports continue normally.

## Why this fits

The assessment asks for ingestion and automatic updates. Replay adds a visible, useful review workflow on top of those same records and makes the demonstration more memorable. It needs no external market feed, model, paid API or extra infrastructure. Its calculations remain reproducible from the seeded data.

## Small implementation boundary

Use a separate replay view derived from the committed read model. Keep the live importer and WebSocket subscription unchanged. One playhead determines the visible trade subset; every replay chart, total and table derives from that subset. The playhead must never change stored records or imply that historical prices are live prices.

Acceptance checks: pause stops time; scrubbing is deterministic; symbol/client filtering is consistent across all displayed figures; large-trade markers match real records; entering/leaving replay preserves the live dataset; reduced-motion preferences remain supported.
