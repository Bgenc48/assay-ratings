// Golden tests for the scoring engine. These encode the methodology's own
// sanity checks: the famous-token table, the mint-backdoor test, the
// claim-light floor, and the "no A on day one" rule. If a methodology change
// moves one of these, the change is either wrong or needs a version bump and
// a changelog entry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreToken, letterFor, METHODOLOGY_VERSION } from "@assay/core";

// --- fixtures -------------------------------------------------------------

/** A structurally perfect, aged, fixed-supply token with honest docs. */
function pristine(overrides = {}) {
  return {
    meta: { verifiedSource: true },
    supply: { mintable: false, upgradeable: false, feeOnTransfer: false },
    admin: { ownerAddress: null, ownerType: "none", privilegedSelectors: [], proxy: {} },
    claims: [
      { id: "c1", type: "no_mint", text: "supply is fixed", material: true, verdict: "VERIFIED" },
      { id: "c2", type: "lp_locked", text: "LP burned", material: true, verdict: "VERIFIED" },
    ],
    insiders: { liquidFloatPct: 0, codeVestedPct: 100 },
    liquidity: { pools: [{ liquidityUsd: 5_000_000, lpBurnedPct: 95, lpLockedPct: 0 }] },
    track: { ageDays: 800, violations: [] },
    holders: { top10Pct: 8 },
    governance: { claimed: false },
    ...overrides,
  };
}

// --- the tests that define the product ------------------------------------

test("mint-backdoor test: perfect everything + EOA mint = F, not B+", () => {
  const r = pristine({
    supply: { mintable: true, mintGate: "eoa", upgradeable: false },
  });
  const s = scoreToken(r);
  assert.equal(s.letter, "F");
  assert.ok(s.caps.some((c) => c.id === "cap.eoa-mint" && c.letter === "F"));
});

test("unclassifiable mint gate = insufficient data (cap C), never auto-F (the AERO lesson)", () => {
  const r = pristine({
    supply: { mintable: true, mintGate: "unknown", upgradeable: false },
  });
  const s = scoreToken(r);
  assert.ok(!s.caps.some((c) => c.id === "cap.eoa-mint"), "no F without positive EOA evidence");
  assert.ok(s.caps.some((c) => c.id === "cap.unclassified-mint" && c.letter === "C"));
  assert.equal(s.letter, "C");
  const finding = s.dimensions.supplyIntegrity.findings.find((f) => f.id === "supply.unclassified-mint");
  assert.match(finding.text, /insufficient data/i);
});

test("materially false claim caps at D even when structure is A-grade", () => {
  const r = pristine({
    claims: [{ id: "c1", type: "lp_locked", text: "liquidity locked 2 years", material: true, verdict: "FALSE" }],
  });
  const s = scoreToken(r);
  assert.equal(s.letter, "D");
  assert.ok(s.caps.some((c) => c.id === "cap.false-claim"));
});

test("no token gets an A before 12 months (the ATA rule)", () => {
  const young = pristine({ track: { ageDays: 100, violations: [] } });
  const s = scoreToken(young);
  assert.ok(["B+", "B", "B-"].includes(s.letter), `expected <=B+ got ${s.letter}`);
  assert.equal(s.provisional, true);

  const older = pristine({ track: { ageDays: 400, violations: [] } });
  const s2 = scoreToken(older);
  assert.equal(s2.letter, "A", "13 months clean = A, but A+ needs 24 months");
  assert.ok(s2.caps.some((c) => c.id === "cap.age-24mo"));
});

test("aged pristine token can reach A territory", () => {
  const s = scoreToken(pristine());
  assert.ok(s.overall >= 85, `expected >=85 got ${s.overall}`);
  assert.ok(["A", "A-", "A+"].includes(s.letter));
  assert.equal(s.badge, "Code-Enforced");
});

