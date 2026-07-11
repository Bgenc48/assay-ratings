import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCandidates } from "../src/discover.js";

const page = {
  data: [
    {
      attributes: { reserve_in_usd: "2500000" },
      relationships: { base_token: { data: { id: "base_0x" + "11".repeat(20) } } },
    },
    {
      attributes: { reserve_in_usd: "50" }, // dust — below the floor
      relationships: { base_token: { data: { id: "base_0x" + "22".repeat(20) } } },
    },
    {
      attributes: { reserve_in_usd: "900000" },
      relationships: { base_token: { data: { id: "base_0x" + "33".repeat(20) } } },
    },
  ],
  included: [
    { type: "token", id: "base_0x" + "11".repeat(20), attributes: { address: "0x" + "11".repeat(20), symbol: "ALPHA", name: "Alpha" } },
    { type: "token", id: "base_0x" + "33".repeat(20), attributes: { address: "0x" + "33".repeat(20), symbol: "WETH", name: "Wrapped Ether" } },
  ],
};

test("extractCandidates: liquidity floor, quote-asset skip, address validation", () => {
  const out = extractCandidates(page);
  assert.equal(out.length, 1);
  assert.equal(out[0].symbol, "ALPHA");
  assert.equal(out[0].address, "0x" + "11".repeat(20));
  assert.equal(out[0].reserve, 2500000);
});

test("extractCandidates: malformed page yields nothing, never throws", () => {
  assert.deepEqual(extractCandidates({}), []);
  assert.deepEqual(extractCandidates({ data: [{}], included: null }), []);
});
