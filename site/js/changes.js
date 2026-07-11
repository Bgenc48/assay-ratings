// Changes feed: renders data/alerts.json. textContent-only, as everywhere.
(async function () {
  const meta = document.getElementById("feed-meta");
  const feedEl = document.getElementById("feed");

  let feed;
  try {
    const res = await fetch("data/alerts.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    feed = await res.json();
  } catch {
    meta.textContent = "No change records yet — the feed begins with the next scheduled scan.";
    return;
  }

  const alerts = feed.alerts ?? [];
  meta.textContent = alerts.length
    ? `${alerts.length} recorded change(s) · last scan ${feed.generated_at ? new Date(feed.generated_at).toUTCString() : ""}`
    : "No changes recorded yet — new listings and grade movements will appear here after the next scan.";

  const sevClass = { CRITICAL: "crit", WARN: "warn", INFO: "" };
  for (const a of alerts) {
    const div = document.createElement("div");
    div.className = `finding ${sevClass[a.severity] ?? ""}`;

    const head = document.createElement("strong");
    head.textContent = `${a.severity} · ${a.symbol ?? a.address} — `;
    div.appendChild(head);
    div.appendChild(document.createTextNode(a.text));

    const foot = document.createElement("span");
    foot.className = "ev";
    const when = a.at ? new Date(a.at).toUTCString() : "";
    foot.textContent = `${when} · ${a.kind}`;
    div.appendChild(foot);

    const link = document.createElement("a");
    link.href = `token.html?t=${encodeURIComponent(`${a.chain}-${a.address}`)}`;
    link.textContent = "view report →";
    link.style.display = "inline-block";
    link.style.marginTop = "4px";
    div.appendChild(link);

    feedEl.appendChild(div);
  }
})();
