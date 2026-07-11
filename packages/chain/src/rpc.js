// Read-only JSON-RPC client. Public endpoints, no API keys, no libraries.
// Adapted from the ATA Coin site client (MIT). Every batch verifies the
// endpoint's eth_chainId before trusting any result, and endpoints are
// tried in order until one answers correctly.
//
// The `transport` parameter exists so tests (and offline scans) can inject
// a recorded transport instead of the network.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ENDPOINTS_PATH = fileURLToPath(new URL("../registries/endpoints.json", import.meta.url));

let endpointsCache = null;
export async function loadEndpoints() {
  if (!endpointsCache) endpointsCache = JSON.parse(await readFile(ENDPOINTS_PATH, "utf8"));
  return endpointsCache;
}

const TIMEOUT_MS = 8000;

export async function httpTransport(endpoint, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a batch of JSON-RPC requests against the first healthy endpoint
 * for `network`. Each request: { method, params }. Returns results in order.
 * Throws if every endpoint fails or lies about its chainId.
 */
export async function rpcBatch(network, requests, { transport = httpTransport, soft = false } = {}) {
  const config = await loadEndpoints();
  const net = config[network];
  if (!net) throw new Error(`Unknown network: ${network}`);

  const batch = [
    { jsonrpc: "2.0", id: 0, method: "eth_chainId", params: [] },
    ...requests.map((request, i) => ({ jsonrpc: "2.0", id: i + 1, method: request.method, params: request.params })),
  ];

  let lastError;
  for (const endpoint of net.endpoints) {
    try {
      const replies = await transport(endpoint, batch);
      if (!Array.isArray(replies)) throw new Error("Non-batch reply");
      const byId = new Map(replies.map((r) => [r.id, r]));

      const chainReply = byId.get(0);
      if (!chainReply?.result || Number(BigInt(chainReply.result)) !== net.chainId) {
        throw new Error(`Wrong chainId from ${endpoint}`);
      }

      return requests.map((_, i) => {
        const reply = byId.get(i + 1);
        if (!reply || reply.error) {
          // In soft mode a REVERT is data (e.g. owner() on an ownerless
          // token). Anything else — rate limits, server errors, missing
          // replies — is an endpoint failure and must fail over to the
          // next endpoint, or a throttled endpoint would silently turn
          // real chain state into nulls.
          if (soft && isRevert(reply?.error)) return null;
          const err = new Error(reply?.error?.message ?? "Missing reply");
          err.rpcError = true;
          throw err;
        }
        return reply.result;
      });
    } catch (error) {
      lastError = error;
      // Try the next public endpoint.
    }
  }
  throw lastError ?? new Error("All RPC endpoints failed");
}

function isRevert(error) {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  if (/rate|limit|too many|capacity|timeout|busy|unavailable/.test(msg)) return false;
  // EVM execution errors: revert text, or the JSON-RPC execution-error
  // code 3 / provider -32000-family with revert-shaped messages.
  return (
    /revert|execution|invalid opcode|out of gas|vm exception/.test(msg) ||
    error.code === 3 ||
    (typeof error.code === "number" && error.code === -32000 && !/header|block|state/.test(msg))
  );
}

/** Convenience: batch of eth_call { to, data } against latest block. */
export async function batchCall(network, calls, opts) {
  return rpcBatch(
    network,
    calls.map((c) => ({ method: "eth_call", params: [{ to: c.to, data: c.data }, "latest"] })),
    opts,
  );
}
