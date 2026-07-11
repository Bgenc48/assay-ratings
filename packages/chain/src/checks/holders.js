// Holder concentration via Blockscout's free API (Etherscan's top-holders
// endpoint is paywalled AND its terms prohibit commercial/AI use — see
// docs/METHODOLOGY.md data-sources section). Labeled non-circulating
// addresses (pools, lockers, bridges, burn, vesting) are excluded; any
// top holder that is a contract is additionally excluded with an
// "unlabeled contract" note, because contracts are usually infrastructure
// and counting them as whales is the classic false positive.

import { getJson } from "../http.js";
import { rpcBatch, loadEndpoints } from "../rpc.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const LABELS_PATH = fileURLToPath(new URL("../../registries/labels.json", import.meta.url));

export async function loadLabels() {
  return JSON.parse(await readFile(LABELS_PATH, "utf8"));
}

export async function blockscoutHolders(network, address, opts = {}) {
  const config = await loadEndpoints();
  const base = config[network]?.blockscout;
  if (!base) return null;
  const json = await getJson(`${base}/api/v2/tokens/${address}/holders`, opts);
  const items = json?.items ?? [];
  return items.map((item) => ({
    address: (item?.address?.hash ?? item?.address ?? "").toLowerCase(),
    value: item?.value ?? "0",
    isContract: item?.address?.is_contract ?? null,
    name: item?.address?.name ?? null,
  }));
}

/**
 * Returns { top10Pct, holderCount, excluded } or nulls when the API is
 * unreachable. `knownPools` (from the liquidity check) and the labels
 * registry are excluded from the concentration math.
 */
export async function inspectHolders(network, address, totalSupply, knownPools = [], opts = {}) {
  let holders;
  try {
    holders = await blockscoutHolders(network, address, opts);
  } catch {
    return { top10Pct: null, holderCount: null, excluded: [] };
  }
  if (!holders || holders.length === 0) return { top10Pct: null, holderCount: null, excluded: [] };

  const labels = (await loadLabels())[network] ?? {};
  const labelSet = new Set(Object.keys(labels).map((a) => a.toLowerCase()));
  const poolSet = new Set(knownPools.map((p) => p.toLowerCase()));
  const supply = BigInt(totalSupply);

  const excluded = [];
  const counted = [];
  for (const holder of holders) {
    const reason = labelSet.has(holder.address)
      ? `label:${labels[holder.address]?.label ?? "known"}`
      : poolSet.has(holder.address)
        ? "pool"
        : holder.isContract
          ? "unlabeled-contract"
          : null;
    if (reason) excluded.push({ address: holder.address, reason });
    else counted.push(holder);
  }

  let top10 = 0n;
  for (const holder of counted.slice(0, 10)) top10 += BigInt(holder.value);
  const top10Pct = supply > 0n ? Number((top10 * 10000n) / supply) / 100 : null;

  return { top10Pct, holderCount: holders.length, excluded };
}

/** Contract creation age in days, via Blockscout address info. */
export async function inspectAge(network, address, opts = {}) {
  try {
    const config = await loadEndpoints();
    const base = config[network]?.blockscout;
    const json = await getJson(`${base}/api/v2/addresses/${address}`, opts);
    const txHash = json?.creation_tx_hash ?? json?.creation_transaction_hash;
    if (!txHash) return { ageDays: null, creationTx: null };
    const tx = await getJson(`${base}/api/v2/transactions/${txHash}`, opts);
    const ts = tx?.timestamp ? Date.parse(tx.timestamp) : null;
    if (!ts) return { ageDays: null, creationTx: txHash };
    return { ageDays: (Date.now() - ts) / 86_400_000, creationTx: txHash };
  } catch {
    return { ageDays: null, creationTx: null };
  }
}

/** Verified-source flag via Blockscout smart-contract endpoint. */
export async function inspectVerifiedSource(network, address, opts = {}) {
  try {
    const config = await loadEndpoints();
    const base = config[network]?.blockscout;
    const json = await getJson(`${base}/api/v2/smart-contracts/${address}`, opts);
    if (json?.source_code || json?.is_verified === true) return true;
    return false;
  } catch {
    return null; // unknown ≠ unverified
  }
}
