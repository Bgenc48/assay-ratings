#!/usr/bin/env node
// Honesty lint: the rating site must never read as promotion. Fails CI if
// site pages or docs contain solicitation/hype language (which would also
// endanger the UK financial-promotion and TR advisory postures), and checks
// structural invariants (CSP on every page, no inline handlers, no
// external script/style/connect origins).
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const BANNED = [
  "to the moon", "🚀", "guaranteed return", "get rich", "buy now",
  "don't miss", "investment opportunity", "price will", "pump",
  "best tokens to buy", "top tokens to buy", "financial freedom", "100x", "presale bonus",
];

const ROOT = process.cwd();
let failures = 0;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const targets = [];
for await (const f of walk(path.join(ROOT, "site"))) targets.push(f);
for await (const f of walk(path.join(ROOT, "docs"))) {
  // docs/research/ is founding market research that legitimately *discusses*
  // hype language (pump.fun, memecoin marketing); it is not site copy.
  if (f.endsWith(".md") && !f.includes(`${path.sep}research${path.sep}`)) targets.push(f);
}
targets.push(path.join(ROOT, "README.md"));

for (const file of targets) {
  const text = (await readFile(file, "utf8")).toLowerCase();
  for (const phrase of BANNED) {
    if (text.includes(phrase)) {
      console.error(`BANNED PHRASE "${phrase}" in ${path.relative(ROOT, file)}`);
      failures++;
    }
  }
  if (file.endsWith(".html") && file.includes(`${path.sep}site${path.sep}`)) {
    const raw = await readFile(file, "utf8");
    if (!raw.includes("Content-Security-Policy")) {
      console.error(`MISSING CSP meta in ${path.relative(ROOT, file)}`);
      failures++;
    }
    if (/\son[a-z]+\s*=\s*["']/i.test(raw)) {
      console.error(`INLINE EVENT HANDLER in ${path.relative(ROOT, file)}`);
      failures++;
    }
    if (/<script[^>]+src=["']https?:/i.test(raw) || /<link[^>]+href=["']https?:[^"']*\.css/i.test(raw)) {
      console.error(`EXTERNAL SCRIPT/STYLE in ${path.relative(ROOT, file)}`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\nsite-lint: ${failures} problem(s).`);
  process.exit(1);
}
console.log(`site-lint: clean (${targets.length} files checked).`);
