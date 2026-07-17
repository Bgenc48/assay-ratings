# UR review memo — VIRTUAL (Virtuals Protocol)

| | |
|---|---|
| Token | VIRTUAL — Virtuals Protocol |
| Chain / address | base — `0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b` |
| Computed grade | **D** (overall 44.4, methodology v0.1.0) |
| Published letter | **UR** (Under Review) |
| Liquidity | $3,195,885 (across tracked pools) |
| Scan reviewed | `data/tokens/base-0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b.json` (2026-07-11 scan) |
| Registry location | `registry/tokens.json` (hand-curated) |
| Memo prepared | 2026-07-15 |

**Bottom line:** this looks like a genuine low grade — the exact case the
review gate exists for. The D is driven by a dominant pool whose LP is
withdrawable by a single externally-owned account. One live check confirms
or refutes it. If it confirms, set `reviewedLowGrade: true`.

## Why the methodology computed this grade

Weights (no governance claim): Supply 20 · Admin 20 · Disclosure 15 ·
Insider 15 · Liquidity 15 · Track 10 · Holders 5. Average over scorable
dimensions; overall = min(average, hard caps).

| Dimension | Score | Weight | Contribution | Driver (from the report) |
|---|---|---|---|---|
| Supply Integrity | 35 | 20 | 700 | A mint path exists; its controller could not be classified automatically (insufficient data, not an open mint) |
| Admin Surface | 40 | 20 | 800 | Privileged capabilities exist; controller unclassified |
| Disclosure Integrity | 70 | 15 | 1050 | No machine-checkable claims (claim-light floor) |
| Insider Float | N/R | — | — | No data; coverage only |
| Liquidity Permanence | 0 | 15 | 0 | **Dominant pool `0xE31c372a7Af875b3B5E0F3713B17ef51556da667` ($1,067,903, Uniswap) is analyzed: 0% burned / 0% locked and its LP is held by a single non-contract address (rug-ready)** |
| Track Record | 100 | 10 | 1000 | 849 days of age |
| Holder Concentration | N/R | — | — | No data; coverage only |
| Governance Reality | N/A | 0 | — | Not claimed |

Weighted average: 3,550 / 80 = **44.4** → D band. Caps triggered: C
(unclassified mint), **D (rug-ready)**, B+ (claim-light). The 44.4 average
is already in the D band, and the rug-ready cap independently holds the
ceiling at D. D above $1M liquidity gates to UR.

Note the difference from VELVET: VIRTUAL's dominant pool is genuinely
**analyzed** (`lockAnalyzed: true`), so the liquidity-scoring fix in this PR
does not move it. The 0 is a real reading, not manufactured from missing
data.

## What was independently verified during this review

- The rug-ready finding is on the **dominant** pool by liquidity
  (`0xE31c…da667`, ~$1.07M, the largest of eight tracked pools), not a minor
  side pool — so it genuinely reflects where most of the tracked liquidity
  sits.
- The report predates the rug-ready evidence enrichment added in this PR, so
  the published record does not yet name the LP holder. After the next scan,
  the cap reason and `facts.pools` will carry the holder address and its LP
  share (see the enrichment commit in this PR).
- Chain access is not available from the authoring sandbox, so the holder
  identity itself must be confirmed live (below).

## What still needs a live check

- [ ] **Confirm the dominant pool's LP is EOA-held.** Open
  `https://base.blockscout.com/token/0xE31c372a7Af875b3B5E0F3713B17ef51556da667?tab=holders`
  and confirm a single top holder controls >50% of the LP token supply, then
  open that holder's address page and confirm it has **no contract code**
  (an EOA, not a locker or a staking contract). Blockscout only — never the
  Etherscan API. If the top holder is a contract (locker/gauge), the
  rug-ready reading is a false positive and this should NOT be confirmed;
  raise it instead as a labeling/locker gap.
- [ ] **Optional — rescan after merge** to see the holder surfaced in the
  report:

  ```bash
  # Throwaway clone — reading only. A live --only run rewrites
  # data/index.json to this one token and appends to data/history/, so never
  # commit or push from this clone; delete the folder when done.
  git clone https://github.com/Bgenc48/assay-ratings.git assay-review
  cd assay-review && npm install --ignore-scripts
  npm run scan -- --only 0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b
  # read: data/tokens/base-0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b.json
  ```

## Recommendation

- **If the live check confirms an EOA holds >50% of the dominant pool's LP:**
  set `reviewedLowGrade: true`. This is the textbook case the gate protects —
  a factual, chain-evidenced finding, stated in calibrated language. VIRTUAL
  is already in `registry/tokens.json`, so no promotion is needed:

  ```diff
       {
         "chain": "base",
         "address": "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
  -      "expectSymbol": "VIRTUAL",
  -      "name": "Virtuals Protocol"
  +      "expectSymbol": "VIRTUAL",
  +      "name": "Virtuals Protocol",
  +      "reviewedLowGrade": true
       },
  ```

- **If the top LP holder turns out to be a contract** (a locker or gauge the
  registry does not yet label): do not confirm. Instead add the locker to
  `packages/chain/registries/lockers.json` (with cited evidence) or the
  address to `labels.json`, so the next scan credits or excludes it
  correctly — and VIRTUAL re-grades on real data.

## Interactions with this PR

- The liquidity-scoring fix does **not** move VIRTUAL (dominant pool was
  genuinely analyzed).
- The rug-ready evidence enrichment in this PR makes the holder visible on
  the next scan, which is what the live check above confirms by hand in the
  meantime.
- The secondary `unclassified-mint` (C) cap is not the binding constraint
  here, but it is a real insufficient-data flag; a future minter/controller
  classification pass may refine the supply score independently of the
  liquidity finding.
