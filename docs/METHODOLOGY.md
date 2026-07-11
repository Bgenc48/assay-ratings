# Assay Methodology — v0.1.0

> **The grade measures whether a token can betray you in ways it hasn't
> disclosed — not whether it is a good investment.**

This document is the normative specification. The implementation is
`packages/core/src/scoring.js`; the golden tests in
`packages/core/test/scoring.test.js` encode the sanity checks below, so a
change that silently moves them fails CI. Every published score is stamped
with the `methodology_version` that produced it. Changes require a semver
bump and a changelog entry here.

## 1. Principles

1. **Disclosed, purpose-consistent centralization is not a lie.** We grade
   the gap between representation and reality, plus structural exposure —
   not centralization per se.
2. **A claim-light token can be structurally honest, never excellent.**
   Silence isn't lying, but it isn't disclosure either (floor 70 on the
   disclosure dimension, permanent B+ cap).
3. **Trust needs time.** Age caps: <6 months → at most B+ (Provisional);
   <12 months → at most A− (Provisional); <24 months → at most A. No token
   earns A+ in under two clean years.
4. **Missing data lowers coverage, never the score** — and is never scored
   as the worst case. Unknown lockers earn no credit; unanalyzable pools
   read "insufficient data".
5. **Deterministic scores.** LLMs may help extract claims from documents;
   they never author verdicts and never touch score math.

## 2. Dimensions and weights

| # | Dimension | Weight | Key anchors (0–100) |
|---|---|---|---|
| 1 | Supply Integrity | 20 | 100 no mint path & not upgradeable · 85 mint gated by governance+timelock · 65 custodial issuance w/ attestations · 60 latent mint via upgradeability · 35 bare multisig mint · 0 EOA mint (**cap F**) |
| 2 | Admin Surface & Upgradeability | 20 (15 if #8 applies) | 100 no owner/powers/proxy · 90 governance + ≥48h timelock · 75 ≥3-of-N Safe + delay · 55 Safe, no timelock · 25 EOA with material powers |
| 3 | Disclosure Integrity | 15 | start 100 · material FALSE −40 (**cap D**) · minor FALSE −10 · material UNVERIFIABLE −5 (max −30) · omission −15 · claim-light floor 70 |
| 4 | Insider Float & Vesting | 15 | 100 liquid <5% & ≥50% code-vested · 75 <10% & ≥30% vested · 50 ≤15% · 25 ≤30% · 0 >30% (**cap C**) or vesting violated |
| 5 | Liquidity Permanence | 15 | 100 ≥90% of dominant pool burned/locked ≥12mo · 75 6–12mo · 50 ≥50% secured · 25 mostly unlocked · 0 single-EOA withdrawable (**cap D**) |
| 6 | Operational Track Record | 10 | 100 ≥24mo clean · 75 ≥12mo · 50 ≥6mo · 25 younger · 0 any commitment violation (**cap D → C after 24 clean months**) |
| 7 | Holder Concentration | 5 | top-10 *unlabeled* holders: 100 <10% · 75 <20% · 50 <35% · 25 <50% · 0 ≥50% (**cap C**) |
| 8 | Governance Reality | 5, only if governance is claimed | 85 governor verifiably executes · 50 advisory-only · 40 multisig can bypass · 10 governance theater (also charged to #3) |

Weighted average runs over **scorable** dimensions only (weights
renormalize). Fewer than 3 scorable dimensions → **N/R**, never a grade.

## 3. Aggregation

```
overall = min( weighted_average , min(triggered caps) )
```

The full cap table (published verbatim, tested):

| Trigger | Cap |
|---|---|
| Unverified source code | C |
| Mint/issuance callable by EOA or undisclosed party | **F** |
| Upgradeable with EOA admin, no timelock | D |
| Materially false safety claim | D |
| >50% of primary liquidity withdrawable by one key | D |
| Historical commitment violation | D (→ C after 24 clean months) |
| Insider liquid float >30% | C |
| Top-10 unlabeled holders >50% | C |
| <50% of material claims verifiable | B |
| Claim-light (no checkable disclosures) | B+ |
| Age <24 months | A |
| Age <12 months | A− + Provisional |
| Age <6 months | B+ + Provisional |

Letter bands: A+ ≥95 · A 89–94.9 · A− 85–88.9 · B+ 80–84.9 · B 75–79.9 ·
B− 70–74.9 · C 55–69.9 · D 40–54.9 · F <40.

**Trust Model badge** (what *kind* of trust): Code-Enforced /
Governance-Gated / Custodial (disclosed) / Custodial / Discretionary.

**Coverage indicator**: ● ≥80% of applicable dimensions scored · ◐ ≥50% ·
○ below. A B+ at full coverage and a B+ at thin coverage must be
distinguishable.

## 4. Claims: the docs-vs-chain layer

Claim records (`registry/claims/<chain>/<address>.json`) carry the claim
text, a **verbatim quote**, source URL, tense, and materiality. They enter
the registry hand-curated or as LLM-extracted drafts (`review: "pending"`,
inert until human-approved in a reviewed commit).

Verdicts are computed on every scan by `packages/claims/src/verify.js`:

- `VERIFIED` / `FALSE` — deterministic chain checks (fixed_supply,
  renounced, lp_locked, multisig, timelock, admin_disclosure).
- `UNVERIFIABLE` — nothing on-chain can confirm or deny (off-chain claims,
  audits beyond link-resolution, custodial locks). Never treated as false.
- `FORWARD_LOOKING` — commitments with deadlines; they become FALSE only if
  the deadline passes unmet. This is what makes trust a time series.
- `STALE` — previously verified, underlying state changed.

**Language rule (defamation posture):** verdict notes state what the chain
shows at a point in time — "no lock found at the stated address as of this
scan" — never intent. This rule is tested.

## 5. Sanity checks (encoded as golden tests)

- Perfect docs + EOA mint = **F**, never B+ ("mint-backdoor test").
- Materially false "LP locked" claim caps an otherwise-A token at **D**.
- No token reaches A before 12 clean months; A+ needs 24.
- Claim-light memecoin with clean structure lands **B-range**, capped B+.
- Single-EOA-withdrawable liquidity caps at **D**.
- Thin data → thin coverage, not a low score; <3 scorable dimensions → N/R.

## 6. Category profiles (v0.2 roadmap)

Fiat stablecoins (purpose-consistent issuance, redeemability instead of
liquidity permanence), wrapped/bridged assets (derivative trust), and L1/L2
native coins (out of automated scope) get published profile re-weightings in
v0.2. Until then their reports carry an explanatory note.

## 7. Data sources & licensing constraints

Public JSON-RPC endpoints (chain-ID verified per batch, multi-endpoint
fallback) · Blockscout (holders, contract verification, creation age) ·
DexScreener public API (pool discovery, liquidity USD, project links) ·
locker/label allowlists maintained in this repository by reviewed PR.
**The Etherscan API is not used anywhere** — its terms prohibit commercial
use and AI/dataset use.

## 8. Human review gates

- D/F grades on tokens above ~$1M liquidity: human-reviewed before publish.
- Claim drafts: human-approved before they can affect any score.
- Locker/label registry additions: reviewed PR with cited evidence.
- Methodology changes: version bump + changelog + golden-test update.

## Changelog

- **0.1.0** — Initial public methodology: eight dimensions, hybrid
  aggregation with hard caps, deterministic claim verdicts (six verifier
  types), Trust Model badges, coverage indicator, age caps at 6/12/24
  months, COI carve-out (see COI-POLICY.md).
