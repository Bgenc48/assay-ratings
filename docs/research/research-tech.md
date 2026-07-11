# Technical Architecture & Build Plan — Token Trust-Rating Service

Research scope: v1 architecture, cost model at 3 scales, monitoring layer, MVP cut, and automation limits. Grounded in a read of the ATA repo (`/home/user/ATA-Coin`) and current (July 2026) pricing for RPC providers, explorer APIs, market-data APIs, and Claude models.

---

## 0. Reuse assessment: what the ATA repo actually gives you

Total relevant code is ~1,500 lines. Verdict: **the patterns are the seed of the verification engine; the code itself is scaffolding (~300–500 directly liftable lines).** ATA's code reads a *known* deployment (fixed addresses, known ABIs from a committed JSON record). The rating product must handle *arbitrary hostile tokens* — unknown ABIs, proxies, fee-on-transfer weirdness — which is a different problem. What transfers:

| Asset | Path | Reuse |
|---|---|---|
| Fallback multi-endpoint RPC client (viem, 5 public Base endpoints, 5s timeout) | `/home/user/ATA-Coin/mcp/src/chain.ts` | Lift directly; this is exactly the free-RPC resilience layer the scanner needs |
| Hand-rolled batched `eth_call` with `eth_chainId` verification + endpoint failover, zero deps | `/home/user/ATA-Coin/site/js/rpc.js` | Lift directly for the scanner's batch reads — one HTTP round-trip per ~30 calls is the core cost lever |
| 4-byte selector table with CI cross-check vs viem | `/home/user/ATA-Coin/site/js/abi.js` | Pattern reuse; the rating product needs a much larger selector registry (mint, blacklist, setTax, pause…) |
| Single-batch full-state read of token + vesting wallets | `/home/user/ATA-Coin/site/js/chain.js` | Template for the per-token "full scan" function; note its zero-supply sanity check (treat empty `eth_call` returns as RPC failure, not data) — that defensive pattern matters for a product that must never publish garbage |
| Config-vs-chain cross-check (`matchesPublishedConfig` in `get_supply`) | `/home/user/ATA-Coin/mcp/src/tools.ts` | **This is the docs-vs-chain truth engine in miniature.** Generalize: claimed value (from docs) vs observed value (from chain) → verdict |
| Markdown transparency-report generator from on-chain state | `/home/user/ATA-Coin/scripts/report.ts` | Template for auto-generated per-token evidence reports |
| MCP server (7 read-only tools, zod schemas) | `/home/user/ATA-Coin/mcp/src/*.ts` | Reuse wholesale later as a "trust-rating MCP server" — a real distribution channel to AI agents |
| Static-site + GitHub Pages CI (`pages.yml`), site-data export script | `/home/user/ATA-Coin/.github/workflows/`, `/home/user/ATA-Coin/scripts/export-site-data.ts` | The "cron job writes JSON → static site renders it" architecture is exactly the recommended v1 shape |

New build (no ATA equivalent): claims/LLM pipeline, scoring engine, proxy detection, LP-lock detection, holder analysis, storage layer, alerting.

---

## 1. v1 Architecture

### 1.1 Data sources (per check, cheapest-first)

