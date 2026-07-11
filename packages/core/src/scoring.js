// Assay scoring engine — pure, deterministic, versioned.
//
// Input:  a CheckResults object (produced by the scanner from chain reads,
//         claim verdicts, and registries — never by an LLM).
// Output: per-dimension scores, triggered caps, the overall grade, a
//         Trust Model badge, and a coverage indicator.
//
// The aggregation is a hybrid: overall = min(weighted average, hard caps).
// A pure average fails the mint-backdoor test; pure weakest-link kills the
// incentive gradient. The caps are the weakest links that are actually fatal.
//
// Design rule (defamation + integrity firewall): every deduction here must
// be traceable to a finding with on-chain evidence. Missing data is scored
// as "insufficient data" (dimension N/R, coverage drops), never as the
// worst case.

import { METHODOLOGY_VERSION } from "./version.js";

/** Base weights for the standard project-token profile. */
export const WEIGHTS = {
  supplyIntegrity: 20,
  adminSurface: 20, // becomes 15 when governanceReality applies
  disclosureIntegrity: 15,
  insiderFloat: 15,
  liquidityPermanence: 15,
  trackRecord: 10,
  holderConcentration: 5,
  governanceReality: 0, // 5 when governance is claimed; taken from adminSurface
};

export const GRADE_ORDER = ["F", "D", "C", "B-", "B", "B+", "A-", "A", "A+"];

