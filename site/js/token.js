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
  const band = isCoi || letter === "N/R" ? "gNR" : letter.startsWith("A") ? "gA" : letter.startsWith("B") ? "gB" : letter.startsWith("C") ? "gC" : letter.startsWith("D") ? "gD" : "gF";
  pills.appendChild(el("span", `grade big ${band}`, isCoi ? "COI" : letter));

  const title = el("h1", null, `${r.name ?? ""} (${r.symbol ?? "?"})`);
  hero.append(pills, title);
  hero.appendChild(el("div", "addr", `${r.chain} · ${r.address}`));

  const sub = el("div", "pill-row");
  if (r.grade?.badge) sub.appendChild(el("span", "badge", r.grade.badge));
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
    const row = el("div", "dim-row");
    row.appendChild(el("div", "dim-name", NAMES[key] ?? key));
    const bar = el("div", "bar");
    const fill = el("i");
    fill.style.width = dim.score === null ? "0%" : `${dim.score}%`;
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el("div", "dim-score", dim.score === null ? "no data" : String(dim.score)));
    dimSec.appendChild(row);
  }
  root.appendChild(dimSec);

  // ---- Caps -------------------------------------------------------------
  if (r.caps?.length) {
    const capSec = el("section", "block");
    capSec.appendChild(el("h2", "sec", "Hard caps triggered"));
    for (const cap of r.caps) {
      const finding = el("div", "finding crit");
      finding.appendChild(el("strong", null, `capped at ${cap.letter}: `));
      finding.appendChild(document.createTextNode(cap.reason));
      capSec.appendChild(finding);
    }
    root.appendChild(capSec);
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
