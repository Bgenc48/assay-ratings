#!/usr/bin/env node
// Batch runner. Reads registry/tokens.json, scans every non-excluded entry,
// writes data/tokens/<chain>-<address>.json + data/index.json, and appends
// one line per scan to data/history/<chain>-<address>.jsonl — the
// append-only trust time series that cannot be backfilled.
//
//   node apps/scanner/src/run.js               live scan (network required)
//   node apps/scanner/src/run.js --offline     replay fixtures (tests/dev)
//   node apps/scanner/src/run.js --only 0x...  scan a single address

import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { scanToken } from "./scan.js";
import { makeFixtureTransport, makeFixtureFetcher } from "./offline.js";
import { computeAlerts, mergeFeed } from "./alerts.js";
import { METHODOLOGY_VERSION } from "@assay/core";

const argv = process.argv.slice(2);
const OFFLINE = argv.includes("--offline");
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1]?.toLowerCase() : null;
const ROOT = process.cwd();
// Offline runs write to a scratch dir so fictional fixture tokens can
// never leak into the published data/ tree.
const DATA_DIR = OFFLINE ? path.join(ROOT, "apps", "scanner", "fixtures", "out") : path.join(ROOT, "data");

async function main() {
  let transport;
  let fetcher;
  let now;
  let registry;
  if (OFFLINE) {
    // Offline mode replays the recorded fixture universe (fictional tokens)
    // and never touches the real registry or the real data/ outputs.
    const fixtures = JSON.parse(
      await readFile(path.join(ROOT, "apps", "scanner", "fixtures", "recorded.json"), "utf8"),
    );
    transport = makeFixtureTransport(fixtures);
    fetcher = makeFixtureFetcher(fixtures);
    now = new Date(fixtures.recorded_at); // deterministic offline output
    registry = { tokens: fixtures.tokens };
  } else {
    registry = JSON.parse(await readFile(path.join(ROOT, "registry", "tokens.json"), "utf8"));
    // Auto-discovered tokens (registry/discovered.json, written by
    // discover.js) join the scan after the hand-curated set.
    try {
      const discovered = JSON.parse(await readFile(path.join(ROOT, "registry", "discovered.json"), "utf8"));
      const known = new Set(registry.tokens.map((t) => t.address.toLowerCase()));
      registry.tokens.push(...discovered.tokens.filter((t) => !known.has(t.address.toLowerCase())));
    } catch {
      /* no discovered file yet */
    }
  }
  const entries = registry.tokens.filter((t) => !t.excluded && (!only || t.address.toLowerCase() === only));

  await mkdir(path.join(DATA_DIR, "tokens"), { recursive: true });
  await mkdir(path.join(DATA_DIR, "history"), { recursive: true });

  const index = [];
  const newAlerts = [];
  let failures = 0;

  for (const entry of entries) {
    const slug = `${entry.chain}-${entry.address.toLowerCase()}`;
    process.stdout.write(`scanning ${entry.expectSymbol ?? entry.address} ... `);
    // Previous report, for the alert diff. Missing = first listing.
    let prevReport = null;
    try {
      prevReport = JSON.parse(await readFile(path.join(DATA_DIR, "tokens", `${slug}.json`), "utf8"));
    } catch {
      /* first scan of this token */
    }
    try {
      let report;
      try {
        report = await scanToken(entry, { rootDir: ROOT, transport, fetcher, now });
      } catch (firstError) {
        if (OFFLINE) throw firstError;
        // One retry after a pause — public endpoints rate-limit in bursts.
        await new Promise((resolve) => setTimeout(resolve, 4000));
        report = await scanToken(entry, { rootDir: ROOT, transport, fetcher, now });
      }
      report.notes = entry.notes ?? null;
      report.coi = entry.coi ?? false;

      // Human-review gate (methodology §8): a D/F grade on a token with
      // meaningful liquidity is never auto-published. It ships as
      // "UR — Under Review" (facts and findings fully visible) until a
      // human confirms the finding by setting reviewedLowGrade:true on the
      // registry entry in a reviewed PR.
      const lowGrade = report.status === "ok" && ["D", "F"].includes(report.grade.letter);
      const bigToken = (report.facts?.liquidityUsd ?? 0) > 1_000_000;
      if (lowGrade && bigToken && !entry.reviewedLowGrade) {
        report.pendingReview = { computed: report.grade.letter };
        report.grade = { ...report.grade, letter: "UR" };
        report.reviewNote =
          "Under Review — the methodology computed a low grade for this high-liquidity token. " +
          "Per policy, D/F grades above $1M liquidity are human-verified before publication. " +
          "The facts and findings below are published; the letter grade follows review.";
      }

      // Founder conflict of interest: facts are published, the grade is not.
      if (entry.coi && report.status === "ok") {
        report.grade = {
          letter: "COI",
          overall: null,
          provisional: false,
          badge: report.grade.badge,
          coverage: report.grade.coverage,
        };
        report.coiNote =
          "Not Rated — Founder Conflict of Interest. The operator of Assay is affiliated with this token. " +
          "Raw dimension facts and claim verdicts are published below; Assay does not grade it. See the COI policy.";
      }

      await writeFile(path.join(DATA_DIR, "tokens", `${slug}.json`), JSON.stringify(report, null, 2) + "\n");

      if (!entry.coi) newAlerts.push(...computeAlerts(prevReport, report, { now: now ?? new Date() }));

      if (report.status === "ok") {
        await appendFile(
          path.join(DATA_DIR, "history", `${slug}.jsonl`),
          JSON.stringify({
            at: report.scanned_at,
            letter: report.grade.letter,
            overall: report.grade.overall,
            caps: report.caps.map((c) => c.id),
            methodology_version: report.methodology_version,
          }) + "\n",
        );
      }

      index.push({
        chain: entry.chain,
        address: entry.address.toLowerCase(),
        symbol: report.symbol ?? entry.expectSymbol ?? null,
        name: report.name ?? entry.name ?? null,
        status: report.status,
        letter: report.grade?.letter ?? "N/R",
        overall: report.grade?.overall ?? null,
        provisional: report.grade?.provisional ?? false,
        badge: report.grade?.badge ?? null,
        coverage: report.grade?.coverage ?? null,
        coi: entry.coi ?? false,
        liquidityUsd: report.facts?.liquidityUsd ?? null,
        scanned_at: report.scanned_at,
      });
      console.log(report.status === "ok" ? `${report.grade.letter}` : report.status);
      if (!OFFLINE) await new Promise((resolve) => setTimeout(resolve, 750)); // be polite to public endpoints
    } catch (error) {
      failures += 1;
      console.log(`FAILED (${error.message})`);
      // A failed scan never overwrites previous good data and never
      // publishes a guess. The index keeps the last good entry if any.
      try {
        const prev = JSON.parse(await readFile(path.join(DATA_DIR, "tokens", `${slug}.json`), "utf8"));
        index.push({
          chain: entry.chain,
          address: entry.address.toLowerCase(),
          symbol: prev.symbol ?? entry.expectSymbol ?? null,
          name: prev.name ?? entry.name ?? null,
          status: "stale",
          letter: prev.grade?.letter ?? "N/R",
          overall: prev.grade?.overall ?? null,
          provisional: prev.grade?.provisional ?? false,
          badge: prev.grade?.badge ?? null,
          coverage: prev.grade?.coverage ?? null,
          coi: entry.coi ?? false,
          liquidityUsd: prev.facts?.liquidityUsd ?? null,
          scanned_at: prev.scanned_at,
        });
      } catch {
        index.push({
          chain: entry.chain,
          address: entry.address.toLowerCase(),
          symbol: entry.expectSymbol ?? null,
          name: entry.name ?? null,
          status: "pending_first_scan",
          letter: "N/R",
          overall: null,
          provisional: false,
          badge: null,
          coverage: null,
          coi: entry.coi ?? false,
          liquidityUsd: null,
          scanned_at: null,
        });
      }
    }
  }

  index.sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
  await writeFile(
    path.join(DATA_DIR, "index.json"),
    JSON.stringify(
      {
        generated_at: (now ?? new Date()).toISOString(),
        methodology_version: METHODOLOGY_VERSION,
        offline: OFFLINE,
        tokens: index,
      },
      null,
      2,
    ) + "\n",
  );

  // Alert feed: rolling public record (data/alerts.json) + this run's
  // alerts alone (data/alerts-latest.json, consumed by the notifier).
  const generatedAt = (now ?? new Date()).toISOString();
  let existingFeed = null;
  try {
    existingFeed = JSON.parse(await readFile(path.join(DATA_DIR, "alerts.json"), "utf8"));
  } catch {
    /* first run */
  }
  await writeFile(
    path.join(DATA_DIR, "alerts.json"),
    JSON.stringify(mergeFeed(existingFeed, newAlerts, { generatedAt }), null, 2) + "\n",
  );
  await writeFile(
    path.join(DATA_DIR, "alerts-latest.json"),
    JSON.stringify({ generated_at: generatedAt, alerts: newAlerts }, null, 2) + "\n",
  );

  console.log(`\n${index.length} token(s) in index, ${failures} scan failure(s), ${newAlerts.length} alert(s).`);
  // Failures are non-fatal for the batch (stale data is kept and labeled),
  // but a fully-failed live scan should fail CI loudly.
  if (failures > 0 && failures === entries.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
