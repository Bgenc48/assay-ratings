# Corrections Log

Every published correction to a factual statement in an Assay report is
recorded here, permanently, newest first. An empty log is only a good sign
while the token count is small; the goal is honest accounting, not a
spotless page.

<!--
## YYYY-MM-DD — TOKEN (chain:address)
- **What was wrong:** …
- **How it was caught:** dispute #NN / internal review / automated check
- **What changed:** report field(s), grade X → Y (if any)
- **Root cause & prevention:** …
-->

## 2026-07-11 — USDC, cbETH, cbBTC, FUN, MORPHO (base)
- **What was wrong:** the first alert-enabled scan published five CRITICAL
  "Contract implementation changed: none → 0x…" records in the Changes
  feed. No upgrades occurred — the previous reports simply predated the
  `proxyImplementation` field, and the alert engine misread the field's
  first appearance as a change.
- **How it was caught:** internal review of the feed within minutes of the
  scan, before any downstream consumption. No Telegram delivery occurred
  (secrets not yet configured); the records were public in the repository
  and site data for under one hour.
- **What changed:** the five records were removed from `data/alerts.json`
  and `data/alerts-latest.json`. No grades were affected.
- **Root cause & prevention:** the engine now requires a known previous
  implementation before emitting an "upgraded" alert; schema-field
  first-appearance establishes a baseline instead. Regression test added
  (`apps/scanner/test/alerts.test.js`).
