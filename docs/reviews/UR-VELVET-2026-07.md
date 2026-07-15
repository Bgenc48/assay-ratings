# UR review memo — VELVET (Velvet)

| | |
|---|---|
| Token | VELVET — Velvet |
| Chain / address | base — `0xbf927b841994731c573bdf09ceb0c6b0aa887cdd` |
| Computed grade | **D** (overall 52.3, provisional, methodology v0.1.0) |
| Published letter | **UR** (Under Review) |
| Liquidity | $3,257,907 |
| Scan reviewed | 2026-07-11T21:26:13Z (`data/tokens/base-0xbf927b841994731c573bdf09ceb0c6b0aa887cdd.json`) |
| Registry location | `registry/discovered.json` (auto-discovery, 2026-07-11) |
| Memo prepared | 2026-07-13 |

**Bottom line: do not confirm.** This D rests on the scoring defect fixed
in this PR (commit `cf8370d`). Post-fix, VELVET recomputes to ≈59.2 → C,
which is not gated, so it exits UR automatically on the first scan after
merge. The correct action is no action.

## Why the methodology computed this grade

Weights (no governance claim): Supply 20 · Admin 20 · Disclosure 15 ·
Insider 15 · Liquidity 15 · Track 10 · Holders 5. Average over scorable
dimensions; overall = min(average, hard caps).

| Dimension | Score | Weight | Contribution | Driver (from the report) |
|---|---|---|---|---|
| Supply Integrity | 60 | 20 | 1200 | No mint function today, but the contract is a beacon proxy — an upgrade could add one (latent mint) |
| Admin Surface | 40 | 20 | 800 | Privileged capability (upgradeability) exists; controller unclassified — owner `0x8d2de8d2…c79627` |
| Disclosure Integrity | 70 | 15 | 1050 | No machine-checkable claims (claim-light floor) |
| Insider Float | N/R | — | — | No data; coverage only |
| Liquidity Permanence | 25 | 15 | 375 | **The defect.** Dominant pool `0x6b0F53…a1bE` ($3.23M, Aerodrome) has `lockAnalyzed: false` — the scanner could not read its LP distribution, yet v0.1.0 scored the missing data as 25, "mostly unlocked" |
| Track Record | N/R | — | — | `ageDays: null` — the Blockscout creation-age lookup failed this scan |
| Holder Concentration | 100 | 5 | 500 | Top-10 unlabeled holders control 5.3% |
| Governance Reality | N/A | 0 | — | Not claimed |

Weighted average: 3,925 / 75 = **52.33 → 52.3** → D band. Only cap: B+
(claim-light), which does not bind. D above $1M liquidity gates to UR.

## What was independently verified during this review

- **The defect is real and is what put VELVET in the D band.**
  `scoreLiquidityPermanence` (v0.1.0) never checked `lockAnalyzed`; a pool
  with null burn/lock percentages summed to "0% secured" and published
  score 25 with "The dominant pool's LP is mostly unlocked" — a negative
  statement manufactured from missing data, violating the "missing data is
  never the worst case" invariant. The fix is already committed on this
  branch (`cf8370d`): such pools now score `null` (insufficient data →
  lower coverage) with a calibrated `liq.unanalyzed` finding.
- **Post-fix recomputation:** the liquidity dimension leaves the average,
  which becomes (20·60 + 20·40 + 15·70 + 5·100) / 60 = 3,550 / 60 =
  **59.17 → 59.2 → C** (55–69.9 band). No cap binds (claim-light B+ is the
  only one). C is not gated: VELVET publishes the letter automatically.
- The arithmetic in both tables reproduces exactly from the published
  report and the v0.1.0 / post-fix scorers.

Two genuine gaps noted for future work (neither blocks this decision):

- The token is a **beacon proxy**, and the beacon's `owner()` is never
  probed — that is why Admin Surface reads "unknown" at 40. Probing the
  beacon owner is a classification improvement worth a backlog entry, not
  something to hand-wave in a review.
- `ageDays` is null (Blockscout retry needed). Sensitivity worth knowing:
  if a later scan fills track record in, VELVET moves to ≈61.4 (C) at
  12–24 months or ≈57.9 (C) at 6–12 months — but if the token turns out to
  be younger than 6 months, track 25 pulls it to ≈54.3, back into the D
  band and back to UR. The grade may wobble across the C/D line as this
  datum arrives; that is the methodology working, not a malfunction.

## What still needs a live check

Nothing is required before deciding — the decision is "wait". Optional:

- [ ] **Confirm why the dominant pool could not be analyzed.** Open
  `https://base.blockscout.com/address/0x6b0F53cbD9272D8117e9535FE25371dedF39a1bE`.
  If it is a pool type without a fungible LP token (a concentrated-
  liquidity/position-NFT pool), the scanner cannot analyze it by design in
  v1 and the post-fix "insufficient data" reading is permanent until v3
  support lands. If it does have an LP token with a holders tab, a rescan
  may succeed on its own.
- [ ] **Verify the post-merge recomputation** on a throwaway clone:

  ```bash
  # Throwaway clone — for reading results only. A live --only run rewrites
  # data/index.json down to this one token and appends to data/history/,
  # so never commit or push from this clone; delete the folder when done.
  git clone https://github.com/Bgenc48/assay-ratings.git assay-review
  cd assay-review
  npm install --ignore-scripts
  npm run scan -- --only 0xbf927b841994731c573bdf09ceb0c6b0aa887cdd
  # then read: data/tokens/base-0xbf927b841994731c573bdf09ceb0c6b0aa887cdd.json
  # expect: overall ≈59.2, letter C, a liq.unanalyzed finding, coverage lower
  ```

## Recommendation

- **Do not set `reviewedLowGrade`.** That would confirm a D the
  methodology no longer computes — publishing it would be a factual error
  on our side, the exact thing the review gate exists to prevent.
- **No registry change at all.** VELVET stays in
  `registry/discovered.json`; nothing needs promoting because no flag is
  being set. For completeness, if some future review does need to flag
  VELVET, the promotion entry to `registry/tokens.json` would be:

  ```json
  {
    "chain": "base",
    "address": "0xbf927b841994731c573bdf09ceb0c6b0aa887cdd",
    "expectSymbol": "VELVET",
    "name": "Velvet"
  }
  ```

  > PR description must cite the official source for the address —
  > TODO(owner): confirm on velvet.capital / docs.velvet.capital and link
  > it. (Not needed for the current decision.)
- **Wait for the first daily scan after this PR merges**, then spot-check
  that the site shows VELVET as C with the `liq.unanalyzed` finding.

## Interactions with this PR

- **Entirely resolved by this PR.** The defect fix (`cf8370d`) is the
  whole story; the UR clears itself at the next scan post-merge.
- The methodology version bumps to 0.2.0 in this PR, so the recomputed
  report will carry the new version stamp and the changelog will note the
  liquidity-scoring correction (invariant 6).
- Backlog items to carry out of this memo: beacon-owner probing
  (classification gap) and v3-style pool analysis (roadmap).
