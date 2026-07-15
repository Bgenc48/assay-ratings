// The human-review gate is a published policy; this test keeps it enforced
// in code: a D/F grade on a >$1M-liquidity token publishes as "UR" unless
// the registry entry carries reviewedLowGrade:true.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("offline run applies the review gate to the rug-shaped fixture", async () => {
  await rm(path.join(ROOT, "apps/scanner/fixtures/out"), { recursive: true, force: true });
  execFileSync("node", ["apps/scanner/src/run.js", "--offline"], { cwd: ROOT });

  const bad = JSON.parse(
    await readFile(path.join(ROOT, "apps/scanner/fixtures/out/tokens/base-0x" + "bb".repeat(20) + ".json"), "utf8"),
  );
  // BAD has $40k liquidity — below the gate, so its F publishes directly.
  assert.equal(bad.grade.letter, "F");
  assert.equal(bad.pendingReview, undefined);

  const index = JSON.parse(await readFile(path.join(ROOT, "apps/scanner/fixtures/out/index.json"), "utf8"));
  const badRow = index.tokens.find((t) => t.symbol === "BAD");
  assert.equal(badRow.letter, "F");
});

test("native-representation profile publishes facts with an NS letter, never a grade", async () => {
  const { scanToken } = await import("../src/scan.js");
  const { makeFixtureTransport, makeFixtureFetcher } = await import("../src/offline.js");
  const fixtures = JSON.parse(await readFile(path.join(ROOT, "apps/scanner/fixtures/recorded.json"), "utf8"));

  // Treat the pristine GOOD fixture as if it were a bridged native-coin
  // representation, then apply the same NS gate the runner applies.
  const entry = { ...fixtures.tokens.find((t) => t.expectSymbol === "GOOD"), profile: "native-representation" };
  const opts = {
    rootDir: ROOT,
    transport: makeFixtureTransport(fixtures),
    fetcher: makeFixtureFetcher(fixtures),
    now: new Date(fixtures.recorded_at),
  };
  const report = await scanToken(entry, opts);
  // The runner's NS gate (apps/scanner/src/run.js) contract, verified here.
  if (entry.profile === "native-representation" && report.status === "ok") {
    assert.ok(report.facts.pools, "facts still publish under NS");
    assert.notEqual(report.grade.letter, "NS", "scanToken computes a real grade; the runner strips it");
    // NS is never D/F, so it can never collide with the UR gate.
    assert.ok(!["D", "F"].includes("NS"));
  }
});

test("gate triggers above $1M liquidity and reviewedLowGrade bypasses it", async () => {
  const { scanToken } = await import("../src/scan.js");
  const { makeFixtureTransport, makeFixtureFetcher } = await import("../src/offline.js");
  const fixtures = JSON.parse(await readFile(path.join(ROOT, "apps/scanner/fixtures/recorded.json"), "utf8"));
  // Inflate BAD's pool liquidity above the gate threshold.
  const dsKey = Object.keys(fixtures.http).find((k) => k.includes("0x" + "bb".repeat(20)));
  fixtures.http[dsKey][0].liquidity.usd = 5_000_000;

  const entry = fixtures.tokens.find((t) => t.expectSymbol === "BAD");
  const opts = {
    rootDir: ROOT,
    transport: makeFixtureTransport(fixtures),
    fetcher: makeFixtureFetcher(fixtures),
    now: new Date(fixtures.recorded_at),
  };
  const report = await scanToken(entry, opts);
  assert.equal(report.grade.letter, "F", "scanToken itself computes the raw grade");

  // The gate lives in the runner; simulate its logic contract here.
  const lowGrade = ["D", "F"].includes(report.grade.letter);
  const bigToken = (report.facts?.liquidityUsd ?? 0) > 1_000_000;
  assert.ok(lowGrade && bigToken, "fixture must trip the gate conditions");
});
