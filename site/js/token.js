// Token report page. Renders data/tokens/<chain>-<address>.json entirely
// with createElement/textContent — claim quotes originate on third-party
// project sites and must never be interpreted as HTML here.
(async function () {
  const root = document.getElementById("report");
  const slug = new URLSearchParams(location.search).get("t") ?? "";
  if (!/^[a-z0-9]+-0x[0-9a-fA-F]{40}$/.test(slug)) {
    root.textContent = "Invalid token reference.";
    return;
  }

  let r;
  try {
    const res = await fetch(`data/tokens/${slug.toLowerCase()}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    r = await res.json();
  } catch {
    root.textContent = "No report exists for this token yet.";
    return;
  }
  root.textContent = "";

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  document.title = `${r.symbol ?? r.address} — Assay report`;

  // ---- Header ----------------------------------------------------------
  const hero = el("section", "hero");
  const pills = el("div", "pill-row");

  const isCoi = r.coi && r.grade?.letter === "COI";
  const letter = r.grade?.letter ?? "N/R";
  const noGrade = isCoi || letter === "N/R" || letter === "UR" || letter === "NS";
  const band = noGrade ? "gNR" : letter.startsWith("A") ? "gA" : letter.startsWith("B") ? "gB" : letter.startsWith("C") ? "gC" : letter.startsWith("D") ? "gD" : "gF";
  pills.appendChild(el("span", `grade big ${band}`, isCoi ? "COI" : letter));

  const title = el("h1", null, `${r.name ?? ""} (${r.symbol ?? "?"})`);
  hero.append(pills, title);
  hero.appendChild(el("div", "addr", `${r.chain} · ${r.address}`));

  const sub = el("div", "pill-row");
  if (r.grade?.badge) sub.appendChild(el("span", "badge", r.grade.badge));
  if (r.profile && r.profile !== "standard") sub.appendChild(el("span", "badge", `profile: ${r.profile}`));
  if (r.grade?.provisional) sub.appendChild(el("span", "prov", "Provisional — under 12 months old"));
  if (r.grade?.coverage) sub.appendChild(el("span", "cov", `coverage: ${r.grade.coverage}`));
  if (r.scanned_at) sub.appendChild(el("span", "muted", `scanned ${new Date(r.scanned_at).toUTCString()}`));
  if (r.methodology_version) sub.appendChild(el("span", "muted", `methodology v${r.methodology_version}`));
  hero.appendChild(sub);
  root.appendChild(hero);

  if (isCoi && r.coiNote) {
    const n = el("div", "notice coi");
    n.appendChild(el("strong", null, "Not Rated — Founder Conflict of Interest. "));
    n.appendChild(document.createTextNode(r.coiNote.replace(/^Not Rated — Founder Conflict of Interest\.\s*/, "")));
    root.appendChild(n);
  }
  if (r.reviewNote) root.appendChild(el("div", "notice coi", r.reviewNote));
  if (r.profileNote) root.appendChild(el("div", "notice coi", r.profileNote));
  if (r.notes) root.appendChild(el("div", "notice", r.notes));
  if (r.status === "registry_mismatch") {
    root.appendChild(el("div", "notice coi", r.note));
    return;
  }

  // ---- Claims table (the differentiator, so it goes first) -------------
  const claimsSec = el("section", "block");
  claimsSec.appendChild(el("h2", "sec", "Claims vs. chain"));
  if (!r.claims || r.claims.length === 0) {
    claimsSec.appendChild(
      el("p", "muted",
        "No machine-checkable claims are on record for this project (claim-light). Silence is not lying, but it is not disclosure either — claim-light tokens cap at B+."),
    );
  } else {
    for (const c of r.claims) {
      const card = el("div", "card");
      const head = el("div", "pill-row");
      head.appendChild(el("span", `verdict v${c.verdict}`, c.verdict.replace("_", " ")));
      head.appendChild(el("strong", null, c.text));
      card.appendChild(head);
      if (c.quote) card.appendChild(el("p", "muted", `“${c.quote}” — project's own material`));
      if (c.note) card.appendChild(el("p", null, c.note));
      if (c.evidence) {
        card.appendChild(el("span", "ev addr", `evidence: ${c.evidence.type} @ ${c.evidence.address ?? ""} ${c.evidence.detail ?? ""}`));
      }
      if (c.source) {
        const p = el("p", "muted");
        p.appendChild(document.createTextNode("source: "));
        p.appendChild(el("span", "addr", c.source));
        card.appendChild(p);
      }
      claimsSec.appendChild(card);
    }
  }
  root.appendChild(claimsSec);

  // ---- Dimensions -------------------------------------------------------
  const NAMES = {
    supplyIntegrity: "Supply Integrity",
    adminSurface: "Admin Surface & Upgradeability",
    disclosureIntegrity: "Disclosure Integrity",
    insiderFloat: "Insider Float & Vesting",
    liquidityPermanence: "Liquidity Permanence",
    trackRecord: "Operational Track Record",
    holderConcentration: "Holder Concentration",
    governanceReality: "Governance Reality",
  };
  const dimSec = el("section", "block");
  dimSec.appendChild(el("h2", "sec", "Dimensions"));
  for (const [key, dim] of Object.entries(r.dimensions ?? {})) {
    if (dim.notApplicable) continue;
    // Under custodial profiles, Liquidity Permanence is published as
    // Redeemability and is out of automated scope in v0.2.
    const name = key === "liquidityPermanence" && dim.outOfAutomatedScope
      ? "Redeemability"
      : NAMES[key] ?? key;
    const row = el("div", "dim-row");
    row.appendChild(el("div", "dim-name", name));
    const bar = el("div", "bar");
    const fill = el("i");
    fill.style.width = dim.score === null ? "0%" : `${dim.score}%`;
    bar.appendChild(fill);
    row.appendChild(bar);
    const scoreText = dim.score !== null ? String(dim.score) : dim.outOfAutomatedScope ? "out of scope" : "no data";
    row.appendChild(el("div", "dim-score", scoreText));
    dimSec.appendChild(row);
  }
  root.appendChild(dimSec);

  // ---- Caps -------------------------------------------------------------
  // Active caps set the grade ceiling. Waived caps are structural facts the
  // token's category profile relaxes — kept visible (never deleted) so the
  // underlying reality stays on the report, marked with the evidence that
  // waives them.
  const activeCaps = (r.caps ?? []).filter((c) => !c.waived);
  const waivedCaps = (r.caps ?? []).filter((c) => c.waived);
  if (activeCaps.length) {
    const capSec = el("section", "block");
    capSec.appendChild(el("h2", "sec", "Hard caps triggered"));
    for (const cap of activeCaps) {
      const finding = el("div", "finding crit");
      finding.appendChild(el("strong", null, `capped at ${cap.letter}: `));
      finding.appendChild(document.createTextNode(cap.reason));
      capSec.appendChild(finding);
    }
    root.appendChild(capSec);
  }
  if (waivedCaps.length) {
    const wSec = el("section", "block");
    wSec.appendChild(el("h2", "sec", "Structural caps waived by this profile"));
    wSec.appendChild(el("p", "muted",
      "These caps would apply under the standard profile. The token's category profile relaxes them for a disclosed, purpose-consistent reason — the underlying fact is real and stays on record here; it does not set the grade ceiling."));
    for (const cap of waivedCaps) {
      const finding = el("div", "finding warn");
      finding.appendChild(el("strong", null, `would cap at ${cap.letter} (waived): `));
      finding.appendChild(document.createTextNode(cap.reason));
      if (cap.waivedBy) finding.appendChild(el("span", "ev", `waived by: ${cap.waivedBy}`));
      wSec.appendChild(finding);
    }
    root.appendChild(wSec);
  }

  // ---- Findings ---------------------------------------------------------
  const findings = Object.values(r.dimensions ?? {}).flatMap((d) => d.findings ?? []);
  if (findings.length) {
    const fSec = el("section", "block");
    fSec.appendChild(el("h2", "sec", "Findings"));
    for (const f of findings) {
      const div = el("div", `finding ${f.severity}`);
      div.appendChild(document.createTextNode(f.text));
      if (f.evidence) div.appendChild(el("span", "ev", `evidence: ${JSON.stringify(f.evidence)}`));
      fSec.appendChild(div);
    }
    root.appendChild(fSec);
  }

  // ---- Grade history ------------------------------------------------------
  try {
    const hres = await fetch(`data/history/${slug.toLowerCase()}.jsonl`, { cache: "no-store" });
    if (hres.ok) {
      const lines = (await hres.text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
      if (lines.length > 0) {
        const hSec = el("section", "block");
        hSec.appendChild(el("h2", "sec", "Grade history"));
        const card = el("div", "card");
        // Newest first, deduplicate consecutive identical letters so the
        // list reads as a change log, with the current state on top.
        const seen = [];
        for (const entry of lines.reverse()) {
          if (seen.length === 0 || seen[seen.length - 1].letter !== entry.letter) seen.push(entry);
        }
        for (const entry of seen) {
          const p = el("p");
          const chip = el("span", "grade", entry.letter);
          chip.style.marginRight = "10px";
          p.appendChild(chip);
          p.appendChild(document.createTextNode(
            `since ${new Date(entry.at).toUTCString()} · methodology v${entry.methodology_version}` +
            (entry.caps?.length ? ` · ${entry.caps.length} cap(s)` : ""),
          ));
          card.appendChild(p);
        }
        card.appendChild(el("p", "muted",
          `${lines.length} scan(s) on record. The full series is public: data/history/${slug.toLowerCase()}.jsonl`));
        hSec.appendChild(card);
        root.appendChild(hSec);
      }
    }
  } catch {
    /* no history yet */
  }

  // ---- Facts ------------------------------------------------------------
  const facts = r.facts ?? {};
  const factSec = el("section", "block");
  factSec.appendChild(el("h2", "sec", "Raw facts"));
  const card = el("div", "card");
  const rows = [
    ["Verified source", facts.verifiedSource === null ? "unknown" : String(facts.verifiedSource)],
    ["Owner / controller", facts.owner ?? "none (renounced or never set)"],
    ["Control type", facts.controlType ?? "—"],
    ["Proxy", facts.proxy ?? "not upgradeable"],
    ["Privileged functions found", (facts.privileged ?? []).join(", ") || "none"],
    ["Age", facts.ageDays === null ? "unknown" : `${facts.ageDays} days`],
    ["Total liquidity (tracked pools)", facts.liquidityUsd ? "$" + Math.round(facts.liquidityUsd).toLocaleString("en-US") : "unknown"],
    ["Top-10 unlabeled holders", facts.top10Pct === null || facts.top10Pct === undefined ? "unknown" : `${facts.top10Pct}%`],
  ];
  for (const [k, v] of rows) {
    const p = el("p");
    p.appendChild(el("strong", null, `${k}: `));
    p.appendChild(document.createTextNode(v));
    card.appendChild(p);
  }
  factSec.appendChild(card);
  factSec.appendChild(el("p", "muted", "Every value on this page is reproducible: run the open-source scanner against the same address and compare."));
  root.appendChild(factSec);

  document.getElementById("loading")?.remove();
})();