/** Numeric score → letter. Notches only at the top, where quality competes. */
export function letterFor(score) {
  if (score >= 95) return "A+";
  if (score >= 89) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function capToScoreCeiling(letter) {
  // The ceiling a cap imposes, expressed as the top of that letter's band.
  const tops = { "A": 94.99, "A-": 88.99, "B+": 84.99, "B": 79.99, "B-": 74.99, "C": 69.99, "D": 54.99, "F": 39.99 };
  return tops[letter] ?? 100;
}

const minLetter = (a, b) => (GRADE_ORDER.indexOf(a) <= GRADE_ORDER.indexOf(b) ? a : b);

// ---------------------------------------------------------------------------
// Dimension scorers. Each returns { score: number|null, findings: [...] }.
// score === null means "insufficient data to score this dimension" (N/R).
// Every finding: { id, severity: info|warn|crit, text, evidence }.
// ---------------------------------------------------------------------------

export function scoreSupplyIntegrity(r) {
  const findings = [];
  const s = r.supply;
  if (!s || s.mintable === null || s.mintable === undefined) return { score: null, findings };

  if (r.meta?.verifiedSource === false) {
    findings.push(f("supply.unverified", "warn",
      "Source code is not verified on a public explorer; supply behavior cannot be fully audited.",
      s.evidence?.source));
  }

  if (s.mintable) {
    const gate = s.mintGate ?? "unknown";
    if (gate === "none" || gate === "eoa") {
      findings.push(f("supply.eoa-mint", "crit",
        "A mint path exists and is callable by an externally-owned account. Supply can be inflated unilaterally.",
        s.evidence?.mint));
      return { score: 0, findings };
    }
    if (gate === "governance-timelock") {
      findings.push(f("supply.gated-mint", "info",
        "A mint path exists but is gated by on-chain governance with a timelock.", s.evidence?.mint));
      return { score: 85, findings };
    }
    if (gate === "multisig-attested") {
      findings.push(f("supply.custodial-mint", "info",
        "Issuance is controlled by a disclosed multisig with third-party attestations (custodial-issuance pattern).",
        s.evidence?.mint));
      return { score: 65, findings };
    }
    findings.push(f("supply.multisig-mint", "warn",
      "A mint path exists, gated by a multisig without a timelock or attestation trail.", s.evidence?.mint));
    return { score: 35, findings };
  }

  if (s.upgradeable) {
    // A live upgrade path is a latent mint. Scored primarily under Admin
    // Surface; here it prevents a perfect score.
    findings.push(f("supply.latent-mint", "warn",
      "The contract is upgradeable: even without a mint function today, an upgrade could add one (latent mint).",
      s.evidence?.proxy));
    return { score: 60, findings };
  }

  if (s.feeOnTransfer === true) {
    findings.push(f("supply.fee-on-transfer", "warn",
      "Transfers are taxed or balances can be mutated by transfer hooks.", s.evidence?.fees));
    return { score: 70, findings };
  }

  findings.push(f("supply.fixed", "info",
    "No mint path exists in the deployed bytecode; supply is fixed.", s.evidence?.mint));
  return { score: 100, findings };
}

export function scoreAdminSurface(r) {
  const findings = [];
  const a = r.admin;
  if (!a) return { score: null, findings };

  const powers = a.privilegedSelectors ?? [];
  const hasProxy = Boolean(a.proxy?.type);
  const ownerless = !a.ownerAddress || a.ownerType === "none";

  if (ownerless && powers.length === 0 && !hasProxy) {
    findings.push(f("admin.none", "info",
      "No owner, no privileged functions, not upgradeable. There is no admin key to phish, leak, or subpoena.",
      a.evidence?.owner));
    return { score: 100, findings };
  }

  const gate = a.controlType ?? (a.ownerType === "eoa" ? "eoa" : "unknown");
  const delay = a.timelockDelaySeconds ?? 0;

  if (gate === "governor-timelock" && delay >= 48 * 3600) {
    findings.push(f("admin.governance", "info",
      `Privileged capabilities exist but only via binding on-chain governance behind a ${Math.round(delay / 3600)}h timelock.`,
      a.evidence?.control));
    return { score: 90, findings };
  }
  if (gate === "safe" && (a.safe?.threshold ?? 0) >= 3 && delay > 0) {
    findings.push(f("admin.safe-timelock", "info",
      `Privileged capabilities gated by a ${a.safe.threshold}-of-${a.safe.owners} multisig plus a ${Math.round(delay / 3600)}h execution delay.`,
      a.evidence?.control));
    return { score: 75, findings };
  }
  if (gate === "safe") {
    findings.push(f("admin.safe", "warn",
      `Privileged capabilities gated by a ${a.safe?.threshold ?? "?"}-of-${a.safe?.owners ?? "?"} multisig with no timelock.`,
      a.evidence?.control));
    return { score: 55, findings };
  }
  if (gate === "eoa") {
    const sev = hasProxy || powers.some((p) => p.material) ? "crit" : "warn";
    findings.push(f("admin.eoa", sev,
      hasProxy
        ? "The contract is upgradeable and the upgrade key is a single externally-owned account with no timelock."
        : "Material admin powers are held by a single externally-owned account.",
      a.evidence?.control));
    return { score: 25, findings };
  }

  findings.push(f("admin.unknown-gate", "warn",
    "Privileged capabilities exist; their controller could not be classified.", a.evidence?.control));
  return { score: 40, findings };
}

export function scoreDisclosureIntegrity(r) {
  const findings = [];
  const claims = r.claims ?? [];
  if (r.claimsCrawled === false) return { score: null, findings };

  if (claims.length === 0) {
    findings.push(f("disclosure.claim-light", "info",
      "The project makes no machine-checkable claims. Silence is not lying, but it is not disclosure either (claim-light floor applies).",
      null));
    return { score: 70, findings };
  }

  let score = 100;
  let unverifiablePenalty = 0;
  for (const c of claims) {
    const where = c.source ?? null;
    if (c.verdict === "FALSE") {
      if (c.material) {
        score -= 40;
        findings.push(f(`claim.false.${c.id}`, "crit",
          `Materially false claim: "${c.text}" — contradicted by on-chain evidence.`, c.evidence ?? where));
      } else {
        score -= 10;
        findings.push(f(`claim.false.${c.id}`, "warn", `False claim (minor): "${c.text}".`, c.evidence ?? where));
      }
    } else if (c.verdict === "UNVERIFIABLE" && c.material) {
      unverifiablePenalty = Math.min(30, unverifiablePenalty + 5);
      findings.push(f(`claim.unverifiable.${c.id}`, "warn",
        `Material claim could not be verified: "${c.text}".`, where));
    } else if (c.verdict === "OMISSION") {
      score -= 15;
      findings.push(f(`claim.omission.${c.id}`, "warn",
        `Undisclosed on-chain power: ${c.text}`, c.evidence ?? where));
    } else if (c.verdict === "VERIFIED") {
      findings.push(f(`claim.verified.${c.id}`, "info", `Verified: "${c.text}".`, c.evidence ?? where));
    } else if (c.verdict === "FORWARD_LOOKING") {
      findings.push(f(`claim.commitment.${c.id}`, "info",
        `Tracked commitment (not yet due): "${c.text}".`, where));
    } else if (c.verdict === "STALE") {
      findings.push(f(`claim.stale.${c.id}`, "warn", `Stale claim: "${c.text}".`, where));
    }
  }
  score -= unverifiablePenalty;
  return { score: Math.max(0, score), findings };
}

export function scoreInsiderFloat(r) {
  const findings = [];
  const i = r.insiders;
  if (!i || i.liquidFloatPct === null || i.liquidFloatPct === undefined) return { score: null, findings };

  const liquid = i.liquidFloatPct;
  const vested = i.codeVestedPct ?? 0;
  if (i.vestingViolated) {
    findings.push(f("insider.violation", "crit",
      "A published vesting schedule has been violated.", i.evidence?.violation));
    return { score: 0, findings };
  }
  if (liquid < 5 && vested >= 50) {
    findings.push(f("insider.locked", "info",
      `Insider liquid float is ${liquid}%; ${vested}% of insider allocations are enforced by on-chain vesting.`,
      i.evidence?.vesting));
    return { score: 100, findings };
  }
  if (liquid < 10 && vested >= 30) return { score: 75, findings };
  if (liquid <= 15) return { score: 50, findings };
  if (liquid <= 30) {
    findings.push(f("insider.heavy", "warn", `Insiders can sell ${liquid}% of supply today.`, i.evidence?.float));
    return { score: 25, findings };
  }
  findings.push(f("insider.dominant", "crit",
    `More than 30% of supply (${liquid}%) is liquid in insider-attributed wallets.`, i.evidence?.float));
  return { score: 0, findings };
}

export function scoreLiquidityPermanence(r) {
  const findings = [];
  const l = r.liquidity;
  if (!l || !Array.isArray(l.pools)) return { score: null, findings };
  if (l.pools.length === 0) {
    findings.push(f("liq.none", "warn", "No liquidity pools found for this token.", null));
    return { score: null, findings };
  }

  // Judge the dominant pool; small side pools don't rescue or doom a token.
  const main = [...l.pools].sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))[0];
  const secured = (main.lpBurnedPct ?? 0) + (main.lpLockedPct ?? 0);
  const lockMonths = main.lockMonthsRemaining ?? 0;

  if (main.singleEoaWithdrawable) {
    findings.push(f("liq.rug-ready", "crit",
      "The dominant liquidity position is withdrawable by a single externally-owned account.", main.evidence));
    return { score: 0, findings };
  }
  if (secured >= 90 && (main.lpBurnedPct >= 90 || lockMonths >= 12)) {
    findings.push(f("liq.permanent", "info",
      `${secured.toFixed(0)}% of the dominant pool's LP is burned or locked ${main.lpBurnedPct >= 90 ? "permanently" : `for ${lockMonths} more months`}.`,
      main.evidence));
    return { score: 100, findings };
  }
  if (secured >= 90 && lockMonths >= 6) return { score: 75, findings };
  if (secured >= 50) {
    findings.push(f("liq.partial", "warn",
      `Only ${secured.toFixed(0)}% of the dominant pool's LP is burned or locked${lockMonths ? ` (lock expires in ~${lockMonths} months)` : ""}.`,
      main.evidence));
    return { score: 50, findings };
  }
  findings.push(f("liq.unlocked", "warn",
    "The dominant pool's LP is mostly unlocked.", main.evidence));
  return { score: 25, findings };
}

