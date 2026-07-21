# Assay Methodology — v0.2.0

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
| 1 | Supply Integrity | 20 (25 under custodial profiles) | 100 no mint path & not upgradeable · 85 mint gated by governance+timelock, or restricted to an allowlisted canonical bridge (bridged profile) · 65 disclosed custodial issuance — **operative only under the custodial profiles (§6) with a VERIFIED admin-disclosure claim** · 60 latent mint via upgradeability · 35 bare-multisig or unclassifiable mint (unclassifiable also **caps C** as insufficient data) · 0 EOA-controlled mint (**cap F**, requires positive controller classification) |
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
| Mint/issuance whose classified controller is an EOA | **F** |
| Mint path present, controller unclassifiable (insufficient data) | C |
| Upgradeable with EOA admin, no timelock | D |
| Materially false safety claim | D |
| >50% of primary liquidity withdrawable by one key | D |
| Historical commitment violation | D (→ C after 24 clean months) |
| Insider liquid float >30% | C |
| Top-10 unlabeled holders >50% | C |
| <50% of material claims verifiable | B |
| Claim-light (no checkable disclosures) | B+ |
| Custodial control asserted (profile) without a VERIFIED issuer disclosure | C |
| Custodial issuer (profile), always | B+ |
| Age <24 months | A |
| Age <12 months | A− + Provisional |
| Age <6 months | B+ + Provisional |

Some caps are **profile-conditional** (§6): under a custodial profile with a
VERIFIED admin-disclosure claim, the EOA-mint (F), unclassified-mint (C) and
EOA-upgrade (D) caps are emitted **waived** — printed on the report with the
evidence that waives them, but excluded from the grade ceiling. LP-derived
caps do not apply where liquidity permanence is replaced or N/A. A waiver
never removes a fact; it only removes it from the min().

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

## 6. Category profiles

The standard profile (§2) treats disclosed, purpose-consistent
centralization as latent rug risk — correct for a project token, wrong for a
fiat stablecoin or a canonical bridge wrapper. A **category profile**
re-weights the dimensions and re-labels a few so a token is graded for what it
is. Profiles are assigned **only by hand, in `registry/tokens.json`, by
reviewed PR** — auto-discovered tokens always score `standard`; an unknown
profile string throws. Every report, index row, and history line is stamped
with the profile used, and a profile change emits a WARN alert.

**Load-bearing rule.** A profile only re-weights and re-labels. Every anchor
it raises and every cap it waives *additionally* requires positive,
per-scan-recomputed evidence — a VERIFIED `admin_disclosure` claim, or an
on-chain canonical-bridge classification. Absent that evidence, the profile
degrades to the C "insufficient data" treatment (Principle 4), never to F and
never silently to a good score. Waived caps stay on the report, marked
`waived` with the evidence in `waivedBy`; they are excluded from the min()
only, never deleted.

