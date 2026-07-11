import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeUint,
  decodeAddress,
  decodeString,
  decodeAddressArray,
  scanSelectors,
  encodeAddress,
  callData,
  SELECTORS,
} from "@assay/chain";

test("decodeUint", () => {
  assert.equal(decodeUint("0x" + "0".repeat(63) + "5"), 5n);
  assert.equal(decodeUint(null), null);
});

test("decodeAddress strips padding and nulls the zero address", () => {
  const padded = "0x" + "0".repeat(24) + "ab".repeat(20);
  assert.equal(decodeAddress(padded), "0x" + "ab".repeat(20));
  assert.equal(decodeAddress("0x" + "0".repeat(64)), null);
});

test("decodeString handles dynamic strings", () => {
  // offset=0x20, len=4, "USDC"
  const hex =
    "0x" +
    "20".padStart(64, "0") +
    "4".padStart(64, "0") +
    Buffer.from("USDC").toString("hex").padEnd(64, "0");
  assert.equal(decodeString(hex), "USDC");
});

test("decodeString handles bytes32 legacy names", () => {
  const hex = "0x" + Buffer.from("MKR").toString("hex").padEnd(64, "0");
  assert.equal(decodeString(hex), "MKR");
});

test("decodeAddressArray decodes Safe getOwners output", () => {
  const a1 = "11".repeat(20);
  const a2 = "22".repeat(20);
  const hex =
    "0x" +
    "20".padStart(64, "0") +
    "2".padStart(64, "0") +
    a1.padStart(64, "0") +
    a2.padStart(64, "0");
  assert.deepEqual(decodeAddressArray(hex), ["0x" + a1, "0x" + a2]);
});

test("scanSelectors finds mint and pause in bytecode", () => {
  const bytecode = "0x6080604052" + "40c10f19" + "aabbcc" + "8456cb59";
  const found = scanSelectors(bytecode);
  const kinds = found.map((f) => f.kind);
  assert.ok(kinds.includes("mint"));
  assert.ok(kinds.includes("pause"));
});

test("scanSelectors on clean bytecode finds nothing", () => {
  assert.deepEqual(scanSelectors("0x6080604052deadbeef"), []);
});

test("callData composes selector + encoded address", () => {
  const data = callData(SELECTORS.balanceOf, encodeAddress("0x" + "ab".repeat(20)));
  assert.equal(data, "0x70a08231" + "0".repeat(24) + "ab".repeat(20));
});