| Check | Primary source | Notes / fallback |
|---|---|---|
| ERC-20 metadata, totalSupply, `owner()` | Batched `eth_call` on public Base RPCs (reuse `rpc.js` pattern) | Alchemy free tier (30M CU/mo, ~26 CU per eth_call ≈ 1.1M calls/mo) as the reliable fallback when public endpoints flake |
| Proxy/upgradeability | `eth_getStorageAt` on EIP-1967 slots: implementation `0x360894a1…382bbc`, admin `0xb53127…5b6103`, beacon slot; plus `eth_getCode` delegatecall scan | If admin is a contract, read Safe `getOwners()/getThreshold()` and Timelock `getMinDelay()` — "who can upgrade and how fast" is the real score input |
| Mint/blacklist/tax functions | Verified source from **Etherscan V2 API** (`chainid=8453`, one key covers Base + all Etherscan-family chains; free tier 5 calls/s, 100k calls/day) | Fallback for unverified contracts: bytecode selector scan (`mint(address,uint256)` = `0x40c10f19`, etc.). Note: July 2026 free-tier cuts (max records/request 10,000→1,000) affect deployer-history endpoints — plan around it |
| Pools, liquidity USD, volume, token profile links | **DexScreener free API** (no key; ~300 req/min pair endpoints, 60 req/min profiles) | GeckoTerminal public API (30 calls/min) and CoinGecko Demo key as backups; DexScreener's `token-pairs` response also gives you the project's website/socials URLs — the crawl seed for the claims engine |
| LP lock | Read LP token: `balanceOf(0xdead)`, `balanceOf(0x0)`, `balanceOf(<locker>)` vs LP `totalSupply()` for v2 pools; for Uniswap v3/v4, check position-NFT `ownerOf` against locker addresses | Requires a **curated locker registry** (UNCX v2/v3/v4, Team Finance, PinkLock… addresses per chain) — a small, high-value dataset you maintain in-repo; unlock *dates* come from per-locker `getLock` views |
| Holder concentration | **Base Blockscout** free API (`base.blockscout.com`, `/api/v2/tokens/{hash}/holders`) | Etherscan top-holders is a Pro endpoint; Blockscout is free. Exclude pools/lockers/bridges via your own contract-label list |
| Honeypot / buy-sell tax | **GoPlus Token Security API** (free tier, broad EVM coverage; batch queries are paid-tier) | Treat as advisory input, never sole evidence; optional v2: own swap simulation via `eth_call` |
| Admin events, team-wallet moves | `eth_getLogs` with address arrays + topic filters (`OwnershipTransferred`, `Upgraded`, `AdminChanged`, `Transfer` from tagged wallets) | One getLogs call covers hundreds of watched addresses per topic — this is the cheap monitoring primitive |
| Docs/whitepaper | Plain `fetch` + HTML→markdown (Readability/turndown); PDF via text extraction | Playwright for JS-rendered sites is a v2 concern; cap crawl at ~10 pages / ~50k tokens per project |

**Skip Ponder/indexers at v1.** An indexer earns its keep when you need chain-wide historical event coverage (firehose tier, §2 scale 3). For 100–10k tokens, targeted `eth_getLogs` + explorer APIs are 10–100× cheaper to run and zero-ops.

### 1.2 Component layout (TypeScript monorepo, pnpm workspaces)

```
trustrating/
  packages/core        # verifier registry, types, scoring engine (pure functions, versioned)
  packages/chain       # rpc batch client (from ATA), selector registry, locker/label registries
  packages/claims      # crawl -> extract -> verify -> judge pipeline (Anthropic SDK)
  apps/scanner         # cron entrypoint: full scan / delta scan / claims run; writes SQLite + JSON
  apps/site            # Astro static site reading built JSON (grade pages, evidence, methodology)
  apps/alerts          # (v2) watcher loop + Telegram/webhook fan-out
  data/                # git-committed: registries, scan outputs, score history
```

**Scoring engine:** deterministic pure function `score(checkResults) -> {dimensions, letterGrade, caps[]}`, with `methodology_version` stamped on every result. Dimensions (L2Beat-style): Supply Integrity, Ownership & Upgradeability, Liquidity Safety, Distribution, Transparency (docs-vs-chain), Track Record. Hard caps, not averages: e.g., "active EOA-controlled upgradeable proxy ⇒ grade ≤ D regardless of other dimensions." LLMs never touch the math — this is what makes "unpurchasable algorithmic scores" defensible.

**Claims engine (the differentiator):**
1. **Crawl** — site + linked docs → markdown corpus, content-hashed (re-run only on hash change).
2. **Extract** — one LLM call, structured output (`output_config.format` json_schema): `{claim_text, source_url, category, checkable: onchain|offchain|unverifiable, params:{amounts, dates, addresses}}`. Use a frozen system prompt + schema with prompt caching (reads ≈ 0.1× input price).
3. **Verify** — deterministic TS: a registry maps claim categories → chain verifiers; each returns `{status: verified|contradicted|unverifiable, evidence:[{type, address, slot/tx, value}]}`. No LLM in this step.
4. **Judge/explain** — second LLM call grades the gap given evidence and writes the human-readable rationale + confidence. Model split: **Haiku 4.5 for extraction, Sonnet for judging**; run via the **Batch API (−50%)** since nothing here is latency-sensitive.
5. **Store** claims + verdicts + evidence with timestamps → this corpus is itself a moat asset.

**Storage:** SQLite (better-sqlite3 or Drizzle) — a single file, snapshot into git/R2. Genuinely sufficient to ~10k tokens including score time series. Postgres (Neon/Supabase free → paid) only when you need concurrent writers or the firehose. Don't start with Postgres; it's ops you don't need.

