// Alert engine: compares this scan's report with the previous one and
// emits typed alert records. This is the daily "clock" of the behavioral
// time series — every alert is derived from two committed scan snapshots,
// so anyone can reproduce it from git history. (A minutes-resolution event
// clock via eth_getLogs is the documented next infrastructure step; it
// changes latency, not semantics.)
//
// Severity: CRITICAL = act now (contract upgraded, controller changed,
// liquidity security collapsed, grade fell to D/F). WARN = attention
// (downgrade, new cap, source unverified). INFO = record-keeping
// (listed, upgrade, cap cleared).

const GRADE_RANK = { F: 0, D: 1, C: 2, "B-": 3, B: 4, "B+": 5, "A-": 6, A: 7, "A+": 8 };

export function computeAlerts(prev, current, { now = new Date() } = {}) {
  if (current.status !== "ok") return [];
  const alerts = [];
  const base = {
    at: now.toISOString(),
    chain: current.chain,
    address: current.address,
    symbol: current.symbol ?? null,
  };
  const add = (severity, kind, text, evidence = null) => alerts.push({ ...base, severity, kind, text, evidence });

  if (!prev || prev.status !== "ok") {
    add("INFO", "listed", `${current.symbol ?? current.address} is now rated: ${current.grade.letter}.`);
    return alerts;
  }

  // --- grade movement ------------------------------------------------------
  const from = prev.grade?.letter;
  const to = current.grade?.letter;
  if (from && to && from !== to) {
    const fromRank = GRADE_RANK[from];
    const toRank = GRADE_RANK[to];
    if (toRank !== undefined && fromRank !== undefined) {
      if (toRank < fromRank) {
        add(["D", "F"].includes(to) ? "CRITICAL" : "WARN", "downgrade",
          `Grade ${from} → ${to}.`);
      } else {
        add("INFO", "upgrade", `Grade ${from} → ${to}.`);
      }
    } else {
      add("WARN", "grade-state", `Grade state ${from} → ${to}.`);
    }
  }

  // --- control changes -----------------------------------------------------
  if ((prev.facts?.owner ?? null) !== (current.facts?.owner ?? null)) {
    add("CRITICAL", "controller-changed",
      `Owner/controller changed: ${prev.facts?.owner ?? "none"} → ${current.facts?.owner ?? "none"}.`,
      { field: "facts.owner" });
  }
  // An upgrade alert requires a KNOWN previous implementation that differs.
  // When the previous report lacks the field (older schema, or proxy
  // detection newly added), this scan establishes the baseline — alerting
  // there would publish a false "changed" statement (2026-07-11 corrections
  // log entry).
  const prevImpl = prev.facts?.proxyImplementation ?? null;
  const curImpl = current.facts?.proxyImplementation ?? null;
  if (prevImpl !== null && curImpl !== null && prevImpl !== curImpl) {
    add("CRITICAL", "upgraded",
      `Contract implementation changed: ${prevImpl} → ${curImpl}.`,
      { field: "facts.proxyImplementation" });
  } else if (prevImpl !== null && curImpl === null) {
    add("WARN", "proxy-slot-cleared",
      `Previously detected implementation slot now reads empty (was ${prevImpl}).`,
      { field: "facts.proxyImplementation" });
  }
  if (prev.facts?.verifiedSource === true && current.facts?.verifiedSource === false) {
    add("WARN", "source-unverified", "Source code is no longer verified on the explorer.");
  }

  // --- liquidity security --------------------------------------------------
  const secured = (r) => {
    const pools = (r.facts?.pools ?? []).filter((p) => p.lockAnalyzed);
    if (pools.length === 0) return null;
    const main = pools.sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))[0];
    return (main.lpBurnedPct ?? 0) + (main.lpLockedPct ?? 0);
  };
  const prevSecured = secured(prev);
  const curSecured = secured(current);
  if (prevSecured !== null && curSecured !== null && prevSecured - curSecured > 10) {
    add("CRITICAL", "liquidity-security-drop",
      `Burned/locked share of the dominant pool fell ${prevSecured.toFixed(0)}% → ${curSecured.toFixed(0)}%.`);
  }

  // --- profile (methodology v0.2) --------------------------------------------
  // A profile assignment changes how a token is scored; it must be a public,
  // diffable event, never a silent re-grade.
  if ((prev.profile ?? "standard") !== (current.profile ?? "standard")) {
    add("WARN", "profile-changed",
      `Category profile changed: ${prev.profile ?? "standard"} → ${current.profile ?? "standard"} (assigned only in the reviewed registry; see methodology §6).`);
  }

  // --- caps ------------------------------------------------------------------
  // Keys include the waived state so an active↔waived transition alerts
  // instead of passing silently (a waiver loosens the grade ceiling).
  const capKey = (c) => c.id + (c.waived ? ":waived" : "");
  const prevCaps = new Set((prev.caps ?? []).map(capKey));
  const curCaps = new Set((current.caps ?? []).map(capKey));
  const prevById = new Map((prev.caps ?? []).map((c) => [c.id, c]));
  const curById = new Map((current.caps ?? []).map((c) => [c.id, c]));
  for (const cap of current.caps ?? []) {
    if (prevCaps.has(capKey(cap))) continue;
    const was = prevById.get(cap.id);
    if (cap.waived) {
      add("WARN", "cap-waived",
        `Hard cap ${was && !was.waived ? "moved from active to waived" : "recorded as waived"} (${cap.waivedBy}): ${cap.reason}`);
    } else if (was?.waived) {
      add("WARN", "cap-reactivated", `Previously waived hard cap is active again (≤ ${cap.letter}): ${cap.reason}`);
    } else {
      add("WARN", "cap-triggered", `New hard cap: ${cap.reason} (≤ ${cap.letter}).`);
    }
  }
  for (const cap of prev.caps ?? []) {
    if (curCaps.has(capKey(cap))) continue;
    if (curById.has(cap.id)) continue; // state transition already alerted above
    add("INFO", "cap-cleared", `Hard cap cleared: ${cap.reason}`);
  }

  // --- claims ----------------------------------------------------------------
  const prevVerdicts = new Map((prev.claims ?? []).map((c) => [c.id, c.verdict]));
  for (const claim of current.claims ?? []) {
    const was = prevVerdicts.get(claim.id);
    if (was && was !== claim.verdict) {
      const sev = claim.verdict === "FALSE" ? "CRITICAL" : "INFO";
      add(sev, "claim-verdict", `Claim "${claim.text}": ${was} → ${claim.verdict}.`, claim.evidence);
    }
  }

  return alerts;
}

/** Merges this run's alerts into the rolling feed (newest first, capped). */
export function mergeFeed(existingFeed, newAlerts, { cap = 300, generatedAt } = {}) {
  return {
    generated_at: generatedAt,
    alerts: [...newAlerts, ...(existingFeed?.alerts ?? [])].slice(0, cap),
  };
}
