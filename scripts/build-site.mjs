#!/usr/bin/env node
// Assembles the deployable site: site/ (static shell) + data/ (scan output)
// → _site/. Also generates sitemap.xml from the current index. This is the
// exact artifact GitHub Pages serves — what is in the repository is
// byte-for-byte what visitors receive.
import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "_site");

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(path.join(ROOT, "site"), OUT, { recursive: true });
await cp(path.join(ROOT, "data"), path.join(OUT, "data"), { recursive: true });

// Embeddable grade badges: /badge/<chain>-<address>.svg, regenerated on
// every build so an embedded badge always shows the live grade (the badge
// license requires exactly that).
const index = JSON.parse(await readFile(path.join(ROOT, "data", "index.json"), "utf8"));
// Kept in sync with the grade tokens in site/css/site.css (--g-a … --g-f).
const BAND_COLORS = { A: "#2c6a39", B: "#1f5f7a", C: "#795610", D: "#9c4a1c", F: "#8f2d2d" };
function badgeSvg(letter) {
  const color = BAND_COLORS[(letter ?? "")[0]] ?? "#5f666e";
  const label = letter ?? "N/R";
  const lw = 52; // "Assay" cell
  const vw = Math.max(34, 14 + label.length * 9);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + vw}" height="20" role="img" aria-label="Assay: ${esc(label)}">
<rect width="${lw}" height="20" rx="3" fill="#15181c"/>
<rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
<rect x="${lw}" width="3" height="20" fill="${color}"/>
<g fill="#fff" font-family="Verdana,Geneva,sans-serif" font-size="11" text-anchor="middle">
<text x="${lw / 2}" y="14">Assay</text>
<text x="${lw + vw / 2}" y="14" font-weight="bold">${esc(label)}</text>
</g></svg>`;
}
await mkdir(path.join(OUT, "badge"), { recursive: true });
let badges = 0;
for (const t of index.tokens ?? []) {
  if (!["ok", "stale"].includes(t.status)) continue;
  const letter = t.coi ? "COI" : t.letter;
  await writeFile(path.join(OUT, "badge", `${t.chain}-${t.address}.svg`), badgeSvg(letter));
  badges++;
}
const base = "https://assayratings.com";
const urls = [
  `${base}/`,
  `${base}/methodology.html`,
  `${base}/policies.html`,
  ...(index.tokens ?? [])
    .filter((t) => t.status === "ok" || t.status === "stale")
    .map((t) => `${base}/token.html?t=${t.chain}-${t.address}`),
];
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u.replaceAll("&", "&amp;")}</loc></url>`).join("\n") +
  `\n</urlset>\n`;
await writeFile(path.join(OUT, "sitemap.xml"), sitemap);

// 404 that routes unknown paths home (Pages serves 404.html)
await writeFile(
  path.join(OUT, "404.html"),
  `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/"><title>Assay</title><a href="/">Assay</a>\n`,
);

console.log(`built _site/ with ${urls.length} sitemap URLs and ${badges} badge(s)`);