**Deployment recommendation (in order):**
- **v1 (weeks 1–6): GitHub Actions cron + static site.** Scanner runs on schedule in Actions (free for public repos; 2,000 min/mo free for private), commits JSON + SQLite snapshot, Cloudflare Pages (free) serves the site; static JSON files under `/api/v1/token/<address>.json` *are* the free "API". Bonus that fits the credibility posture: **a public pipeline repo makes every score git-timestamped and reproducible** — nobody can accuse you of retroactively editing grades, and the track record accrues in an auditable medium.
- **v2 (monitoring): Cloudflare Workers Paid ($5/mo — 250 cron triggers, no duration limit on crons, D1 included ~10GB/db) or a Hetzner CX22-class VPS (~€4/mo).** The VPS wins if you want WebSocket RPC subscriptions and long-lived processes; Workers wins on zero-ops. Either is fine; don't agonize.

---

## 2. Cost model at three scales

Base produces a block every 2s (43,200 blocks/day). A **full scan** ≈ 25–40 RPC calls + 4 HTTP API calls per token (≈ 3–6 batched requests). A **delta scan** via shared `eth_getLogs` ≈ 1–2 calls per token-day amortized (address-array filters cover ~hundreds of tokens per call), plus periodic slot re-reads.

Claude pricing used (current): Haiku 4.5 $1/$5 per MTok in/out; Sonnet 4.6 $3/$15 (Sonnet 5 intro $2/$10 through 2026-08-31); Batch API −50%; cache reads ≈0.1×. Per-token doc analysis (≈30k tokens docs in + 8k judge in, ~4k out total): **Sonnet everywhere ≈ $0.18; Haiku-extract + Sonnet-judge ≈ $0.10; same via Batch API ≈ $0.05–0.09.**

### Scale A — 100 tokens (MVP)
- RPC: daily full rescan = ~3,000 calls/day ≈ 90k/mo → trivially inside public RPCs alone; Alchemy free (30M CU ≈ 1.1M eth_calls/mo) as backstop. **$0**
- Explorer/market APIs: ~200 Etherscan + ~200 DexScreener calls/day → all free tiers. **$0**
- LLM: 100 initial analyses ≈ **$10–20 one-time**; re-runs on doc-change (~20%/mo) ≈ **$2–5/mo**
- Infra: GH Actions + CF Pages free; domain ~$10/yr.
- **Total: ≈ $5/mo.**

### Scale B — 10,000 tokens
- RPC: naive per-token polling would be ~150k calls/day (~4.5M/mo ≈ 117M CU ≈ $50/mo at Alchemy PAYG $0.45/M CU). With getLogs-based deltas + weekly (not daily) full rescans, realistic load is 15–30M CU/mo → **$0–25/mo** spread across Alchemy free + public pool.
- Explorer APIs: source fetches happen once per token at onboarding (~300/day for a growing universe) — inside Etherscan free 100k/day. Blockscout holder calls ~10k/wk — fine. **$0**
- LLM: assume ~30% have real docs → 3,000 analyses. Onboarding backlog ≈ **$150–300 one-time** (Batch, Haiku/Sonnet split); steady state (new tokens + changed docs ~10%/mo) ≈ **$30–80/mo**.
- Infra: Workers Paid $5 or VPS €4–8; SQLite still fine; R2 storage cents.
- **Total: ≈ $50–150/mo.**

### Scale C — 500,000 tokens (memecoin firehose)
Polling is no longer viable; the architecture flips to **streaming ingestion**: subscribe/index factory events (`PairCreated`/`PoolInitialized`), token creations, and a topic-filtered log stream for watched addresses.
- Chain access: either (a) dedicated Base full node (4TB+ NVMe box, **$200–400/mo** on Latitude/OVH-class hardware, plus your ops time) + Ponder/Shovel indexing selected topics, or (b) a paid growth tier at Alchemy/QuickNode (**$50–300/mo** depending on log volume). Start with (b); (a) only when provider bills exceed ~$400/mo.
- Storage: Postgres required (event archive + score series); managed **$25–70/mo** or on the node box.
- LLM: **do not run the claims engine on 500k tokens** — the overwhelming majority have no docs. Gate it: full claims analysis only above a liquidity threshold (~$50k → roughly 5–15k tokens; same cost as Scale B). The firehose gets a chain-only **provisional grade** (zero LLM cost). Optional: Haiku-batch triage of every newly *verified* contract (~500/day × 10k tokens ≈ $2.50/day ≈ **$75/mo**).
- Etherscan free tier (100k/day) may pinch on source fetches at peak memecoin issuance; Blockscout + own node fill the gap before paying for Etherscan Pro (~$199/mo).
- **Total: ≈ $400–1,200/mo.** This is the scale at which the product must be revenue-bearing.

---

## 3. Monitoring / alerting layer

