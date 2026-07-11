# Token Trust-Rating Service — Business Model, Pricing, GTM & Financial Plan

Scope: revenue architecture, launch pricing, go-to-market for a solo founder, 12/36-month financials, and year 3–5 end-states. All comparable prices verified via web search July 2026; where a number is approximate or historical it is flagged.

---

## 1. Revenue lines, ranked

### Ranking (by realistic 36-month revenue potential, weighted by fit for a solo founder)

| # | Revenue line | Realistic price points | 36-mo potential | Effort/fit |
|---|---|---|---|---|
| 1 | **API licensing** (wallets, DEX screeners, bots, agents) | $99–$499/mo self-serve; $1k–2k+/mo enterprise | $3k–6k MRR base case | High leverage, slow to start |
| 2 | **Pro subscriptions** (retail/prosumer alerts) | $19–29/mo | $8k–12k MRR base case | First revenue, high churn |
| 3 | **Enterprise deep-dive reports** (human+AI, clearly separated) | $2.5k–7.5k each | $30–50k/yr | Lumpy, time-heavy, LLM leverage helps |
| 4 | **Grants** (Base, Optimism, Gitcoin) | $10k–100k+/yr | Front-loaded, years 1–2 | Very high fit — see §4 |
| 5 | **Embedded widget / attribution deals** | Mostly $0 early; rev-share later | Distribution, not revenue | Strategic, not financial |

**Why API #1.** The strongest evidence that token-risk data has B2B demand at scale is GoPlus: its free Token Security API averaged **~717M calls/month in 2025** (peak ~1B in Feb 2025) — wallets and DEX frontends demonstrably want this data ([CoinDesk research](https://www.coindesk.com/research/protocol-research-goplus-security)). GoPlus gives the base API away free at 30 calls/min and monetizes higher limits (Pro/Ultra/Enterprise packages, batch queries paid-only) plus a $9.90/mo consumer app; total revenue across three product lines was **$4.7M as of Oct 2025** ([docs.gopluslabs.io](https://docs.gopluslabs.io/reference/api-overview), [CMC AI summary](https://coinmarketcap.com/cmc-ai/goplus-security/what-is/)). Token Sniffer (Solidus Labs) prices its scam-scan API at roughly **$99–200/mo** for the self-serve tiers, with enterprise via the HALO platform ([soliduslabs.com/tokensniffer/api](https://www.soliduslabs.com/tokensniffer/api), [Decrypt](https://decrypt.co/123042/token-sniffer-api-solidus-labs-rug-pulls-scams)). Your differentiated angle (claims-vs-chain verdicts + behavioral time series, not just honeypot flags) is *more* valuable per call than GoPlus's checklist, and there is a new 2026 buyer class GoPlus wasn't built for: **AI agents/MCP clients that need a machine-readable trust signal before touching a token**. Nobody prices for that yet; you can.

**Why Pro #2, not #1.** The retail analytics market just repriced downward: Nansen collapsed its Pioneer ($129/mo) and Professional ($999/mo) plans into a single **Pro at $49/mo annual / $69/mo monthly** ([Nansen plans & pricing](https://academy.nansen.ai/articles/1287744-plans-and-pricing), [chainplay review](https://chainplay.gg/blog/nansen-review/)). Messari Pro is **$29.99/mo ($24.99 annual)** ([messari.io/pricing](https://messari.io/pricing)). GoPlus's consumer app is $9.90/mo. Retail willingness-to-pay for "safety" (vs. "alpha") sits at the bottom of that range. Real-time behavioral alerts (LP-lock expiring, admin key changed, vesting wallet moved) are genuinely alarm-worthy and can hold a ~$24/mo price, but the subscriber count a solo founder with no audience can reach in year 1 is small (tens, not thousands).

