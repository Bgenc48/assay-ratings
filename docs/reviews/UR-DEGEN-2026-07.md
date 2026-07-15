# UR review memo — DEGEN (Degen)

| | |
|---|---|
| Token | DEGEN — Degen |
| Chain / address | base — `0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed` |
| Computed grade | **D** (overall 55.0 displayed = 54.99 capped, methodology v0.1.0) |
| Published letter | **UR** (Under Review) |
| Liquidity | $1,477,648 (across tracked pools) |
| Scan reviewed | `data/tokens/base-0x4ed4e862860bed51a9570b96d89af5e1b0efefed.json` (2026-07-11 scan) |
| Registry location | `registry/tokens.json` (hand-curated) |
| Memo prepared | 2026-07-15 |

**Bottom line:** do not rush a confirmation. DEGEN's own fundamentals
compute to **C** (≈63.7 on this scan, ≈73.3 after the liquidity-scoring fix
in this PR); the D exists **only** because a rug-ready hard cap fires — and
on this scan it fires on a **small analyzed side pool (≤$53.7k, under 4% of
tracked liquidity)**, not the dominant pool. Read the named pool after the
next scan and decide the methodology question below before setting any flag.

## Why the methodology computed this grade

Weights (no governance claim): Supply 20 · Admin 20 · Disclosure 15 ·
Insider 15 · Liquidity 15 · Track 10 · Holders 5. Average over scorable
dimensions; overall = min(average, hard caps).

| Dimension | Score | Weight | Contribution | Driver (from the report) |
|---|---|---|---|---|
| Supply Integrity | 100 | 20 | 2000 | No mint path in the deployed bytecode; supply is fixed |
| Admin Surface | 55 | 20 | 1100 | Privileged capabilities gated by a multisig with no timelock |
| Disclosure Integrity | 70 | 15 | 1050 | No machine-checkable claims (claim-light floor) |
| Insider Float | N/R | — | — | No data; coverage only |
| Liquidity Permanence | 25 | 15 | 375 | Dominant pool `0xc9034c…d5ACAA` ($1.38M, Uniswap) — v0.1 read it as "mostly unlocked", but `lockAnalyzed: false`: **the scanner could not read its LP distribution** |
| Track Record | N/R | — | — | `ageDays: null` (Blockscout creation-age lookup failed this scan) |
| Holder Concentration | 50 | 5 | 250 | Top-10 unlabeled holders control 24.6% |
| Governance Reality | N/A | 0 | — | Not claimed |

Weighted average: 4,775 / 75 = **63.7 (C band)**. The only thing pulling the
letter down is the **rug-ready hard cap (D)**, which fires because at least
one *analyzed* pool has LP held by a single EOA. The cap holds the ceiling
at 54.99 → displayed 55.0, letter **D**, which above $1M liquidity gates to UR.

## What was independently verified during this review

- **The rug-ready cap is not on the dominant pool.** The dominant pool by
  liquidity (`0xc9034c3E7F58003E6ae0C8438e7c8f4598d5ACAA`, $1.38M, Uniswap)
  is `lockAnalyzed: false` — it cannot have triggered rug-ready (that flag is
  only set on pools the scanner actually analyzed). The three analyzed pools
  are all small Aerodrome pools: `0x2C4909…59aBf3` ($53,737),
  `0xc01162…9852F` ($6,393), `0x637ad8…AF9585` ($2,827). The cap fires on one
  of these — the largest possible culprit is ~$53.7k, under 4% of DEGEN's
  tracked liquidity.
- **Effect of this PR's liquidity fix:** the dominant unanalyzed pool moves
  from a manufactured 25 to `null` (insufficient data), which *raises* the
  fundamentals to ≈73.3 (still C). It does **not** clear the rug-ready cap —
  the cap is independent of the dominant-pool score — so DEGEN remains
  computed-D and remains UR after merge.
- Supply is fixed (no mint path) and admin is a multisig — materially
  stronger fundamentals than the other UR tokens in this batch. A confirmed
  D/F here would be reputationally significant and should rest on clear
  evidence, which a ≤$53.7k side pool does not obviously provide.
- The report predates the rug-ready evidence enrichment in this PR; after the
  next scan the cap reason will name the exact pool and holder.

## What still needs a live check

- [ ] **After the next scan, read which pool the cap names.** The rug-ready
  cap reason now includes the pool address and, when recorded, the holder and
  its LP share. Confirm it is one of the small Aerodrome pools above and note
  the holder.
- [ ] **Confirm the holder is an EOA.** For the named pool, open
  `https://base.blockscout.com/token/<pair>?tab=holders`, confirm a single
  top holder >50% of LP, and confirm that address has no contract code.
  Blockscout only. If the holder is a contract (a gauge/locker), it is a
  labeling gap, not a rug — add it to `labels.json`/`lockers.json` instead.

## Recommendation — and a methodology question for the owner

- **Do not set `reviewedLowGrade` yet.** The D is a cap artifact on a small
  side pool; DEGEN's own structure computes C.
- **Decide the scoping question first.** Should the rug-ready cap consider
  *any* pool with >$0 liquidity, or only the dominant pool (or pools above a
  liquidity-share threshold)? Today it is any-pool: a single EOA holding the
  LP of a ~$3k–$54k side pool caps a $1.5M token at D. That is arguably too
  aggressive, and DEGEN is the first real token to expose it. Refining
  rug-ready to a dominant-pool (or share-weighted) scope is a **methodology
  change** — it needs a version bump, a changelog entry, and golden tests
  (invariant 6), so it is out of scope for this PR and is logged here as the
  top backlog item coming out of this review.
- **Interim:** hold DEGEN at UR (its current, honest state — every fact is
  published, only the letter is withheld). Setting `reviewedLowGrade: true`
  is defensible **only** if the live check shows the EOA-held pool is
  material to holders in practice; on the present evidence (a sub-4% side
  pool) it is not, so the correct action is to wait for the scoping decision.
  DEGEN is already in `registry/tokens.json`, so if the owner does later
  confirm, the change is a one-line `"reviewedLowGrade": true` on its entry.

## Interactions with this PR

- The liquidity-scoring fix raises DEGEN's fundamentals (dominant pool → null)
  but does not clear the rug-ready cap; net letter is unchanged (D/UR).
- The rug-ready evidence enrichment in this PR is what makes the named pool
  and holder visible on the next scan — the precondition for the live check.
- The rug-ready scoping refinement is explicitly **not** made here; it is
  recorded as backlog so the change is versioned and tested when taken.