**Model: watchlist + two clocks.**
- **Event clock (1–5 min cron):** for the union of watched addresses, run `eth_getLogs` over the elapsed block range with topics `OwnershipTransferred`, `Upgraded`, `AdminChanged`, `RoleGranted`, and `Transfer` where `from` ∈ tagged team/treasury wallets. A handful of calls covers thousands of tokens. Base's 2s blocks mean a 60s poll gives "alert within ~2 minutes" — sufficient for v1/v2; true sub-block latency (WebSocket `eth_subscribe`) is a VPS-only v3 feature.
- **Calendar clock (daily):** no RPC needed — unlock timestamps and vesting cliffs are captured at scan time; fire T-30d / T-7d / T-24h warnings, and verify execution after the deadline passes (did the lock get extended, or pulled?).

**Severity taxonomy:** CRITICAL (upgrade executed; ownership → fresh EOA; mint event; LP unlock executed + liquidity pulled; team wallet moves >X% supply) → immediate fan-out and grade recompute. WARN (lock expiry approaching; docs changed materially; vesting cliff imminent). INFO (score recomputed, new pool).

**Fan-out channels:**
- **Telegram bot** (grammY, free): the paid product surface. Free tier = grade-change alerts on 3 tokens; paid = unlimited watchlist + CRITICAL/WARN granularity. Gate via Stripe payment links — no accounts system needed initially.
- **X bot**: the *marketing* surface, not the product — public CRITICAL alerts ("$XYZ owner just transferred to fresh EOA, grade C→F, evidence: tx 0x…") are the growth loop. Budget note: X API free tier is ~500 posts/mo (enough for CRITICAL-only); the ~$200/mo Basic tier only when volume demands (verify current X pricing before building — it changes often).
- **Webhooks** (paid API tier): HMAC-signed JSON, retries with backoff, delivery log; a jobs table in SQLite/D1 + the same cron is enough — no queue infra until real customers.

Every alert embeds evidence links (Basescan tx/slot) and the score delta — alerts *are* the track-record time series, so persist them all.

---

## 4. Scope cuts

### MVP — ships in 4–6 weeks of solo + Claude Code work
- **Chain: Base only.** Cheapest, founder home turf, one Etherscan V2 key, Blockscout available, underserved by incumbent raters vs ETH mainnet.
- **Launch set: 200–500 tokens** (top Base tokens by DexScreener liquidity + ATA + any requested). 50 looks thin; 5k can't be QA'd.
- **Six automated checks:** (1) supply/mint risk (totalSupply, mint selectors, owner/renounce state); (2) upgradeability (EIP-1967 + who-controls: EOA/Safe/timelock); (3) liquidity safety (% LP burned/locked, locker identity, unlock date, depth USD); (4) holder concentration (top-10 non-contract wallets via Blockscout, with pool/locker exclusions); (5) honeypot/tax (GoPlus, marked advisory); (6) **docs-vs-chain lite** — crawl site, extract only five claim types (liquidity locked / renounced / vesting / fixed supply / audited), auto-verify the ones mapping to checks 1–5, publish a per-token claims table with verdicts. #6 in even reduced form is the launch story: nobody else ships it.
- **Delivery: static site + static JSON files, no API server, no accounts.** GH Actions daily cron; methodology page v0.1 published; every check links to raw evidence.
- **Week-by-week:** W1 monorepo + chain package + checks 1–3 against 10 hand-picked tokens (golden-file tests, ATA as a known-good fixture). W2 checks 4–5 + scoring engine + methodology doc. W3 claims pipeline happy path. W4 site + 300-token batch scan + manual QA of top 50. W5 cron, rescan diffing, Telegram bot (own use/beta). W6 polish + launch content: five "trust-gap reports" on known Base tokens where docs contradict chain.

