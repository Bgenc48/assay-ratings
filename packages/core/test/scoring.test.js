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
