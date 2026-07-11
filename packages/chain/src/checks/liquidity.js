// Liquidity permanence: enumerate pools via the keyless DexScreener API,
// then read LP-token distribution directly on-chain (the defensible
// evidence). v2-style pools only in v1; v3 position NFTs are a documented
// roadmap item — pools we can't analyze come back lockAnalyzed:false and
// score as insufficient data, never as "safe".

import { getJson } from "../http.js";
import { batchCall, rpcBatch } from "../rpc.js";
import { SELECTORS, callData, encodeAddress, decodeUint } from "../abi.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const LOCKERS_PATH = fileURLToPath(new URL("../../registries/lockers.json", import.meta.url));

export async function loadLockers() {
  return JSON.parse(await readFile(LOCKERS_PATH, "utf8"));
}

const DEXSCREENER = "https://api.dexscreener.com/token-pairs/v1";

/**
 * Returns { pools: [...], totalLiquidityUsd, projectLinks } or
 * { pools: null } when the API is unreachable (insufficient data).
 */
export async function inspectLiquidity(network, address, opts = {}) {
  const chainSlug = network === "base" ? "base" : network;
  let pairs;
  try {
    pairs = await getJson(`${DEXSCREENER}/${chainSlug}/${address}`, opts);
  } catch {
    return { pools: null, totalLiquidityUsd: null, projectLinks: null };
  }
  if (!Array.isArray(pairs)) return { pools: null, totalLiquidityUsd: null, projectLinks: null };

  const lockers = (await loadLockers())[network] ?? { burn: [], lockers: [] };
  const burnSet = new Set(lockers.burn.map((a) => a.toLowerCase()));
  const lockerSet = new Set(lockers.lockers.map((l) => (l.address ?? l).toLowerCase()));

  const pools = [];
  let totalLiquidityUsd = 0;
  let projectLinks = null;

  for (const pair of pairs.slice(0, 8)) {
    const liquidityUsd = pair?.liquidity?.usd ?? null;
    if (liquidityUsd) totalLiquidityUsd += liquidityUsd;
    if (!projectLinks && pair?.info) {
      projectLinks = {
        websites: (pair.info.websites ?? []).map((w) => w.url),
        socials: (pair.info.socials ?? []).map((s) => s.url ?? s.handle),
      };
    }

    const pool = {
      pairAddress: pair.pairAddress,
      dex: pair.dexId,
      labels: pair.labels ?? [],
      quoteSymbol: pair?.quoteToken?.symbol ?? null,
      liquidityUsd,
      pairCreatedAt: pair.pairCreatedAt ?? null,
      lpBurnedPct: null,
      lpLockedPct: null,
      lockMonthsRemaining: null,
      singleEoaWithdrawable: false,
      lockAnalyzed: false,
      evidence: { source: "dexscreener+onchain", pair: pair.pairAddress },
    };

    // v3-style pools have no fungible LP token to analyze.
    const isV2Style = !(pair.labels ?? []).some((l) => /v3|v4|cl/i.test(l));
    if (isV2Style && pair.pairAddress) {
      try {
        const lp = pair.pairAddress;
        const holders = [...burnSet, ...lockerSet];
        const calls = [
          { to: lp, data: SELECTORS.totalSupply },
          ...holders.map((h) => ({ to: lp, data: callData(SELECTORS.balanceOf, encodeAddress(h)) })),
        ];
        const results = await batchCall(network, calls, { ...opts, soft: true });
        const supply = decodeUint(results[0]);
        if (supply && supply > 0n) {
          let burned = 0n;
          let locked = 0n;
          holders.forEach((holder, i) => {
            const bal = safeUint(results[i + 1]);
            if (burnSet.has(holder)) burned += bal;
            else locked += bal;
          });
          pool.lpBurnedPct = pct(burned, supply);
          pool.lpLockedPct = pct(locked, supply);
          pool.lockAnalyzed = true;

          // If neither burned nor in a known locker, find whether one
          // non-contract address dominates the LP supply (rug-ready).
          if (pool.lpBurnedPct + pool.lpLockedPct < 50) {
            pool.singleEoaWithdrawable = await dominantEoaHoldsLp(network, lp, supply, opts);
          }
        }
      } catch {
        // Leave lockAnalyzed:false — scored as insufficient data.
      }
    }
    pools.push(pool);
  }

  return { pools, totalLiquidityUsd: totalLiquidityUsd || null, projectLinks };
}

/**
 * Best-effort check via Blockscout: does a single EOA hold >50% of this LP
 * token? Conservative: any failure returns false (we never *assert*
 * rug-ready without evidence; the low burned/locked % already scores 25).
 */
async function dominantEoaHoldsLp(network, lpAddress, lpSupply, opts = {}) {
  try {
    const { blockscoutHolders } = await import("./holders.js");
    const holders = await blockscoutHolders(network, lpAddress, opts);
    if (!holders?.length) return false;
    const top = holders[0];
    const share = pct(BigInt(top.value), lpSupply);
    if (share <= 50) return false;
    const [code] = await rpcBatch(network, [{ method: "eth_getCode", params: [top.address, "latest"] }], opts);
    return code === "0x";
  } catch {
    return false;
  }
}

function pct(part, whole) {
  if (!whole || whole === 0n) return 0;
  return Number((part * 10000n) / whole) / 100;
}

function safeUint(hex) {
  try {
    const v = decodeUint(hex);
    return v ?? 0n;
  } catch {
    return 0n;
  }
}