### v2 — months 2–4
Monitoring loop on Workers Paid/VPS with the alert taxonomy; paid Telegram tier + Stripe; X bot; add Ethereum + one more EVM L2 (same code path — resist Solana, it's a full second stack); request-a-rating intake; historical grade charts; vesting-compliance tracker (needs a per-token vesting registry — semi-manual); real API with keys.

### Moat build-out — months 4–12
(a) **Track-record database** — score/event time series that competitors cannot backfill; (b) **labeled claims corpus** (claims → verdicts → outcomes) — eval/training data nobody else has; (c) locker + contract-label registries as maintained public goods; (d) firehose tier with provisional grades (coverage moat); (e) **trust-rating MCP server** (port ATA's `mcp/`) so AI agents consume grades natively; (f) embeddable grade badge (L2Beat-style) for backlink distribution.

---

## 5. What cannot be automated reliably (honest limits)

1. **Off-chain claims are extractable but not verifiable.** Team identity, partnerships, CEX listings, legal entities, revenue, "backed by" — the LLM will find these claims; nothing on-chain confirms them. They must surface as `unverifiable` (a transparency signal), never as verified/contradicted. Expect >50% of extracted claims in this bucket.
2. **Audit claims are a trap.** Checking "audited by X" requires confirming the report exists on the auditor's own site (semi-automatable, brittle) *and* judging auditor quality (pure human judgment). Fake-audit PDFs are common. Score only "audit link resolves on auditor domain," nothing stronger.
3. **Team-wallet identification is heuristic and wrong often.** Deployer + initial-distribution graph tagging has meaningful false-positive rates (CEX hops, fresh wallets, OTC). A false "team is dumping" alert is reputationally and legally the worst failure mode. Require two independent signals before a CRITICAL wallet alert; label confidence.
4. **Vesting compliance only works for on-chain vesting.** Many "4-year vest" promises are spreadsheets + custodial wallets. You can monitor outflows from *claimed* vesting wallets, but the mapping claim→wallet is often manual. ATA-style transparent vesting is the exception, not the rule — which is exactly the point of the product, but say so.
5. **LLM extraction failure modes:** puffery vs claims ("ultra-safe liquidity" isn't checkable — needs a checkability classifier); temporal ambiguity ("locked for 1 year" — from when?); stale docs (lock expired and re-locked elsewhere → false "contradicted"); wrong-token confusion (multi-chain deployments, v2 migrations — verifying the wrong address produces confidently wrong verdicts — anchor every claim to the contract address the *project itself* publishes); vesting schedules that exist only as images (needs vision input, ~3× token cost).
6. **Chain-check false positives:** upgradeable proxy ≠ malicious (score the *control*, not the pattern); unverified source is the default state of young tokens; an unknown locker in your registry gap reads as "unlocked" — dangerous. **Design rule: registry gaps and RPC failures must surface as `insufficient data` (grade capped but labeled "unverified"), never silently as the worst case.** GoPlus/honeypot verdicts inherit a third party's error rate — always attribute.
7. **Human review is structurally required for:** the bottom grades (D/F) on any token above ~$1M liquidity before publication (defamation exposure — pair with published methodology + dispute process + evidence-first UI); the deep-dive paid reports (by design); methodology changes; and locker/label registry additions. Budget ~2–4 founder-hours/week at MVP scale for QA — this is the real bottleneck, not compute.

---

### Key sources
- [Alchemy pricing / free tier (30M CU/mo, PAYG $0.45/M CU)](https://www.alchemy.com/pricing), [free tier details](https://www.alchemy.com/support/free-tier-details)
- [Etherscan API rate limits (free: 5/s, 100k/day)](https://docs.etherscan.io/resources/rate-limits), [free-tier coverage changes](https://info.etherscan.com/whats-changing-in-the-free-api-tier-coverage-and-why/), [Blockscout vs Etherscan comparison 2026](https://www.blog.blockscout.com/blockscout-vs-etherscan-api-free-tier-pricing-rate-limits-compared-2026/)
- [DexScreener API reference (300 rpm pairs / 60 rpm profiles, keyless)](https://docs.dexscreener.com/api/reference)
- [GeckoTerminal API (30 calls/min public)](https://apiguide.geckoterminal.com/), [CoinGecko on GeckoTerminal API](https://support.coingecko.com/hc/en-us/articles/22612838274841-Does-GeckoTerminal-have-an-API)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [limits (250 crons paid / 5 free)](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits (10GB/db)](https://developers.cloudflare.com/d1/platform/limits/)
- [UNCX liquidity lockers docs (V2/V3/V4)](https://docs.uncx.network/guides/for-projects/liquidity-lockers-v3), [UNCX v3 locker contracts (GitHub)](https://github.com/uncx-network/liquidity-locker-univ3-contracts)
- [GoPlus Security API overview](https://docs.gopluslabs.io/reference/api-overview), [Token Security API](https://gopluslabs.io/en/token-security-api)
- [Base block building (2s blocks)](https://docs.base.org/base-chain/network-information/block-building), [Base RPC providers 2026](https://chainstack.com/base-rpc-providers-2026/)
- Claude model pricing from the bundled claude-api reference (cached 2026-06): Haiku 4.5 $1/$5, Sonnet 4.6 $3/$15, Opus 4.8 $5/$25 per MTok; Batch API −50%; cache reads ≈0.1×.