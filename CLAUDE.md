# CLAUDE.md — Assay (assayratings.com)

Independent trust ratings for tokens: one letter grade for the gap between
what a project promises and what its blockchain proves. This file is the
working guide for AI-assisted development sessions in this repository.

## What this repository is

A **rating agency**. Every line of code here can end up publishing a factual
claim about someone else's contract. The invariants below are not style
preferences — several are load-bearing for the product's legal posture and
credibility. Read `docs/METHODOLOGY.md` before touching scoring.

## Commands

```bash
npm install --ignore-scripts   # always --ignore-scripts (supply-chain rule)
npm test                       # full suite (~45 tests, all offline, <10s)
npm run scan:offline           # entire pipeline on recorded fixtures (no network)
npm run scan                   # LIVE scan — what CI runs; needs network
npm run discover               # grow registry/discovered.json from top Base pools
npm run lint:site              # honesty lint: hype language, CSP, external origins
npm run build:site             # assemble _site/ (site shell + data + badges + sitemap)
npm run mcp                    # stdio MCP server (read-only, answers from data/)
npm run extract-claims -- base 0x… https://project-site   # needs ANTHROPIC_API_KEY
node apps/scanner/fixtures/make-fixtures.js               # regenerate fixtures
```

## Layout

| Path | What | Notes |
|---|---|---|
| `packages/core` | Scoring engine: 8 dimensions, hard caps, letters, badges | Pure functions; `METHODOLOGY_VERSION` in `src/version.js` |
| `packages/chain` | Batched JSON-RPC (chainId-verified, endpoint failover), ABI helpers, checks, registries | Zero dependencies, hand-auditable |
| `packages/claims` | Claim schema, deterministic verifiers, optional LLM extractor | Verdicts are computed, never authored |
| `apps/scanner` | Batch runner + alert diff engine + discovery + fixtures | `run.js` holds the publication gates |
| `apps/mcp` | Read-only MCP server for AI agents | Only workspace with npm dependencies |
| `registry/` | `tokens.json` (hand-curated), `discovered.json` (auto), `claims/` | Changes by reviewed PR only |
| `data/` | Scan output: `index.json`, `tokens/`, `history/` (append-only), `alerts.json` | Written by CI; treat as append-only record |
| `site/` | Static site, strict CSP, zero external origins | `CNAME` = assayratings.com |
| `.github/workflows` | `test.yml`, `scan.yml` (daily cron + deploy), `pages.yml` | Actions SHA-pinned |

## Invariants (violating any of these is a bug, not a choice)

1. **No LLM in any scoring or verdict path.** LLMs may extract claims
   (`packages/claims/src/extract.js`); extracted drafts are `review:
   "pending"` and inert until a human flips them to `"approved"` in a
   reviewed commit. Verdicts come from `verify.js` chain checks only.
2. **Missing data is never the worst case.** Unreadable state → `null` →
   dimension N/R → lower *coverage*, never a lower score. Unknown lockers
   get no credit; unanalyzable pools read "insufficient data", never "safe".
3. **F requires positive evidence.** An EOA-classified mint controller caps
   at F; an *unclassifiable* mint gate caps at C as insufficient data. Never
   auto-F on absence of information (the AERO lesson — see git history at
   `d11a349`).
4. **Publication gates live in `apps/scanner/src/run.js`:** registry
   symbol-mismatch publishes nothing; computed D/F on >$1M-liquidity tokens
   publishes as `UR` until `reviewedLowGrade: true` lands by reviewed PR;
   `coi: true` entries (ATA Coin) publish facts but never a letter grade —
   permanently.
5. **Calibrated language.** Findings and alerts state what the chain shows
   ("no lock found at the stated address as of this scan"), never intent
   ("scam", "lied", "rug"). This is the defamation posture; it is tested.
6. **Methodology changes are versioned.** Any change to weights, anchors,
   caps, or verdict semantics requires — in the same PR: semver bump in
   `packages/core/src/version.js`, changelog entries in both
   `docs/METHODOLOGY.md` and `site/methodology.html`, and updated golden
   tests in `packages/core/test/scoring.test.js`. The golden tests encode
   the famous-token sanity checks; if one moves, the change is wrong or the
   version bumps.
7. **No Etherscan API anywhere** (its ToS bans commercial/AI use). Chain
   data comes from public JSON-RPC + Blockscout + DexScreener only. Any new
   data source needs a license check first.
8. **Zero runtime dependencies in scanning/scoring paths** (`apps/mcp` is
   the sole exception). `--ignore-scripts` always. Actions stay SHA-pinned.
9. **Site rules:** every page carries the CSP meta; all dynamic content via
   `textContent` (claim quotes originate on hostile third-party sites); no
   external scripts/styles/fonts; no affiliate links, purchase buttons, or
   token-picking lists — `npm run lint:site` enforces the honesty rules and
   runs in CI.
10. **`data/history/` and `docs/CORRECTIONS.md` are append-only.** Never
    rewrite either; the un-backfillable record is the moat and the brand.

## How the pipeline fits together

```
registry/*.json ─► run.js ─► scan.js ─► inspectToken/Liquidity/Holders (chain pkg)
                     │            └────► verifyClaims (claims pkg)
                     │            └────► scoreToken (core pkg)  ← pure, versioned
                     ├─► publication gates (mismatch / UR review / COI)
                     ├─► data/tokens + data/index + data/history (append)
                     └─► computeAlerts(prev, current) ─► data/alerts.json
scan.yml (daily 05:17 UTC): discover → scan → notify (Telegram, gated) → commit → deploy Pages
```

Offline mode (`--offline`) replays `apps/scanner/fixtures/recorded.json`
through the identical code path and writes to `apps/scanner/fixtures/out/`
(gitignored) — fixture tokens can never leak into published data.

## Common tasks

- **Add a token:** append to `registry/tokens.json` with `chain`, `address`,
  `expectSymbol`, `name` (+ `notes` for custodial/bridged assets). The PR
  description must cite the official source of the address. The symbol gate
  protects against typos at scan time.
- **Confirm an Under-Review grade:** verify the findings in
  `data/tokens/<slug>.json` against the chain, then set
  `"reviewedLowGrade": true` on the registry entry via PR. Never confirm
  without independently checking the evidence.
- **Approve claims:** run the extractor (or hand-write records per
  `packages/claims/src/schema.js` — verbatim `quote` and `source` URL are
  mandatory), check each quote against the live page, flip `review` to
  `"approved"` in a PR.
- **Add a locker/label:** `packages/chain/registries/*.json`, with the
  audit/deployment evidence cited in the PR. A wrong locker entry converts
  "unlocked" into "locked" — the exact failure this product exists to catch.
- **Raise coverage:** `DISCOVER_MAX_TOTAL` env (default 300) in `scan.yml`.
  Mind public-RPC budgets; see the cost model in `docs/research/research-tech.md`.
- **Debug a live-scan failure:** check the Scan workflow logs; failed tokens
  keep last-good data labeled `stale`, so nothing user-facing breaks while
  you investigate.

## Context

- Founding research: `docs/research/*.md` (methodology, market, tech,
  business, legal, naming) and the venture plan PDF in `docs/`.
- Owner instructions (non-technical): `docs/OWNER-GUIDE.md`.
- The operator founded ATA Coin; the COI carve-out (`docs/COI-POLICY.md`)
  is permanent. Related repo: `Bgenc48/ATA-Coin` (the chain-reading
  patterns here originated there).