**`fiat-stablecoin` / `custodial-wrapped`** (shared semantics). Weights:
Issuance Integrity 25, Admin 20 (15 with governance), Disclosure 25,
Redeemability 10, Track Record 20; Insider Float and Holder Concentration are
**N/A** (no insiders exist for issuance-based supply). Issuance anchors at 65
and admin at 50 **only while** an approved `admin_disclosure` claim verifies
VERIFIED (the deterministic subset check in `verify.js`: every privileged
selector kind found on-chain is enumerated in the issuer's own material) — so
if the issuer's disclosures stop covering the chain, the grade regresses on
the next scan automatically. Without a VERIFIED disclosure, issuance scores 35
and `cap.custodial-undisclosed` (C) applies. Liquidity Permanence is replaced
by **Redeemability**, which is out of automated scope in v0.2 (redemption
execution and reserve attestations are not machine-checkable): it scores as
reduced coverage, never a guess; attestation links appear under Claims. A
permanent `cap.custodial-issuer` (B+) means a custodial issuer never reaches
A. What still fails one: a materially false claim (D), an undisclosed on-chain
power (flips the disclosure claim FALSE → D and collapses the anchors),
unverified source (C), a track-record violation (D), symbol mismatch
(publishes nothing).

**`bridged`.** Weights: Supply 25, Admin 25 (20 with governance), Disclosure
20, Track Record 20, Holder Concentration 10; Insider Float and Liquidity
Permanence are N/A (a canonical wrapper makes no LP-lock promise). When the
token's declared bridge address, read on-chain each scan, matches an entry in
the reviewed `packages/chain/registries/bridges.json` allowlist, issuance
anchors at 85 and admin at 90 (`admin.bridge-only`), and the report carries a
mandatory derivative-trust note: the grade covers the Base wrapper contract,
not the parent-chain asset or the bridge operator. If the check does not pass,
the token falls back to the standard treatment (fail-soft). Non-canonical
bridges cannot receive this profile in v0.2.

**`native-representation`.** A bridged representation of another chain's
native coin publishes full facts, findings, and claims, but **no letter
grade** — the publication gate in `apps/scanner/src/run.js` sets the state to
**NS (Not Scored)**. Assay's automated methodology grades token contracts, not
an L1's consensus or its bridge operators; a letter would be either
misleadingly bad (grading Solana by a wrapper) or misleadingly generous.

Two "no score" states are kept distinct: **N/A** (the concept does not apply;
costs no coverage) and **out of automated scope** (applies but not
machine-checkable yet, e.g. Redeemability; lowers coverage). A *scored*
emissions-minter anchor (ve(3,3) minters and similar) is future methodology
work; today such a mint gate is named descriptively but still scores as
insufficient data.

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

- **0.2.1** — The rug-ready cap (§3) now fires only when externally-owned
  accounts can withdraw **more than half of a token's total tracked
  liquidity** — the "primary liquidity" the cap text already names — rather
  than whenever *any* pool with non-zero liquidity is single-key-withdrawable.
  A dominant pool that is itself EOA-held is still scored 0 by the liquidity
  dimension, so this only changes the extra hard-cap guard: a small
  EOA-controlled side pool no longer imposes a fatal D on an otherwise-sound
  token (the DEGEN case). The cap reason now reports the withdrawable share
  and names the largest offending pool. Golden tests pin both directions
  (sub-majority side pool → no cap; majority withdrawable → cap holds).
  Standard-profile grades are otherwise unchanged.
- **0.2.0** — Category profiles become normative (§6). Profiles are
  hand-assigned in the reviewed registry only; auto-discovered tokens always
  score `standard`, and every report, index row, and history line is stamped
  with the profile used. `fiat-stablecoin` / `custodial-wrapped`: issuance
  re-anchors to 65 for disclosed custodial control, operative only while an
  approved admin-disclosure claim verifies on every scan; without it the
  profile caps at C (`cap.custodial-undisclosed`). Insider Float and Holder
  Concentration are N/A; Liquidity Permanence is replaced by Redeemability
  (out of automated scope → reduced coverage). New permanent B+ cap for
  custodial issuers (`cap.custodial-issuer`). Relaxed caps remain visible,
  marked waived. `bridged`: mint restricted to an allowlisted canonical
  bridge, verified on-chain each scan, anchors issuance at 85 and admin at 90;
  liquidity permanence N/A; derivative-trust note required.
  `native-representation`: bridged forms of L1 native coins publish facts
  without a letter (new **NS** state). Also fixed: a dominant pool whose LP
  lock status cannot be analyzed now scores as insufficient data (lower
  coverage), not "mostly unlocked" (score 25) — the previous behavior
  published a negative fact derived from missing data, contrary to Principle
  4; a rug-ready finding now also records the dominant LP holder and share.
  Standard-profile scoring is byte-identical to 0.1.0; every 0.1.0 golden
  test is unchanged.
- **0.1.0** — Initial public methodology: eight dimensions, hybrid
  aggregation with hard caps, deterministic claim verdicts (six verifier
  types), Trust Model badges, coverage indicator, age caps at 6/12/24
  months, COI carve-out (see COI-POLICY.md).
