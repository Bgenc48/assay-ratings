// Canonical-bridge mint check (methodology v0.2, bridged profile).
// Deterministic and fail-soft: reads the token's declared bridge address via
// the selector conventions used by OP-stack bridged tokens and compares it
// against the reviewed allowlist in registries/bridges.json. Any revert or
// unreadable result returns canonical:false — the scanner then falls back to
// the standard mint-gate treatment (insufficient data, never fabricated).

import { batchCall } from "../rpc.js";
import { SELECTORS, decodeAddress } from "../abi.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const BRIDGES_PATH = fileURLToPath(new URL("../../registries/bridges.json", import.meta.url));

export async function loadBridges() {
  return JSON.parse(await readFile(BRIDGES_PATH, "utf8"));
}

const PROBES = ["l2Bridge", "bridge", "BRIDGE"];

export async function inspectBridgeMint(network, address, opts = {}) {
  const registry = (await loadBridges())[network] ?? [];
  const allowed = new Set(registry.map((b) => (b.address ?? b).toLowerCase()));

  let results;
  try {
    results = await batchCall(
      network,
      PROBES.map((p) => ({ to: address, data: SELECTORS[p] })),
      { ...opts, soft: true },
    );
  } catch {
    return { bridgeAddress: null, canonical: false, evidence: null };
  }

  for (let i = 0; i < PROBES.length; i++) {
    let addr = null;
    try {
      addr = decodeAddress(results[i]);
    } catch {
      /* unreadable — try the next convention */
    }
    if (addr) {
      return {
        bridgeAddress: addr,
        canonical: allowed.has(addr.toLowerCase()),
        evidence: { type: "eth_call", to: address, selector: `${PROBES[i]}()`, result: addr },
      };
    }
  }
  return { bridgeAddress: null, canonical: false, evidence: null };
}
