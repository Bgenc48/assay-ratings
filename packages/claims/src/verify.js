// Deterministic claim verification. Maps each approved claim to chain
// evidence gathered by the scanner and returns a verdict:
//
//   VERIFIED         — chain state matches the claim
//   FALSE            — chain state contradicts the claim
//   UNVERIFIABLE     — nothing on-chain can confirm or deny it
//   FORWARD_LOOKING  — commitment not yet due (tracked with its deadline)
//   STALE            — was verified before, underlying state changed
//
// Language rule (defamation posture): FALSE verdicts state what the chain
// shows ("no lock found at block N"), never intent ("they lied").

export function verifyClaims(claims, checks, { now = new Date() } = {}) {
  return claims
    .filter((c) => c.review === "approved")
    .map((claim) => {
      // Forward-looking claims are commitments until their deadline.
      if (claim.tense === "forward") {
        const due = claim.deadline ? new Date(claim.deadline) : null;
        if (!due || due > now) {
          return verdict(claim, "FORWARD_LOOKING", `Commitment tracked; due ${claim.deadline ?? "unspecified"}.`, null);
        }
        // Deadline passed: verify as if present-tense; a miss is FALSE.
      }
      return verifyPresent(claim, checks);
    });
}

function verifyPresent(claim, checks) {
  switch (claim.type) {
    case "fixed_supply": {
      if (checks.supply?.mintable === true) {
        return verdict(claim, "FALSE",
          "A mint function selector is present in the deployed bytecode.",
          ev("bytecode-selector", checks.address, "mint"));
      }
      if (checks.supply?.mintable === false && !checks.supply?.upgradeable) {
        return verdict(claim, "VERIFIED",
          "No mint path exists in the deployed bytecode and the contract is not upgradeable.",
          ev("bytecode-scan", checks.address, "no-mint"));
      }
      if (checks.supply?.upgradeable) {
        return verdict(claim, "UNVERIFIABLE",
          "No mint function today, but the contract is upgradeable — fixed supply cannot be guaranteed by code.",
          ev("proxy-slot", checks.address, checks.admin?.proxy?.type));
      }
      return verdict(claim, "UNVERIFIABLE", "Supply behavior could not be determined.", null);
    }

    case "renounced": {
      const owner = checks.admin?.ownerAddress ?? null;
      const proxyAdmin = checks.admin?.proxy?.admin ?? null;
      if (owner === null && proxyAdmin === null) {
        return verdict(claim, "VERIFIED", "owner() is unset/zero and no proxy admin exists.",
          ev("eth_call", checks.address, "owner()=0x0"));
      }
      return verdict(claim, "FALSE",
        `A controller exists on-chain (${owner ?? proxyAdmin}).`,
        ev("eth_call", checks.address, `owner()=${owner ?? proxyAdmin}`));
    }

    case "lp_locked": {
      const pools = checks.liquidity?.pools ?? [];
      const analyzed = pools.filter((p) => p.lockAnalyzed);
      if (analyzed.length === 0) {
        return verdict(claim, "UNVERIFIABLE", "No analyzable liquidity pool found for this token yet.", null);
      }
      const main = analyzed.sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))[0];
      const secured = (main.lpBurnedPct ?? 0) + (main.lpLockedPct ?? 0);
      const minMonths = claim.params?.minMonths ?? 0;
      if (secured >= 90 && (main.lpBurnedPct >= 90 || (main.lockMonthsRemaining ?? 0) >= minMonths)) {
        return verdict(claim, "VERIFIED",
          `${secured.toFixed(0)}% of the dominant pool's LP is burned or in an allowlisted locker.`,
          ev("lp-holders", main.pairAddress, `burned=${main.lpBurnedPct}% locked=${main.lpLockedPct}%`));
      }
      return verdict(claim, "FALSE",
        `Only ${secured.toFixed(0)}% of the dominant pool's LP is burned or in a known locker as of this scan.`,
        ev("lp-holders", main.pairAddress, `burned=${main.lpBurnedPct}% locked=${main.lpLockedPct}%`));
    }

    case "multisig": {
      const safe = checks.admin?.safe;
      if (!safe) {
        return verdict(claim, "FALSE",
          "The claimed controller is not a multisig on-chain (no Safe owners/threshold readable).",
          ev("eth_call", claim.params?.address ?? checks.address, "getOwners() failed"));
      }
      const want = claim.params ?? {};
      if ((want.threshold && safe.threshold !== want.threshold) || (want.owners && safe.owners !== want.owners)) {
        return verdict(claim, "FALSE",
          `On-chain multisig is ${safe.threshold}-of-${safe.owners}, docs claim ${want.threshold}-of-${want.owners}.`,
          ev("eth_call", claim.params?.address ?? checks.address, `getThreshold()=${safe.threshold}`));
      }
      return verdict(claim, "VERIFIED", `Multisig confirmed: ${safe.threshold}-of-${safe.owners}.`,
        ev("eth_call", claim.params?.address ?? checks.address, `getThreshold()=${safe.threshold}`));
    }

    case "timelock": {
      const delay = checks.admin?.timelockDelaySeconds;
      const minHours = claim.params?.minHours ?? 0;
      if (delay === null || delay === undefined) {
        return verdict(claim, "UNVERIFIABLE", "No readable timelock found at the claimed controller.", null);
      }
      if (delay >= minHours * 3600) {
        return verdict(claim, "VERIFIED", `Timelock enforces a ${Math.round(delay / 3600)}h minimum delay.`,
          ev("eth_call", checks.address, `getMinDelay()=${delay}`));
      }
      return verdict(claim, "FALSE",
        `On-chain delay is ${Math.round(delay / 3600)}h; docs claim at least ${minHours}h.`,
        ev("eth_call", checks.address, `getMinDelay()=${delay}`));
    }

    case "admin_disclosure": {
      // VERIFIED when the powers found on-chain are a subset of the powers
      // the docs enumerate (claim.params.disclosed: array of kinds).
      const found = new Set((checks.admin?.privilegedSelectors ?? []).map((s) => s.kind));
      const disclosed = new Set(claim.params?.disclosed ?? []);
      const undisclosed = [...found].filter((k) => !disclosed.has(k));
      if (undisclosed.length === 0) {
        return verdict(claim, "VERIFIED", "Every privileged capability found on-chain is disclosed in the docs.",
          ev("bytecode-scan", checks.address, [...found].join(",") || "none"));
      }
      return verdict(claim, "FALSE",
        `Undisclosed on-chain powers found: ${undisclosed.join(", ")}.`,
        ev("bytecode-scan", checks.address, undisclosed.join(",")));
    }

    case "vesting":
    case "audited":
    case "other":
    default:
      return verdict(claim, "UNVERIFIABLE",
        claim.type === "audited"
          ? "Audit claims are scored link-resolves-only in v1; auditor quality is out of automated scope."
          : "No deterministic on-chain verifier exists for this claim type yet.",
        null);
  }
}

function verdict(claim, result, note, evidence) {
  return {
    id: claim.id,
    type: claim.type,
    text: claim.text,
    quote: claim.quote,
    source: claim.source,
    material: claim.material,
    tense: claim.tense,
    deadline: claim.deadline ?? null,
    verdict: result,
    note,
    evidence,
  };
}

function ev(type, address, detail) {
  return { type, address, detail };
}