test("claim-light memecoin: floor 70 on disclosure, permanent B+ cap", () => {
  const shibLike = pristine({
    claims: [],
    holders: { top10Pct: 38 },
    track: { ageDays: 1500, violations: [] },
    insiders: { liquidFloatPct: 2, codeVestedPct: 0 },
  });
  const s = scoreToken(shibLike);
  assert.equal(s.dimensions.disclosureIntegrity.score, 70);
  assert.ok(s.caps.some((c) => c.id === "cap.claim-light" && c.letter === "B+"));
  assert.ok(["B", "B+", "B-"].includes(s.letter), `got ${s.letter}`);
});

test("rug-ready pool: single-EOA-withdrawable liquidity caps at D", () => {
  const r = pristine({
    liquidity: { pools: [{ liquidityUsd: 100_000, lpBurnedPct: 0, lpLockedPct: 0, singleEoaWithdrawable: true }] },
  });
  const s = scoreToken(r);
  assert.ok(["D", "F"].includes(s.letter));
  assert.equal(s.dimensions.liquidityPermanence.score, 0);
});

test("unverified source caps overall at C and is scored as missing data, not zero", () => {
  const r = pristine({ meta: { verifiedSource: false } });
  const s = scoreToken(r);
  assert.ok(["C", "D", "F"].includes(s.letter));
  assert.ok(s.caps.some((c) => c.id === "cap.unverified" && c.letter === "C"));
});

test("governance theater is punished and reweights admin", () => {
  const r = pristine({
    governance: { claimed: true, governorExecutes: false },
  });
  const s = scoreToken(r);
  assert.equal(s.weights.governanceReality, 5);
  assert.equal(s.weights.adminSurface, 15);
  assert.equal(s.dimensions.governanceReality.score, 10);
});

test("missing data lowers coverage, never the score", () => {
  const thin = {
    meta: { verifiedSource: true },
    supply: { mintable: false, upgradeable: false },
    admin: { ownerAddress: null, ownerType: "none", privilegedSelectors: [], proxy: {} },
    claims: [],
    // insiders, liquidity, track, holders all unknown
  };
  const s = scoreToken(thin);
  assert.notEqual(s.letter, "F");
  assert.equal(s.coverage, "thin");
  assert.equal(s.dimensions.insiderFloat.score, null);
  assert.equal(s.dimensions.trackRecord.score, null);
  assert.equal(s.provisional, true);
});

test("fewer than 3 scorable dimensions = N/R, never a fabricated grade", () => {
  const s = scoreToken({ meta: {}, claims: [], claimsCrawled: false });
  assert.equal(s.letter, "N/R");
  assert.equal(s.overall, null);
});

test("insider float >30% caps at C", () => {
  const r = pristine({ insiders: { liquidFloatPct: 45, codeVestedPct: 10 } });
  const s = scoreToken(r);
  assert.ok(["C", "D", "F"].includes(s.letter));
  assert.ok(s.caps.some((c) => c.id === "cap.insider-float"));
});

test("letter banding is exact at the boundaries", () => {
  assert.equal(letterFor(95), "A+");
  assert.equal(letterFor(89), "A");
  assert.equal(letterFor(85), "A-");
  assert.equal(letterFor(84.9), "B+");
  assert.equal(letterFor(70), "B-");
  assert.equal(letterFor(69.9), "C");
  assert.equal(letterFor(55), "C");
  assert.equal(letterFor(40), "D");
  assert.equal(letterFor(39.9), "F");
});

test("every result is stamped with the methodology version", () => {
  const s = scoreToken(pristine());
  assert.equal(s.methodology_version, METHODOLOGY_VERSION);
});

// --- category profiles (methodology v0.2) ---------------------------------