export function scoreTrackRecord(r) {
  const findings = [];
  const t = r.track;
  if (!t || t.ageDays === null || t.ageDays === undefined) return { score: null, findings };

  if ((t.violations ?? []).length > 0) {
    for (const v of t.violations) {
      findings.push(f(`track.violation.${v.id}`, "crit", v.text, v.evidence));
    }
    return { score: 0, findings };
  }
  const months = t.ageDays / 30.44;
  if (months >= 24) return { score: 100, findings };
  if (months >= 12) return { score: 75, findings };
  if (months >= 6) return { score: 50, findings };
  findings.push(f("track.young", "info",
    `Token is ${Math.max(1, Math.round(t.ageDays))} days old; trust needs time (Provisional).`, t.evidence));
  return { score: 25, findings };
}

export function scoreHolderConcentration(r) {
  const findings = [];
  const h = r.holders;
  if (!h || h.top10Pct === null || h.top10Pct === undefined) return { score: null, findings };
  const p = h.top10Pct;
  if (p >= 50) {
    findings.push(f("holders.dominant", "crit",
      `The top 10 unlabeled holders control ${p.toFixed(1)}% of circulating supply.`, h.evidence));
    return { score: 0, findings };
  }
  if (p >= 35) {
    findings.push(f("holders.heavy", "warn",
      `Top-10 unlabeled holders control ${p.toFixed(1)}%.`, h.evidence));
    return { score: 25, findings };
  }
  if (p >= 20) return { score: 50, findings };
  if (p >= 10) return { score: 75, findings };
  findings.push(f("holders.distributed", "info",
    `Top-10 unlabeled holders control ${p.toFixed(1)}%.`, h.evidence));
  return { score: 100, findings };
}

