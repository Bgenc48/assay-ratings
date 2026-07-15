#!/usr/bin/env node
// Read-only holder audit — a curation aid for the address-label registry
// (packages/chain/registries/labels.json), Phase B in docs/reviews/
// CURATION-2026-07.md. For each scanned token it lists the top holders with
// their Blockscout tag, contract flag, and current exclusion status, so a
// human can spot CEX/infrastructure EOAs that a concentration reading is
// counting as whales.
//
// It writes NOTHING to the repo — it prints a Markdown report to stdout.
// It needs network (public Blockscout); it is not part of the offline gate.
//
//   node scripts/holder-audit.mjs                 # every rated token
//   node scripts/holder-audit.mjs 0xabc… 0xdef…   # only these addresses
//   node scripts/holder-audit.mjs --min-top10 40  # only high-concentration
//   node scripts/holder-audit.mjs --top 15        # show N holders (default 10)
//
// Curation rule (do not skip): only ever add a label backed by a Blockscout
// tag AND behavioral corroboration, and never to improve a grade. Mislabeling
// a genuine whale as a CEX is the failure this product exists to catch.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { blockscoutHolders, loadLabels } from "@assay/chain";

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : dflt;
};
const TOP = Number(flag("--top", "10"));
const MIN_TOP10 = flag("--min-top10", null) === null ? null : Number(flag("--min-top10", "0"));
const onlyAddrs = new Set(argv.filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a)).map((a) => a.toLowerCase()));

const bigOr0 = (v) => { try { return BigInt(v); } catch { return 0n; } };
const pctOf = (part, whole) => (whole > 0n ? Number((part * 10000n) / whole) / 100 : null);

async function main() {
  const index = JSON.parse(await readFile(path.join(ROOT, "data", "index.json"), "utf8"));
  const labels = (await loadLabels()).base ?? {};
  const labelSet = new Set(Object.keys(labels).map((a) => a.toLowerCase()));

  let tokens = index.tokens.filter((t) => t.status === "ok" && t.chain === "base");
  if (onlyAddrs.size) tokens = tokens.filter((t) => onlyAddrs.has(t.address.toLowerCase()));
  if (MIN_TOP10 !== null) {
    // Re-read each report's top10Pct; skip below the threshold.
    const kept = [];
    for (const t of tokens) {
      const rep = await report(t);
      if ((rep?.facts?.top10Pct ?? 0) >= MIN_TOP10) kept.push(t);
    }
    tokens = kept;
  }

  console.log(`# Holder audit — ${tokens.length} token(s)\n`);
  console.log("Exclusion status reflects the same rules as the concentration");
  console.log("scorer: labeled addresses and DexScreener pools are excluded, and any");
  console.log("holder Blockscout flags as a contract is excluded as unlabeled");
  console.log("infrastructure. A **counted EOA with a CEX-shaped Blockscout tag** is the");
  console.log("candidate to investigate for a Phase-B label.\n");

  for (const t of tokens) {
    const rep = await report(t);
    const poolSet = new Set((rep?.facts?.pools ?? []).map((p) => (p.pair ?? "").toLowerCase()));
    const supply = bigOr0(rep?.facts?.totalSupply ?? "0");
    let holders;
    try {
      holders = await blockscoutHolders("base", t.address, {});
    } catch (e) {
      console.log(`## ${t.symbol} (${t.address})\n\n_holder lookup failed: ${e.message}_\n`);
      continue;
    }
    console.log(`## ${t.symbol} — ${t.name ?? ""}`);
    console.log(`address: ${t.address} · published top-10 (unlabeled): ${rep?.facts?.top10Pct ?? "?"}%\n`);
    console.log("| # | holder | share | contract? | blockscout tag | status |");
    console.log("|--:|---|--:|:--:|---|---|");
    holders.slice(0, TOP).forEach((h, i) => {
      const share = supply > 0n ? `${pctOf(bigOr0(h.value), supply) ?? "?"}%` : "?";
      const status = labelSet.has(h.address)
        ? `excluded (label:${labels[h.address]?.label})`
        : poolSet.has(h.address)
          ? "excluded (pool)"
          : h.isContract
            ? "excluded (unlabeled-contract)"
            : "**counted (EOA)**";
      console.log(`| ${i + 1} | \`${h.address}\` | ${share} | ${h.isContract ? "yes" : "no"} | ${h.name ?? "—"} | ${status} |`);
    });
    console.log("");
  }

  console.log("---");
  console.log("Add a label only with a Blockscout tag AND behavioral corroboration,");
  console.log("by reviewed PR, citing the evidence. Never label to change a grade.");
}

async function report(t) {
  try {
    const slug = `${t.chain}-${t.address.toLowerCase()}`;
    return JSON.parse(await readFile(path.join(ROOT, "data", "tokens", `${slug}.json`), "utf8"));
  } catch {
    return null;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