/** A USDC-shaped custodial stablecoin: EOA-classified mint, EOA proxy admin. */
function custodialStable(overrides = {}) {
  return {
    profile: "fiat-stablecoin",
    meta: { verifiedSource: true },
    supply: { mintable: true, mintGate: "eoa", upgradeable: true },
    admin: {
      ownerAddress: "0x00000000000000000000000000000000000000aa",
      ownerType: "eoa",
      controlType: "eoa",
      privilegedSelectors: [
        { sig: "0x40c10f19", kind: "mint", material: true },
        { sig: "0x8456cb59", kind: "pause", material: true },
      ],
      proxy: { type: "eip1967", admin: "0x00000000000000000000000000000000000000ab" },
    },
    claims: [
      { id: "d1", type: "admin_disclosure", text: "issuer documents mint/pause/upgrade powers", material: true, verdict: "VERIFIED" },
      { id: "a1", type: "audited", text: "monthly reserve attestations", material: false, verdict: "UNVERIFIABLE" },
    ],
    liquidity: { pools: [{ liquidityUsd: 1_500_000, lockAnalyzed: true, lpBurnedPct: 0, lpLockedPct: 0 }] },
    track: { ageDays: 1000, violations: [] },
    holders: { top10Pct: 80 },
    insiders: { liquidFloatPct: null },
    governance: { claimed: false },
    ...overrides,
  };
}

test("profile: disclosed fiat stablecoin lands B-range; the F cap stays visible but waived", () => {
  const s = scoreToken(custodialStable());
  assert.ok(["B", "B-"].includes(s.letter), `expected B/B- got ${s.letter} (${s.overall})`);
  const eoaMint = s.caps.find((c) => c.id === "cap.eoa-mint");
  assert.ok(eoaMint, "the structural EOA-mint fact must stay on the report");
  assert.equal(eoaMint.waived, true);
  assert.match(eoaMint.waivedBy, /admin_disclosure VERIFIED/);
  const issuerCap = s.caps.find((c) => c.id === "cap.custodial-issuer");
  assert.ok(issuerCap && issuerCap.letter === "B+" && !issuerCap.waived, "permanent custodial ceiling");
  assert.equal(s.dimensions.insiderFloat.notApplicable, true);
  assert.equal(s.dimensions.holderConcentration.notApplicable, true);
  assert.equal(s.dimensions.liquidityPermanence.score, null, "redeemability is out of automated scope");
  assert.equal(s.profile, "fiat-stablecoin");
  assert.equal(s.badge, "Custodial (disclosed)");
});

test("profile: the same structure WITHOUT a profile still F-caps (mint-backdoor invariant)", () => {
  const { profile, ...rest } = custodialStable();
  void profile;
  const s = scoreToken(rest);
  assert.equal(s.letter, "F");
  const eoaMint = s.caps.find((c) => c.id === "cap.eoa-mint");
  assert.ok(eoaMint && !eoaMint.waived, "claims alone must unlock nothing without the reviewed profile");
});

test("profile: custodial without verified disclosure caps at C (insufficient data), never F or D", () => {
  const s = scoreToken(custodialStable({ claims: [] }));
  assert.equal(s.letter, "C");
  assert.ok(s.caps.some((c) => c.id === "cap.custodial-undisclosed" && c.letter === "C" && !c.waived));
  assert.ok(!s.caps.some((c) => (c.letter === "F" || c.letter === "D") && !c.waived),
    "no active F/D cap in the undisclosed intermediate state");
  const supply = s.dimensions.supplyIntegrity.findings.find((x) => x.id === "supply.custodial-undisclosed");
  assert.match(supply.text, /insufficient data/i);
});

test("profile: a materially FALSE claim still caps a custodial token at D — a profile is not a pass", () => {
  const s = scoreToken(custodialStable({
    claims: [
      { id: "d1", type: "admin_disclosure", text: "issuer documents powers", material: true, verdict: "VERIFIED" },
      { id: "x1", type: "lp_locked", text: "reserves fully locked on-chain", material: true, verdict: "FALSE" },
    ],
  }));
  assert.equal(s.letter, "D");
  assert.ok(s.caps.some((c) => c.id === "cap.false-claim" && !c.waived));
});

test("profile: a custodial issuer can never exceed B+", () => {
  // Best-case custodial: aged, disclosed, perfect claims record.
  const s = scoreToken(custodialStable({ track: { ageDays: 3000, violations: [] } }));
  assert.ok(["B+", "B", "B-", "C", "D", "F"].includes(s.letter));
  assert.ok(letterFor(s.overall) !== "A" || s.letter !== "A", "letter must respect the B+ ceiling");
  assert.ok(!["A+", "A", "A-"].includes(s.letter), `custodial must never reach A-range, got ${s.letter}`);
});