export function scoreGovernanceReality(r) {
  const findings = [];
  const g = r.governance;
  if (!g?.claimed) return { score: null, findings, notApplicable: true };
  if (g.governorExecutes === false) {
    findings.push(f("gov.theater", "crit",
      "The docs claim community governance but the governor controls nothing on-chain (governance theater).",
      g.evidence));
    return { score: 10, findings };
  }
  if (g.bypassableByMultisig) {
    findings.push(f("gov.bypass", "warn",
      "A multisig can veto or bypass governance decisions.", g.evidence));
    return { score: 40, findings };
  }
  if (g.advisoryOnly) {
    findings.push(f("gov.advisory", "warn",
      "Voting is advisory (off-chain signaling only), not binding.", g.evidence));
    return { score: 50, findings };
  }
  findings.push(f("gov.real", "info", "Claimed governance verifiably executes on-chain.", g.evidence));
  return { score: 85, findings };
}

// ---------------------------------------------------------------------------
// Hard caps — published verbatim in the methodology.
// ---------------------------------------------------------------------------

export function evaluateCaps(r, dims) {
  const caps = [];
  const add = (id, letter, reason) => caps.push({ id, letter, reason });

  if (r.meta?.verifiedSource === false) add("cap.unverified", "C", "Source code is not verified on a public explorer.");
  if (r.supply?.mintable && ["none", "eoa"].includes(r.supply.mintGate ?? "unknown")) {
    add("cap.eoa-mint", "F", "Mint or issuance is callable by an EOA or undisclosed party.");
  }
  if (r.admin?.proxy?.type && r.admin?.controlType === "eoa" && !(r.admin.timelockDelaySeconds > 0)) {
    add("cap.eoa-upgrade", "D", "Upgradeable with an EOA admin and no timelock.");
  }
  if ((r.claims ?? []).some((c) => c.verdict === "FALSE" && c.material)) {
    add("cap.false-claim", "D", "A materially false safety claim was verified FALSE against chain state.");
  }
  if (r.liquidity?.pools?.some((p) => p.singleEoaWithdrawable && (p.liquidityUsd ?? 0) > 0)) {
    add("cap.rug-ready", "D", "More than 50% of primary liquidity is withdrawable by one key.");
  }
  if ((r.track?.violations ?? []).length > 0) {
    const monthsClean = r.track?.monthsSinceLastViolation ?? 0;
    add("cap.violation", monthsClean >= 24 ? "C" : "D", "A historical commitment violation is on record.");
  }
  if ((r.insiders?.liquidFloatPct ?? 0) > 30) add("cap.insider-float", "C", "Insider liquid float exceeds 30% of supply.");
  if ((r.holders?.top10Pct ?? 0) > 50) add("cap.concentration", "C", "Top-10 unlabeled holders exceed 50%.");

  const materialClaims = (r.claims ?? []).filter((c) => c.material);
  if (materialClaims.length > 0) {
    const verifiable = materialClaims.filter((c) => c.verdict !== "UNVERIFIABLE").length;
    if (verifiable / materialClaims.length < 0.5) {
      add("cap.coverage", "B", "Less than half of material claims are verifiable.");
    }
  }

  const ageDays = r.track?.ageDays;
  if (ageDays !== null && ageDays !== undefined) {
    if (ageDays < 183) add("cap.age-6mo", "B+", "Token is younger than 6 months (Provisional).");
    else if (ageDays < 365) add("cap.age-12mo", "A-", "Token is younger than 12 months (Provisional).");
    else if (ageDays < 730) add("cap.age-24mo", "A", "A+ requires 24 clean months of operating history.");
  }

  // Claim-light tokens can be structurally honest, never excellent.
  if ((r.claims ?? []).length === 0 && r.claimsCrawled !== false) {
    add("cap.claim-light", "B+", "No machine-checkable disclosures exist (claim-light profile).");
  }

  void dims;
  return caps;
}

