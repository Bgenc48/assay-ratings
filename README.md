# Assay — independent trust ratings for tokens

**One letter grade for the gap between what a token project promises and what
its blockchain proves — with the receipts, over time.**

Live site: **[assayratings.com](https://assayratings.com)** (GitHub Pages, this repository).

Assay reads a project's own claims — "liquidity locked", "ownership
renounced", "supply is fixed" — and verifies each against live chain state.
The grade measures whether a token can betray you in ways it hasn't
disclosed. It is not investment advice and does not predict price.

## Why this exists

The token-safety market is crowded at the bottom (free checkbox scanners)
and compromised at the top (issuer-pays scores). Two things nobody ships:

1. **Docs-vs-chain claim verification** — extracting the safety claims a
   project makes in its own marketing and grading the delta against chain
   state, claim by claim, with evidence.
2. **A public behavioral trust time-series** — every scan appends to an
   append-only history per token. Promises kept and broken accumulate into a
   record that cannot be backfilled — by us or by a competitor.

Assay's posture: **open methodology, free grades, no issuer-pays, ever.**
The scoring engine is deterministic and public; the history is
git-timestamped in this repository, so nobody — including us — can quietly
rewrite a grade.

## How it works

```
registry/tokens.json ──► apps/scanner ──► data/tokens/*.json   (evidence-bearing reports)
                              │           data/index.json      (the ratings table)
        chain reads via       │           data/history/*.jsonl (append-only time series)
        public RPCs +         ▼
        Blockscout +      @assay/core    deterministic scoring: 8 dimensions,
        DexScreener       (pure funcs)   hard caps, letter grade, trust badge
                              ▲
registry/claims/*.json ───────┘          claims verified against chain state
(human-reviewed;                         (VERIFIED / FALSE / UNVERIFIABLE /
 LLM drafts are inert)                    FORWARD-LOOKING / STALE)
```

- **`packages/core`** — the scoring engine. Pure functions, versioned
  (`methodology_version` on every result), golden-tested against the
  methodology's own sanity checks. **No LLM ever touches this code path.**
- **`packages/chain`** — batched JSON-RPC with endpoint fallback and
  chain-ID verification, bytecode selector scanning, EIP-1967 proxy
  detection, Safe/timelock classification, LP-distribution and holder
  analysis. Zero dependencies. No Etherscan API anywhere (its terms prohibit
  commercial/AI use); public RPCs + Blockscout + DexScreener only.
- **`packages/claims`** — the claim schema and deterministic verifiers.
  Optional LLM extraction (`npm run extract-claims`, needs
  `ANTHROPIC_API_KEY`) writes `review: "pending"` drafts that are **inert
  until a human approves them in a reviewed commit**. Verdicts are computed
  from chain state on every scan — never authored.
- **`apps/scanner`** — the batch runner. GitHub Actions runs it on a
  schedule (`.github/workflows/scan.yml`), commits the refreshed data, and
  the site redeploys. Offline mode (`npm run scan:offline`) replays recorded
  fixtures so the whole pipeline runs in tests with zero network.
- **`site/`** — the static site. No frameworks, no cookies, no analytics,
  no external scripts; strict CSP on every page; all dynamic content
  rendered via `textContent` (claim quotes originate on third-party sites
  and are never interpreted as HTML). Includes the Changes feed, grade
  histories, live SVG badges (`/badge/<chain>-<address>.svg`), and the
  free-API docs page.
- **`apps/mcp`** — a read-only MCP server so AI agents consume grades
  natively (`npm run mcp`): list_ratings, get_rating, get_claims,
  get_changes, get_history, about_assay.
- **Alerts** — every scan diffs against the previous one and records grade
  moves, cap triggers, controller changes, contract upgrades, and
  claim-verdict flips to `data/alerts.json` (the public Changes feed);
  CRITICAL/WARN alerts go to Telegram when the `TELEGRAM_BOT_TOKEN` /
  `TELEGRAM_CHAT_ID` secrets are set (silently skipped otherwise).
- **Discovery** — `npm run discover` grows coverage from the top-traded
  Base pools (min $100k liquidity, capped via `DISCOVER_MAX_TOTAL`); runs
  before every scheduled scan.

## Safety gates (what keeps a rating site honest)

- **Registry mismatch gate:** every registry entry pins the expected token
  symbol; if the chain disagrees, the scanner publishes *nothing* for that
  entry. A wrong address can never grade the wrong contract.
- **Zero-supply guard:** empty RPC reads are treated as failures, never as
  data.
- **Missing data lowers coverage, never the score** — and never fabricates
  a worst case. Unknown lockers get no credit; unanalyzable pools read
  "insufficient data", not "safe".
- **Failed scans keep the last good report, labeled stale.** No grade is
  ever silently guessed.
- **Calibrated language everywhere:** findings state what the chain shows
  ("no lock found at scan time"), never intent ("they lied").
- **D/F grades on tokens above ~$1M liquidity get human review before
  publication** (see `docs/METHODOLOGY.md`).

## Quickstart

```bash
npm install --ignore-scripts
npm test              # ~45 tests: scoring golden tests, chain mocks, claims, e2e fixtures
npm run scan:offline  # full pipeline against the recorded fixture universe
npm run scan          # live scan (network required) — this is what CI runs
npm run discover      # grow registry/discovered.json from top Base pools
npm run mcp           # read-only MCP server over stdio
npm run build:site    # assemble _site/ (site shell + data + badges + sitemap)
npm run lint:site     # honesty lint: no hype language, CSP present, no external origins
```

## Repository layout

```
packages/core      scoring engine (dimensions, caps, grades, badges)
packages/chain     RPC client, ABI helpers, checks, registries (endpoints/lockers/labels)
packages/claims    claim schema, deterministic verifiers, optional LLM extractor
apps/scanner       batch scanner + recorded fixtures + e2e tests
registry/          tokens.json (scan list) + claims/ (human-reviewed claim records)
data/              scan output: index.json, tokens/, history/ (append-only)
site/              static site (assayratings.com) — CNAME lives here
docs/              methodology, policies, go-live runbook, founding research
scripts/           build-site.mjs, site-lint.mjs
```

## Policies (binding)

- [Methodology](docs/METHODOLOGY.md) — versioned; changes get changelog entries.
- [Conflict of interest](docs/COI-POLICY.md) — the operator founded ATA Coin;
  ATA is **Not Rated**, permanently, and competitor grades are
  algorithmic-only.
- [Disputes & corrections](docs/DISPUTES.md) — 10-business-day SLA, public
  outcomes, permanent [corrections log](docs/CORRECTIONS.md).
- No issuer-pays. No Assay token, ever. No trading around rating actions.
  No affiliate links to trading venues.

## Status

**Pre-launch.** The pipeline, methodology v0.1, and site are complete; the
first live scan runs when the repository lands on GitHub and Actions is
enabled — see [docs/GO-LIVE.md](docs/GO-LIVE.md) for the runbook.

## License

Code: [MIT](LICENSE). Methodology text and published rating data:
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — attribution
"Ratings by Assay — assayratings.com".
