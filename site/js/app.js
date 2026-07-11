// Index page: renders data/index.json. All content inserted via textContent
// — nothing from the data files (which include text derived from third-party
// project pages) is ever interpreted as HTML.
(async function () {
  const meta = document.getElementById("index-meta");
  const tbody = document.querySelector("#grades tbody");

  let index;
  try {
    const res = await fetch("data/index.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    index = await res.json();
  } catch {
    meta.textContent = "Could not load rating data. Please try again shortly.";
    return;
  }

  const when = index.generated_at ? new Date(index.generated_at).toUTCString() : null;
  meta.textContent = when
    ? `Last scan: ${when} · methodology v${index.methodology_version}`
    : "Awaiting the first live chain scan — grades appear automatically when it completes.";

  const covGlyph = { full: "●", partial: "◐", thin: "○" };

  for (const t of index.tokens ?? []) {
    const tr = document.createElement("tr");

    const gradeTd = document.createElement("td");
    gradeTd.appendChild(gradeChip(t));
    tr.appendChild(gradeTd);

    const tokenTd = document.createElement("td");
    const sym = document.createElement("div");
    sym.className = "sym";
    sym.textContent = t.symbol ?? "?";
    if (t.provisional) {
      const p = document.createElement("span");
      p.className = "prov";
      p.textContent = " Provisional";
      sym.appendChild(p);
    }
    const addr = document.createElement("div");
    addr.className = "addr";
    addr.textContent = `${t.chain} · ${t.address}`;
    tokenTd.append(sym, addr);
    tr.appendChild(tokenTd);

    const badgeTd = document.createElement("td");
    if (t.badge) {
      const b = document.createElement("span");
      b.className = "badge";
      b.textContent = t.badge;
      badgeTd.appendChild(b);
    } else {
      badgeTd.className = "muted";
      badgeTd.textContent = t.status === "pending_first_scan" ? "pending first scan" : "—";
    }
    tr.appendChild(badgeTd);

    const covTd = document.createElement("td");
    covTd.className = "cov";
    covTd.textContent = t.coverage ? `${covGlyph[t.coverage] ?? ""} ${t.coverage}` : "—";
    tr.appendChild(covTd);

    const liqTd = document.createElement("td");
    liqTd.className = "right muted";
    liqTd.textContent = t.liquidityUsd ? "$" + Math.round(t.liquidityUsd).toLocaleString("en-US") : "—";
    tr.appendChild(liqTd);

    if (t.status === "ok" || t.status === "stale" || t.coi) {
      tr.className = "click";
      tr.addEventListener("click", () => {
        location.href = `token.html?t=${encodeURIComponent(`${t.chain}-${t.address}`)}`;
      });
    }
    tbody.appendChild(tr);
  }

  function gradeChip(t) {
    const s = document.createElement("span");
    if (t.coi) {
      s.className = "grade gNR";
      s.textContent = "COI";
      return s;
    }
    const letter = t.letter ?? "N/R";
    const band = letter.startsWith("A") ? "gA" : letter.startsWith("B") ? "gB" : letter.startsWith("C") ? "gC" : letter.startsWith("D") ? "gD" : letter === "F" ? "gF" : "gNR";
    s.className = `grade ${band}`;
    s.textContent = letter;
    return s;
  }
})();
