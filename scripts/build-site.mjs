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

// sitemap from index.json
const index = JSON.parse(await readFile(path.join(ROOT, "data", "index.json"), "utf8"));
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

console.log(`built _site/ with ${urls.length} sitemap URLs`);