**Why deep-dives #3.** Market anchors: a simple-token smart-contract audit runs **$5k–15k** in 2026, and continuous monitoring retainers run **$2k–10k/mo** ([Zealynx 2026 pricing](https://www.zealynx.io/blogs/audit-pricing-2026), [Cyberscope](https://www.cyberscope.io/blog/how-much-does-it-cost-to-audit-a-smart-contract)). A trust-gap due-diligence report is not an audit, so price *below* audits: **$2.5k–7.5k** depending on scope. Buyers: funds doing listing/investment diligence, exchanges screening listings, DAOs vetting treasury assets, law firms. Messari's enterprise research (diligence reports on 500+ assets) sells at **$6k–34k/yr** subscriptions ([captainaltcoin](https://captainaltcoin.com/messari-review/)) — evidence institutions pay real money for asset diligence. Constraint: each report costs founder-days even with Claude doing the heavy lifting; treat as margin-rich side revenue, not the engine.

### The "expedited review, published either way" variant — position

**Take: it is clean *in structure*, poisonous *in sequencing*. Do not offer it in year 1; offer it later under hard guardrails, or not at all.**

The structural argument for cleanliness is real: the letter grade is computed by a published algorithm the issuer cannot influence; the fee buys only *queue position* for the human deep-dive; results publish regardless of outcome. That is materially different from the credit-rating issuer-pays pathology, where the issuer can shop for a better *rating* ([Better Markets on issuer-pays conflicts](https://bettermarkets.org/analysis/fact-sheet-credit-rating-agency-conflicts-interest-again-fueling-financial-crisis-0/)). Paying for scheduling ≠ paying for outcome.

But three things break it early: (1) with no reputation, outsiders cannot distinguish "paid for speed" from "paid for score" — the accusation costs you everything and the rebuttal convinces no one; (2) your sales pipeline for expedited reviews becomes issuers, which warps who you talk to and what you build; (3) the first time an expedited-paying project rugs, the headline is "paid-for rating service missed a rug." Meanwhile the whole moat (per differentiator #4) is that scores are unpurchasable — don't spend that asset for what will be <$20k in year-1 revenue.

**Guardrails if introduced later (month 18+, after 500+ unpaid published grades):** flat public price; publication mandatory regardless of result; fee disclosed on the report itself ("expedited review — fee paid by issuer"); the fee never touches the algorithmic grade (which continues to update independently); expedited revenue capped at ~25% of total revenue; no refunds for bad grades. If any guardrail feels commercially unbearable at that point, that's the signal the product has become issuer-pays-for-scores in disguise — kill it.

---

## 2. Launch pricing recommendation

| Tier | Price | Contents | Reasoning |
|---|---|---|---|
| **Free (web)** | $0 | All letter grades, per-dimension breakdown, claim-level evidence, full methodology, historical grade timeline (delayed alerts) | Grades must be free forever to become the standard — the L2Beat/DeFiLlama playbook. Free grades are also the marketing. |
| **Free (API)** | $0 | Grade + dimension scores, ~30 req/min, **attribution required** ("Rated by X") | Copies GoPlus's proven adoption wedge ([free at 30 calls/min](https://docs.gopluslabs.io/reference/api-overview)); attribution turns every integration into distribution. |
| **Pro** | **$24/mo** ($240/yr) | Real-time alerts (admin-key, LP-lock expiry, vesting breach, sale-schedule deviation), watchlists (50 tokens), portfolio scan, alert webhooks/Telegram | Sits between GoPlus app ($9.90) and Nansen Pro ($49–69); matches Messari Pro ($24.99 annual). Alerts are the paid product per your thesis — price the *time series*, not the grade. |
| **API Growth** | **$99/mo** | 10 req/s, claim-level detail, no attribution requirement | Matches Token Sniffer's entry API tier (~$99/mo). |
| **API Scale** | **$399/mo** | 50 req/s, webhooks for grade changes, batch endpoints, alert firehose | Anchored between DeFiLlama's API plan (**$300/mo**, [docs.llama.fi/pro-api](https://docs.llama.fi/pro-api)) and Dune's paid tiers (**~$400–1,000/mo**, [dune.com/pricing](https://dune.com/pricing)). Behavioral-alert firehose is the tier-forcing feature. |
| **Enterprise** | custom, $1k–2k+/mo | SLA, historical data dumps, white-label feed, custom chains | Standard data-vendor motion; only quote when inbound. |
| **Deep-dive report** | **$3.5k** list ($2.5k–7.5k by scope) | Human-reviewed, AI-drafted trust-gap report; buyer-pays (funds/exchanges/DAOs), never issuer-pays at launch | Priced below the $5k floor of simple-token audits so it's an easy add-on to diligence budgets. |

Practical notes: annual-only discount (2 months free) to fight churn; keep only **one** paid consumer tier (Nansen's 2026 simplification is the market telling you multi-tier consumer pricing doesn't work here); grandfather early API integrators at $0 in exchange for attribution + a logo/testimonial.

---

## 3. GTM sequence (solo founder, zero audience)

**Phase 0 (weeks 1–4): the credibility corpus.** Before any promotion, publish the methodology page and ~100 grades of well-known tokens (Base majors + top memecoins + a few famous rugs graded retroactively). A rating site with 5 grades is a demo; with 100+ evidence-backed grades it's a reference. Grade ATA first, adversarially, and publish it — "we graded our own founder's token and here's every gap we found" is a launch story only you can tell.

**Phase 1 (months 1–6): the X grading bot as growth loop.** Mechanics: reply "@bot grade $TOKEN" → bot replies with grade card image + one-line worst finding + link to full evidence page. Cost reality check: X killed the free tier and moved new developers to **pay-per-use — $0.015/post ($0.20 if the post contains a link), $0.005/read** ([X API pricing 2026](https://www.xpoz.ai/blog/guides/understanding-twitter-api-pricing-tiers-and-alternatives/), [twitterapi.io breakdown](https://twitterapi.io/blog/x-api-cost-breakdown-2026)); legacy Basic ($200/mo) is closed to new signups. At 500 link-posts + 20k mention-reads/month that's ~$200/mo — meaningful but affordable; design cards so the *image* carries the grade (link in a follow-up reply only when engagement warrants, cutting $0.20 posts).

Virality engine: **grade controversial trending tokens within hours of them trending** (celebrity launches, politician coins, whatever tops DEX Screener). A legible letter grade + one damning verified claim ("website says liquidity locked 2 years; on-chain lock expires in 11 days") is quote-tweet fuel. This is the single highest-leverage marketing act available: the content writes itself from the pipeline, and controversy does the distribution. Cadence: 2–3 proactive "grade drops" weekly + a weekly "Trust-Gap Report" thread (worst docs-vs-chain discrepancies found that week) + monthly "grade migrations" (upgrades/downgrades with reasons — this trains the market that grades are *live*, which is differentiator #2).

**Phase 2 (months 4–12): partnerships, in this order.**
1. **Base ecosystem itself** — not a partner pitch but a grant + visibility channel: Base Builder Grants are retroactive, 1–5 ETH, awarded to shipped projects discovered via ecosystem activity ([Base docs — Get Funded](https://docs.base.org/get-started/get-funded)); a public-good trust layer for Base tokens is squarely in-profile. Base Batches offers $10k grants + a $50k investment track ([basebatches.xyz](https://www.basebatches.xyz/)).
2. **Small/mid Base-native tools first**: portfolio trackers, Telegram trading bots, Farcaster clients/mini-apps. They ship in days, say yes to free-with-attribution, and prove the integration story.
3. **DEX screeners second** (GeckoTerminal, DEXTools, DEX Screener): they have the traffic and a differentiation problem; your pitch is "a trust column nobody else can offer, free, attributed." Expect months-long cycles; start conversations early, close late.
4. **Wallets last** (Rabby/Zerion-class before Coinbase Wallet): security-signal integration is a roadmap item for all of them; GoPlus already occupies the "malicious token flag" slot, so pitch the *complement* — "GoPlus tells you it's a honeypot; we tell you the team's promises don't match the chain." Coinbase Wallet/Base App is the year-2+ prize; the grant relationship is the warm path in.

**ATA cross-promotion: use, with hard limits.** Use: ATA as case study #1 and methodology seed (its adversarial trust-gap review is literally the product's origin story); reuse of the chain-reading TypeScript/MCP code; the ATA audience as first followers. Limits: **separate brand, separate entity, disclosed affiliation on ATA's grade page; ATA excluded from "top rated" marketing lists; never use the rating platform to promote ATA holdings.** The moment the rating service looks like marketing infrastructure for the founder's token, credibility posture #4 is dead. One good pattern: let a third party or the open-sourced scoring spec "own" ATA's grade computation so you can point at it and say "same pipeline, no thumb on the scale."

---

## 4. Financial sketch

### Costs (monthly)

| Item | Months 1–6 | Months 7–18 | Notes |
|---|---|---|---|
| Infra (serverless, public RPCs, DB, hosting) | $50–150 | $150–400 | Per tech agent's assumption ($50–500/mo band) |
| LLM (claims engine) | $50–150 | $150–500 | See below |
| X API (pay-per-use) | $30–100 | $100–250 | Scales with bot volume |
| Data APIs (Etherscan-class explorers, misc) | $0–50 | $50–200 | Paid explorer tiers exist (Lite/Standard/Advanced); treat docs as source of truth ([etherscan.io/apis](https://etherscan.io/apis)) |
| SaaS misc (email, monitoring, domain) | $30 | $50 | |
| Optional contractor (part-time reviewer/BD) | $0 | $2,000–4,000 | Add only after ~$4k MRR |
| **Total cash burn** | **~$160–480** | **~$500–1,400 (+contractor)** | |

**LLM cost model** (current Anthropic pricing: Haiku 4.5 $1/$5 per MTok, Sonnet 4.6 $3/$15, Batch API −50%, cache reads ~0.1×): a full docs-scrape + claim-extraction + verification pass on one token ≈ 100–200k input / 5–10k output tokens. On Sonnet via Batch: **~$0.20–0.40/token analyzed**; on Haiku for re-checks: ~$0.05–0.10. So 500 deep analyses + 5,000 incremental re-checks/month ≈ **$150–400/mo** — LLM cost is real but never the constraint. The daily behavioral monitoring (differentiator #2) is mostly RPC reads, not LLM calls, and rounds to ~$0.

### Revenue scenarios

| | Pessimistic | Base | Optimistic |
|---|---|---|---|
| **Month 12** | ~$150 MRR (6 Pro, 0 API) + 1 report ($3.5k) + 1 small grant ($5k) → **~$10k yr-1 total** | ~$2.2k MRR (50 Pro = $1.2k; 3 API Growth + 1 Scale = $700; misc $300) + 4 reports ($14k) + grants ($20–40k) → **~$60–80k yr-1 total** | ~$10–15k MRR (bot goes viral, 1 screener integration converts to Scale/enterprise, 300+ Pro) + $30k reports + $75k+ grants → **~$200k yr-1** |
| **Month 36** | ~$1.5k MRR, occasional report → **~$25k/yr** | 350 Pro ($8.4k) + 10–15 API ($3–5k) + 2 enterprise feeds ($3k) = **~$15k MRR / ~$180k ARR** + $40k reports/yr → **~$220–300k/yr** | **$60–100k MRR ($0.7–1.2M ARR)** — GoPlus-scale call volume with paid conversion; at this point it's a fundable company |
| **Cash break-even** (excl. founder salary) | Month 20+ or never | **Month 8–12** | Month 4–6 |
| **Founder-opportunity break-even** (~$10k/mo) | Never | Month 26–34 | Month 14–20 |

Honesty notes: the pessimistic case is genuinely plausible — trust products have a cold-start paradox (nobody checks a rater with no reputation). The base case assumes the bot + grade-drops cadence produces at least one semi-viral moment per quarter and one screener/tracker integration by month 9. Pro-sub churn in crypto tooling is brutal (5–10%/mo); the MRR figures above are net of that.

### Bootstrapped vs. funded

**Stay bootstrapped through at least month 18.** Cash costs are a few hundred dollars a month; the product's credibility *benefits* from visible independence; and grants can realistically cover the gap:

- **Optimism Retro Funding demonstrably funds public-goods analytics at scale**: L2Beat received **198.8k OP in RetroPGF 3** (≈$600k+ at award-time prices) ([grantee page](https://optimism.grant3.co/grantees/l2beat)); Retro Funding moved to ongoing monthly rounds in 2025, distributing e.g. **2.6M OP in May 2025** across apps and dev tools ([optimism.io/blog/retro-funding-2025](https://www.optimism.io/blog/retro-funding-2025)). Base is an OP-Stack Superchain member — an open-methodology trust layer plausibly qualifies for Superchain-scoped rounds.
- **Gitcoin funds exactly this category**: L2BEAT and DefiLlama were top matching recipients in GG22 at **up to ~$30k each** ([Gate Learn on GG22](https://www.gate.com/learn/articles/gitcoin-grants-22-rounds-of-impactful-projects/4672)); rounds continue through GG23/24 ([grants.gitcoin.co](https://grants.gitcoin.co/)).
- **Base Builder Grants** (1–5 ETH, retroactive, no application — ship and be noticed) + **Base Batches** ($10k grants, $50k investments) ([docs.base.org](https://docs.base.org/get-started/get-funded), [basebatches.xyz](https://www.basebatches.xyz/)).

Realistic grant haul: **$15–50k in year 1, $30–100k in year 2** if the open methodology and free grades are genuinely public goods (published spec, free API, open data). This is the strongest argument for keeping the methodology and grade data open even though the extraction engine stays proprietary.

**Raise only if** you choose the "standard-that-everyone-embeds" end-state (below) *and* have the leading indicators by month 18–30: >1M free API calls/mo, 2+ named wallet/screener integrations, $15k+ MRR. Then a $1–2M round (Coinbase Ventures is the obvious strategic given Base alignment) buys multi-chain coverage and a first hire. Raising earlier buys nothing the grants + bootstrapping don't.

---

## 5. Year 3–5 end-states, and what keeps all doors open

**Door A — lifestyle data business.** $200–500k/yr, founder + one contractor, ~85% gross margin (infra + LLM are the only COGS). Fully achievable on the base case. Requires nothing but not blowing up the cost structure or taking money that demands growth.

**Door B — acquisition.** Comps and buyer logic:
- **Token Sniffer → Solidus Labs (Oct 2022, undisclosed)** — the closest comp: a scrappy free scam-scanner acquired to power a compliance platform's Web3 AML product ([Businesswire](https://www.businesswire.com/news/home/20221027005148/en/)); Solidus had raised a **$45M Series B** months earlier ([soliduslabs.com](https://www.soliduslabs.com/post/raising-the-standard-for-security-and-integrity-in-crypto-and-defi-solidus-labs-secures-a-45-million-b-round)). Undisclosed price for a largely solo project almost certainly means low-single-digit $M — that is the realistic floor comp for "useful tool + data + brand, no team."
- **CCData/CryptoCompare → Bullish, Nov 2023, $75M all-cash**; subsequently folded into CoinDesk's data arm in 2024 ([Architect Partners](https://architectpartners.com/coindesk-acquires-ccdata-cryptocompare-for-an-undisclosed-amount/)) — the ceiling comp: a decade-old institutional data vendor with 500+ regulator/bank clients.
- **Skew → Coinbase (2021, undisclosed)** — exchanges buy analytics teams/data outright ([Coinbase blog](https://blog.coinbase.com/coinbase-to-acquire-leading-institutional-data-analytics-platform-skew-929e3882ef42)).
- Likely buyers ranked: compliance platforms (Solidus, Chainalysis, TRM — they need token-level risk data for VASP clients), security firms (CertiK, Blockaid — you fill their "promise vs. chain" gap), exchanges/wallets (Coinbase — Base alignment), data aggregators (CoinGecko/CMC/Messari — a trust column is an obvious product gap). Realistic range on base-case traction: **$2–10M** (strategic tool + dataset); on optimistic traction with $1M ARR of API revenue: **$10–30M** (5–10× data-ARR multiples plus strategic premium).

**Door C — the embedded standard** ("the Moody's grade every frontend shows"). Requires: free grades forever, open methodology, visible neutrality (the no-issuer-pays stance is *load-bearing* here), coverage across all major chains, and eventually grant/consortium funding L2Beat-style. Highest ceiling, least extractable revenue per user, most dependent on staying credibly independent.

**Choices to make now that keep all three doors open:**
1. **No token for the rating service, ever.** A token forecloses B (acquirer diligence nightmare) and taints C (score-holder conflicts). This matters doubly given the founder already has ATA.
2. **No issuer-pays for scores; defer even the expedited variant.** Preserves C entirely; preserves B (compliance-sector acquirers will diligence revenue provenance hard).
3. **Open the methodology and the grade *data*; keep the claims-engine *code* proprietary.** Open spec + free data = grant-eligible public good (doors A/C); proprietary pipeline = acquirable IP (door B). This split is the single most important structural decision.
4. **Store everything as structured evidence records from day 1** (claim → source URL → on-chain check → verdict → timestamp). The longitudinal dataset — "3 years of verified promise-keeping behavior for 10,000 tokens" — is the asset every buyer in door B actually wants and the moat for door C. It cannot be backfilled.
5. **Free API requires attribution.** Grows the standard (C), measures embeddedness for acquirers (B), costs nothing (A).
6. **Clean single-member entity, separate from ATA, with all IP assigned.** Cheap now, deal-saving later.
7. **No exclusive white-label or exclusive-data deals** — exclusivity forecloses both the standard and the multi-bidder acquisition.

### Sources
[Nansen pricing](https://academy.nansen.ai/articles/1287744-plans-and-pricing) · [Nansen review/pricing 2026](https://chainplay.gg/blog/nansen-review/) · [DeFiLlama Pro API pricing](https://docs.llama.fi/pro-api) · [DeFiLlama subscription](https://defillama.com/subscription) · [Dune pricing](https://dune.com/pricing) · [Dune pricing review](https://comparedge.com/tools/dune-analytics) · [Messari pricing](https://messari.io/pricing) · [Messari review](https://captainaltcoin.com/messari-review/) · [GoPlus security API](https://gopluslabs.io/en/security-api) · [GoPlus API docs](https://docs.gopluslabs.io/reference/api-overview) · [CoinDesk GoPlus research](https://www.coindesk.com/research/protocol-research-goplus-security) · [Token Sniffer API](https://www.soliduslabs.com/tokensniffer/api) · [Decrypt on Token Sniffer API](https://decrypt.co/123042/token-sniffer-api-solidus-labs-rug-pulls-scams) · [Solidus Labs Token Sniffer acquisition](https://www.businesswire.com/news/home/20221027005148/en/) · [Solidus $45M Series B](https://www.soliduslabs.com/post/raising-the-standard-for-security-and-integrity-in-crypto-and-defi-solidus-labs-secures-a-45-million-b-round) · [CCData→Bullish $75M / CoinDesk acquisition](https://architectpartners.com/coindesk-acquires-ccdata-cryptocompare-for-an-undisclosed-amount/) · [Coinbase acquires Skew](https://blog.coinbase.com/coinbase-to-acquire-leading-institutional-data-analytics-platform-skew-929e3882ef42) · [X API pricing 2026](https://www.xpoz.ai/blog/guides/understanding-twitter-api-pricing-tiers-and-alternatives/) · [X API cost breakdown](https://twitterapi.io/blog/x-api-cost-breakdown-2026) · [Audit pricing 2026 (Zealynx)](https://www.zealynx.io/blogs/audit-pricing-2026) · [Audit cost (Cyberscope)](https://www.cyberscope.io/blog/how-much-does-it-cost-to-audit-a-smart-contract) · [Base Get Funded](https://docs.base.org/get-started/get-funded) · [Base Batches](https://www.basebatches.xyz/) · [L2Beat RetroPGF3 award](https://optimism.grant3.co/grantees/l2beat) · [Optimism Retro Funding 2025](https://www.optimism.io/blog/retro-funding-2025) · [Gitcoin GG22 recipients](https://www.gate.com/learn/articles/gitcoin-grants-22-rounds-of-impactful-projects/4672) · [Better Markets on issuer-pays](https://bettermarkets.org/analysis/fact-sheet-credit-rating-agency-conflicts-interest-again-fueling-financial-crisis-0/) · [Etherscan APIs](https://etherscan.io/apis)