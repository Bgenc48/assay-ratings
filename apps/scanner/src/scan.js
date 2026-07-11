// Per-token scan: chain checks → claim verification → deterministic score.
// Produces a TokenReport with evidence on every finding. The report NEVER
// invents data: anything unreadable arrives as null and scores as reduced
// coverage.

import { inspectToken, inspectLiquidity, inspectHolders, inspectAge, inspectVerifiedSource } from "@assay/chain";
import { verifyClaims } from "@assay/claims";
import { scoreToken, METHODOLOGY_VERSION } from "@assay/core";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function scanToken(entry, { rootDir = process.cwd(), transport, fetcher, now = new Date() } = {}) {
  const { chain, address } = entry;
  const rpcOpts = transport ? { transport } : {};
  const httpOpts = fetcher ? { fetcher } : {};

  // ---- Chain reads ---------------------------------------------------------
  const token = await inspectToken(chain, address, rpcOpts);

  // Registry sanity gate: if the symbol on-chain does not match what the
  // registry expects, we publish NOTHING for this entry — a wrong address
  // in the registry must never produce a published grade for the wrong
  // contract (the worst self-inflicted failure a rating site can have).
  if (entry.expectSymbol && token.meta.symbol && token.meta.symbol !== entry.expectSymbol) {
    return {
      address,
      chain,
      status: "registry_mismatch",
      note: `On-chain symbol "${token.meta.symbol}" does not match registry expectation "${entry.expectSymbol}". Entry needs human review.`,
      scanned_at: now.toISOString(),
    };
  }

  const [liquidity, verifiedSource, age] = await Promise.all([
    // Liquidity needs both the HTTP fetcher (pool discovery) and the RPC
    // transport (LP-token distribution reads).
    inspectLiquidity(chain, address, { ...httpOpts, ...rpcOpts }),
    inspectVerifiedSource(chain, address, { ...httpOpts }),
    inspectAge(chain, address, { ...httpOpts }),
  ]);

  const poolAddresses = (liquidity.pools ?? []).map((p) => p.pairAddress).filter(Boolean);
  const holders = await inspectHolders(chain, address, token.meta.totalSupply, poolAddresses, { ...httpOpts });

  // ---- Claims --------------------------------------------------------------
  // Fixture entries may carry claims inline; real tokens read from the
  // reviewed registry/claims tree.
  let claimRecords = entry.claims ?? [];
  if (claimRecords.length === 0) {
    try {
      const file = path.join(rootDir, "registry", "claims", chain, `${address.toLowerCase()}.json`);
      claimRecords = JSON.parse(await readFile(file, "utf8")).claims ?? [];
    } catch {
      /* no claims file — claim-light */
    }
  }

  const checksForClaims = {
    address,
    supply: token.supply,
    admin: token.admin,
    liquidity,
  };
  const verdicts = verifyClaims(claimRecords, checksForClaims, { now });

  // ---- Assemble CheckResults for the scorer --------------------------------
  const controlType =
    token.admin.controlType === "timelock"
      ? "governor-timelock"
      : token.admin.controlType === "safe"
        ? "safe"
        : token.admin.controlType === "eoa"
          ? "eoa"
          : token.admin.controlType === "none"
            ? "none"
            : token.admin.controller
              ? "unknown"
              : "none";

  const checkResults = {
    address,
    meta: { ...token.meta, verifiedSource },
    supply: {
      ...token.supply,
      mintGate: token.supply.mintable ? mintGateFor(controlType) : null,
      evidence: token.evidence,
    },
    admin: {
      ownerAddress: token.admin.ownerAddress,
      ownerType: token.admin.ownerAddress ? token.admin.controlType : "none",
      controlType,
      safe: token.admin.safe,
      timelockDelaySeconds: token.admin.timelockDelaySeconds,
      privilegedSelectors: token.admin.privilegedSelectors,
      proxy: token.admin.proxy,
      evidence: token.evidence,
    },
    claims: verdicts.map((v) => ({ ...v, material: v.material ?? false })),
    claimsCrawled: claimRecords.length > 0 ? true : entry.docsChecked === false ? false : true,
    insiders: entry.insiders ?? { liquidFloatPct: null },
    liquidity,
    track: { ageDays: age.ageDays, violations: entry.violations ?? [], evidence: age.creationTx },
    holders,
    governance: entry.governance ?? { claimed: false },
  };

  const scoring = scoreToken(checkResults);

  return {
    address,
    chain,
    status: "ok",
    symbol: token.meta.symbol,
    name: token.meta.name,
    scanned_at: now.toISOString(),
    methodology_version: METHODOLOGY_VERSION,
    grade: {
      letter: scoring.letter,
      overall: scoring.overall,
      provisional: scoring.provisional,
      badge: scoring.badge,
      coverage: scoring.coverage,
    },
    dimensions: Object.fromEntries(
      Object.entries(scoring.dimensions).map(([k, d]) => [
        k,
        { score: d.score, notApplicable: d.notApplicable ?? false, findings: d.findings },
      ]),
    ),
    caps: scoring.caps,
    claims: verdicts,
    facts: {
      totalSupply: token.meta.totalSupply,
      decimals: token.meta.decimals,
      owner: token.admin.ownerAddress,
      controlType,
      proxy: token.admin.proxy.type,
      privileged: token.admin.privilegedSelectors.map((s) => s.sig),
      verifiedSource,
      ageDays: age.ageDays === null ? null : Math.round(age.ageDays),
      liquidityUsd: liquidity.totalLiquidityUsd,
      pools: (liquidity.pools ?? []).map((p) => ({
        pair: p.pairAddress,
        dex: p.dex,
        liquidityUsd: p.liquidityUsd,
        lpBurnedPct: p.lpBurnedPct,
        lpLockedPct: p.lpLockedPct,
        lockAnalyzed: p.lockAnalyzed,
      })),
      top10Pct: holders.top10Pct,
      projectLinks: liquidity.projectLinks,
    },
  };
}

// Mint gate classification from the classified controller. A mint gated by
// a timelock'd governor scores far above an EOA mint. When no controller
// can be classified (no owner, no proxy admin — e.g. an internal minter
// contract), the gate is UNKNOWN: insufficient data, never assumed open.
function mintGateFor(controlType) {
  if (controlType === "governor-timelock") return "governance-timelock";
  if (controlType === "safe") return "multisig";
  if (controlType === "eoa") return "eoa";
  return "unknown";
}