test("profile: redeemability out of scope lowers coverage, not the score", () => {
  const s = scoreToken(custodialStable());
  // Applicable: supply, admin, disclosure, redeemability, track — 4 of 5 scored.
  assert.equal(s.coverage, "full");
  const disclosedDims = Object.values(s.dimensions).filter((d) => !d.notApplicable);
  const nullScored = disclosedDims.filter((d) => d.score === null);
  assert.equal(nullScored.length, 1, "exactly the redeemability dimension is applicable-but-unscored");
});

test("profile: bridged token with canonical bridge gate scores 85 supply and carries no mint cap", () => {
  const bridged = {
    profile: "bridged",
    meta: { verifiedSource: true },
    supply: { mintable: true, mintGate: "bridge", upgradeable: false },
    admin: {
      ownerAddress: null,
      ownerType: "none",
      controlType: "none",
      privilegedSelectors: [{ sig: "0x40c10f19", kind: "mint", material: true }],
      proxy: {},
    },
    claims: [],
    track: { ageDays: 900, violations: [] },
    holders: { top10Pct: 30 },
    insiders: { liquidFloatPct: null },
    governance: { claimed: false },
  };
  const s = scoreToken(bridged);
  assert.equal(s.dimensions.supplyIntegrity.score, 85);
  assert.equal(s.dimensions.adminSurface.score, 90);
  assert.ok(!s.caps.some((c) => c.id === "cap.eoa-mint" || c.id === "cap.unclassified-mint"));
  assert.equal(s.badge, "Bridged (canonical)");
  assert.equal(s.dimensions.insiderFloat.notApplicable, true);
  assert.equal(s.dimensions.liquidityPermanence.notApplicable, true);
  // Same token with an unclassifiable gate falls back to standard treatment.
  const fallback = scoreToken({ ...bridged, supply: { mintable: true, mintGate: "unknown", upgradeable: false } });
  assert.ok(fallback.caps.some((c) => c.id === "cap.unclassified-mint" && !c.waived));
  assert.equal(fallback.letter, "C");
});

test("profile: unknown profile value throws instead of silently scoring", () => {
  assert.throws(() => scoreToken(pristine({ profile: "stablecoin" })), /unknown category profile/);
});

test("profile: results are stamped; default is standard", () => {
  assert.equal(scoreToken(pristine()).profile, "standard");
  assert.equal(scoreToken(custodialStable()).profile, "fiat-stablecoin");
});

test("an unanalyzed dominant pool is insufficient data, never 'mostly unlocked'", () => {
  // v3-style position pools (and unreadable LP distributions) come back
  // lockAnalyzed:false with null burn/lock percentages. That must lower
  // coverage, not the score — publishing "mostly unlocked" for a pool we
  // never read is a negative fact fabricated from missing data.
  const r = pristine({
    liquidity: {
      pools: [{
        liquidityUsd: 2_000_000,
        lpBurnedPct: null,
        lpLockedPct: null,
        lockAnalyzed: false,
        singleEoaWithdrawable: false,
      }],
    },
  });
  const s = scoreToken(r);
  assert.equal(s.dimensions.liquidityPermanence.score, null);
  const finding = s.dimensions.liquidityPermanence.findings.find((x) => x.id === "liq.unanalyzed");
  assert.ok(finding, "expected liq.unanalyzed finding");
  assert.match(finding.text, /insufficient data/i);
  assert.ok(!s.dimensions.liquidityPermanence.findings.some((x) => x.id === "liq.unlocked"),
    "must not assert 'mostly unlocked' without lock data");
  // The rug-ready assertion still wins when it carries positive evidence.
  const rug = pristine({
    liquidity: { pools: [{ liquidityUsd: 100_000, lockAnalyzed: true, lpBurnedPct: 0, lpLockedPct: 0, singleEoaWithdrawable: true }] },
  });
  assert.equal(scoreToken(rug).dimensions.liquidityPermanence.score, 0);
});