// ---------------------------------------------------------------------------
// Trust Model badge — what *kind* of trust you are extending.
// ---------------------------------------------------------------------------

export function trustModelBadge(r) {
  const a = r.admin ?? {};
  const powers = a.privilegedSelectors ?? [];
  const hasProxy = Boolean(a.proxy?.type);
  const ownerless = !a.ownerAddress || a.ownerType === "none";
  if (ownerless && powers.length === 0 && !hasProxy && !r.supply?.mintable) return "Code-Enforced";
  if (a.controlType === "governor-timelock") return "Governance-Gated";
  if (a.controlType === "safe" && (r.claims ?? []).some((c) => c.type === "admin_disclosure" && c.verdict === "VERIFIED")) {
    return "Custodial (disclosed)";
  }
  if (a.controlType === "safe") return "Custodial";
  return "Discretionary";
}

// ---------------------------------------------------------------------------
// Aggregate.
// ---------------------------------------------------------------------------

export function scoreToken(r) {
  const gov = scoreGovernanceReality(r);
  const govApplies = !gov.notApplicable;

  const weights = { ...WEIGHTS };
  if (govApplies) {
    weights.adminSurface = 15;
    weights.governanceReality = 5;
  } else {
    weights.adminSurface = 20;
    weights.governanceReality = 0;
  }

  const dims = {
    supplyIntegrity: scoreSupplyIntegrity(r),
    adminSurface: scoreAdminSurface(r),
    disclosureIntegrity: scoreDisclosureIntegrity(r),
    insiderFloat: scoreInsiderFloat(r),
    liquidityPermanence: scoreLiquidityPermanence(r),
    trackRecord: scoreTrackRecord(r),
    holderConcentration: scoreHolderConcentration(r),
    governanceReality: gov,
  };

  // Weighted average over scorable dimensions only; weights renormalize so
  // missing data lowers *coverage*, not the score itself.
  let weightSum = 0;
  let acc = 0;
  let scorable = 0;
  let applicable = 0;
  for (const [key, dim] of Object.entries(dims)) {
    const w = weights[key];
    if (w === 0) continue;
    applicable += 1;
    if (dim.score === null || dim.score === undefined) continue;
    scorable += 1;
    weightSum += w;
    acc += dim.score * w;
  }

  const caps = evaluateCaps(r, dims);

  if (scorable < 3) {
    return {
      methodology_version: METHODOLOGY_VERSION,
      dimensions: dims,
      caps,
      overall: null,
      letter: "N/R",
      provisional: false,
      badge: trustModelBadge(r),
      coverage: coverageIndicator(scorable, applicable),
      weights,
    };
  }

  const weighted = acc / weightSum;
  let ceiling = 100;
  let capLetter = null;
  for (const cap of caps) {
    const c = capToScoreCeiling(cap.letter);
    if (c < ceiling) {
      ceiling = c;
      capLetter = cap.letter;
    }
  }
  const overall = Math.min(weighted, ceiling);
  let letter = letterFor(overall);
  if (capLetter) letter = minLetter(letter, capLetter);

  const provisional = (r.track?.ageDays ?? Infinity) < 365 || dims.trackRecord.score === null;

  return {
    methodology_version: METHODOLOGY_VERSION,
    dimensions: dims,
    caps,
    overall: Math.round(overall * 10) / 10,
    letter,
    provisional,
    badge: trustModelBadge(r),
    coverage: coverageIndicator(scorable, applicable),
    weights,
  };
}

function coverageIndicator(scorable, applicable) {
  const ratio = applicable === 0 ? 0 : scorable / applicable;
  if (ratio >= 0.8) return "full";
  if (ratio >= 0.5) return "partial";
  return "thin";
}

function f(id, severity, text, evidence) {
  return { id, severity, text, evidence: evidence ?? null };
}
