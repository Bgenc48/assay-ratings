#!/usr/bin/env node
// Coverage growth: discovers the most-traded Base tokens from
// GeckoTerminal's public API (keyless, 30 calls/min) and appends new
// entries to registry/discovered.json. Runs before each scheduled scan,
// so coverage compounds daily without hand-editing the registry.
//
// Safety properties:
//   - Hand-curated registry/tokens.json is never touched.
//   - Discovered entries carry source:"auto-discovery" and the symbol the
//     discovery API reported; the scanner's symbol gate still applies.
//   - Minimum-liquidity floor keeps dust out; a hard cap keeps the daily
//     scan inside free public-RPC budgets. Raise the cap deliberately.
//   - Any API failure = no changes (never a partial/corrupt registry).

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const PAGES = Number(process.env.DISCOVER_PAGES ?? 8); // 20 pools/page
const MIN_RESERVE_USD = Number(process.env.DISCOVER_MIN_RESERVE_USD ?? 100_000);
const MAX_TOTAL = Number(process.env.DISCOVER_MAX_TOTAL ?? 300);
const GT = "https://api.geckoterminal.com/api/v2/networks/base/pools";

// Quote-side assets that appear in every pool; they're either hand-curated
// already or not the pool's subject.
const SKIP_SYMBOLS = new Set(["WETH", "USDC", "USDT", "DAI", "cbETH", "cbBTC", "USDbC", "EURC"]);

export function extractCandidates(pageJson) {
  const included = new Map(
    (pageJson.included ?? [])
      .filter((i) => i.type === "token")
      .map((i) => [i.id, i.attributes]),
  );
  const out = [];
  for (const pool of pageJson.data ?? []) {
    const reserve = Number(pool.attributes?.reserve_in_usd ?? 0);
    if (!reserve || reserve < MIN_RESERVE_USD) continue;
    const ref = pool.relationships?.base_token?.data?.id;
    const token = ref ? included.get(ref) : null;
    const address = token?.address ?? (ref?.startsWith("base_") ? ref.slice(5) : null);
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) continue;
    const symbol = token?.symbol ?? null;
    if (!symbol || SKIP_SYMBOLS.has(symbol)) continue;
    out.push({ address, symbol, name: token?.name ?? symbol, reserve });
  }
  return out;
}

async function main() {
  const curated = JSON.parse(await readFile(path.join(ROOT, "registry", "tokens.json"), "utf8"));
  let discovered = { tokens: [] };
  const discoveredPath = path.join(ROOT, "registry", "discovered.json");
  try {
    discovered = JSON.parse(await readFile(discoveredPath, "utf8"));
  } catch {
    /* first run */
  }

  const known = new Set(
    [...curated.tokens, ...discovered.tokens].map((t) => t.address.toLowerCase()),
  );

  const candidates = new Map();
  for (let page = 1; page <= PAGES; page++) {
    let json;
    try {
      const res = await fetch(`${GT}?include=base_token&page=${page}`, {
        headers: { accept: "application/json", "user-agent": "assay-scanner/0.1 (+https://assayratings.com)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
    } catch (error) {
      console.error(`discovery page ${page} failed (${error.message}) — stopping, keeping registry unchanged for this page`);
      break;
    }
    for (const c of extractCandidates(json)) {
      const key = c.address.toLowerCase();
      if (!known.has(key) && !candidates.has(key)) candidates.set(key, c);
    }
    await new Promise((r) => setTimeout(r, 2500)); // stay under 30 calls/min
  }

  const room = Math.max(0, MAX_TOTAL - known.size);
  const additions = [...candidates.values()]
    .sort((a, b) => b.reserve - a.reserve)
    .slice(0, room)
    .map((c) => ({
      chain: "base",
      address: c.address,
      expectSymbol: c.symbol,
      name: c.name,
      source: "auto-discovery",
      discovered_at: new Date().toISOString(),
    }));

  if (additions.length === 0) {
    console.log(`discovery: no new tokens (known=${known.size}, cap=${MAX_TOTAL}).`);
    return;
  }

  discovered.tokens = [...discovered.tokens, ...additions];
  await writeFile(discoveredPath, JSON.stringify(discovered, null, 2) + "\n");
  console.log(`discovery: +${additions.length} tokens (total known=${known.size + additions.length}, cap=${MAX_TOTAL}).`);
}

// Allow import for tests without running.
if (process.argv[1] && process.argv[1].endsWith("discover.js")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
