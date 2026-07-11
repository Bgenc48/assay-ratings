import { test } from "node:test";
import assert from "node:assert/strict";
import { rpcBatch, batchCall } from "@assay/chain";

const CHAIN_ID_BASE = "0x2105"; // 8453

function mockTransport(handler) {
  return async (endpoint, batch) => {
    return batch.map((req) => {
      if (req.method === "eth_chainId") return { id: req.id, result: CHAIN_ID_BASE };
      return { id: req.id, ...handler(req, endpoint) };
    });
  };
}

test("batchCall returns results in call order", async () => {
  const transport = mockTransport((req) => ({ result: req.params[0].data + "ff" }));
  const out = await batchCall(
    "base",
    [
      { to: "0x1", data: "0xaa" },
      { to: "0x2", data: "0xbb" },
    ],
    { transport },
  );
  assert.deepEqual(out, ["0xaaff", "0xbbff"]);
});

test("wrong chainId falls through to next endpoint, then fails", async () => {
  let calls = 0;
  const lyingTransport = async (endpoint, batch) => {
    calls++;
    return batch.map((req) => ({ id: req.id, result: req.method === "eth_chainId" ? "0x1" : "0x" }));
  };
  await assert.rejects(rpcBatch("base", [{ method: "eth_call", params: [] }], { transport: lyingTransport }));
  assert.ok(calls >= 2, "should have tried multiple endpoints");
});

test("soft mode turns per-call errors into nulls", async () => {
  const transport = mockTransport((req) =>
    req.params[0]?.to === "0xdead" ? { error: { message: "execution reverted" } } : { result: "0x01" },
  );
  const out = await batchCall(
    "base",
    [
      { to: "0xdead", data: "0x8da5cb5b" },
      { to: "0xbeef", data: "0x18160ddd" },
    ],
    { transport, soft: true },
  );
  assert.deepEqual(out, [null, "0x01"]);
});

test("strict mode treats per-call errors as endpoint failure", async () => {
  const transport = mockTransport(() => ({ error: { message: "boom" } }));
  await assert.rejects(batchCall("base", [{ to: "0x1", data: "0x" }], { transport }));
});
