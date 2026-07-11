import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyClaims, validateClaim } from "@assay/claims";

const approved = (claim) => ({
  quote: "quoted text",
  source: "https://example.com",
  material: true,
  tense: "present",
  review: "approved",
  ...claim,
});

test("pending claims are inert — never verified, never scored", () => {
  const out = verifyClaims(
    [approved({ id: "x", type: "renounced", text: "renounced", review: "pending" })],
    { admin: { ownerAddress: null, proxy: {} } },
  );
  assert.equal(out.length, 0);
});

test("renounced: verified when owner and proxy admin are absent, FALSE otherwise", () => {
  const claim = approved({ id: "r", type: "renounced", text: "ownership renounced" });
  const ok = verifyClaims([claim], { admin: { ownerAddress: null, proxy: {} } });
  assert.equal(ok[0].verdict, "VERIFIED");

  const bad = verifyClaims([claim], { admin: { ownerAddress: "0xabc", proxy: {} } });
  assert.equal(bad[0].verdict, "FALSE");
  assert.match(bad[0].note, /controller exists/i);
  // Language rule: state what the chain shows, never intent.
  assert.doesNotMatch(bad[0].note, /lie|lied|scam|fraud/i);
});

test("fixed_supply: upgradeable contract downgrades to UNVERIFIABLE, not FALSE", () => {
  const claim = approved({ id: "s", type: "fixed_supply", text: "supply is fixed" });
  const out = verifyClaims([claim], {
    supply: { mintable: false, upgradeable: true },
    admin: { proxy: { type: "eip1967" } },
  });
  assert.equal(out[0].verdict, "UNVERIFIABLE");
});

test("fixed_supply: mint selector present = FALSE", () => {
  const claim = approved({ id: "s", type: "fixed_supply", text: "no mint function" });
  const out = verifyClaims([claim], { supply: { mintable: true }, address: "0x1" });
  assert.equal(out[0].verdict, "FALSE");
});

test("lp_locked: verified on burned LP, FALSE on unlocked, UNVERIFIABLE with no pools", () => {
  const claim = approved({ id: "l", type: "lp_locked", text: "liquidity burned" });
  const burned = verifyClaims([claim], {
    liquidity: { pools: [{ lockAnalyzed: true, liquidityUsd: 1, lpBurnedPct: 97, lpLockedPct: 0 }] },
  });
  assert.equal(burned[0].verdict, "VERIFIED");

  const unlocked = verifyClaims([claim], {
    liquidity: { pools: [{ lockAnalyzed: true, liquidityUsd: 1, lpBurnedPct: 3, lpLockedPct: 0 }] },
  });
  assert.equal(unlocked[0].verdict, "FALSE");

  const none = verifyClaims([claim], { liquidity: { pools: [] } });
  assert.equal(none[0].verdict, "UNVERIFIABLE");
});

test("forward-looking claims track until deadline, then verify", () => {
  const claim = approved({
    id: "f",
    type: "lp_locked",
    text: "LP will be locked at launch",
    tense: "forward",
    deadline: "2099-01-01",
  });
  const tracked = verifyClaims([claim], {});
  assert.equal(tracked[0].verdict, "FORWARD_LOOKING");

  const overdue = verifyClaims(
    [{ ...claim, deadline: "2020-01-01" }],
    { liquidity: { pools: [{ lockAnalyzed: true, liquidityUsd: 1, lpBurnedPct: 0, lpLockedPct: 0 }] } },
  );
  assert.equal(overdue[0].verdict, "FALSE");
});

test("multisig: threshold mismatch is FALSE with both numbers in the note", () => {
  const claim = approved({
    id: "m", type: "multisig", text: "3-of-5 treasury", params: { threshold: 3, owners: 5 },
  });
  const out = verifyClaims([claim], { admin: { safe: { threshold: 2, owners: 3 } } });
  assert.equal(out[0].verdict, "FALSE");
  assert.match(out[0].note, /2-of-3/);
  assert.match(out[0].note, /3-of-5/);
});

test("audited claims never verify beyond link-resolution in v1", () => {
  const out = verifyClaims([approved({ id: "a", type: "audited", text: "audited by X" })], {});
  assert.equal(out[0].verdict, "UNVERIFIABLE");
});

test("validateClaim catches the schema violations that matter", () => {
  const problems = validateClaim({ id: "x", type: "renounced", tense: "forward", review: "approved" });
  assert.ok(problems.some((p) => p.includes("quote")));
  assert.ok(problems.some((p) => p.includes("deadline")));
  assert.ok(problems.some((p) => p.includes("material")));
});
