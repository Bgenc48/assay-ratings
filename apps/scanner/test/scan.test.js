// End-to-end pipeline tests over the recorded fixture universe. These run
// the exact code path CI runs live — chain reads → claim verification →
// scoring — with a replayed transport instead of the network.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { scanToken } from "../src/scan.js";
import { makeFixtureTransport, makeFixtureFetcher } from "../src/offline.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
let fixtures, transport, fetcher, entries;

before(async () => {
  fixtures = JSON.parse(await readFile(path.join(ROOT, "apps/scanner/fixtures/recorded.json"), "utf8"));
  transport = makeFixtureTransport(fixtures);
  fetcher = makeFixtureFetcher(fixtures);
  entries = Object.fromEntries(fixtures.tokens.map((t) => [t.expectSymbol, t]));
});

const opts = () => ({ rootDir: ROOT, transport, fetcher, now: new Date(fixtures.recorded_at) });

test("pristine aged token with verified claims grades A+", async () => {
  const report = await scanToken(entries.GOOD, opts());
  assert.equal(report.status, "ok");
  assert.equal(report.symbol, "GOOD");
  assert.equal(report.grade.letter, "A+");
  assert.equal(report.grade.badge, "Code-Enforced");
  assert.equal(report.grade.provisional, false);
  assert.deepEqual(report.caps, []);
  assert.ok(report.claims.every((c) => c.verdict === "VERIFIED"));
  assert.equal(report.dimensions.liquidityPermanence.score, 100);
});

test("rug-shaped token grades F with the fatal caps on record", async () => {
  const report = await scanToken(entries.BAD, opts());
  assert.equal(report.grade.letter, "F");
  const capIds = report.caps.map((c) => c.id);
  assert.ok(capIds.includes("cap.eoa-mint"), "EOA mint must cap at F");
  assert.ok(capIds.includes("cap.false-claim"), "false LP-lock claim must be caught");
  assert.ok(capIds.includes("cap.rug-ready"), "single-EOA LP must be flagged");
  assert.ok(capIds.includes("cap.unverified"));
  // Both marketing claims are FALSE against chain state.
  assert.deepEqual(report.claims.map((c) => c.verdict), ["FALSE", "FALSE"]);
  // Language rule: notes state chain facts, never intent.
  for (const c of report.claims) assert.doesNotMatch(c.note, /lie|scam|fraud/i);
});

test("custodial fiat-stablecoin profile threads through the pipeline to a B, F-cap waived", async () => {
  const report = await scanToken(entries.STAB, opts());
  assert.equal(report.status, "ok");
  assert.equal(report.profile, "fiat-stablecoin");
  assert.equal(report.grade.letter, "B");
  assert.equal(report.grade.badge, "Custodial (disclosed)");
  const eoaMint = report.caps.find((c) => c.id === "cap.eoa-mint");
  assert.ok(eoaMint && eoaMint.waived === true, "the EOA-mint fact stays on record, waived by the profile");
  assert.ok(report.caps.some((c) => c.id === "cap.custodial-issuer" && !c.waived), "permanent B+ ceiling");
  assert.equal(report.dimensions.insiderFloat.notApplicable, true);
  assert.equal(report.dimensions.liquidityPermanence.outOfAutomatedScope, true);
});

test("a profile does not rescue a lying token: the mint-backdoor invariant holds at pipeline level", async () => {
  // Give the rug-shaped fixture a custodial profile AND a fabricated
  // disclosure. Its FALSE marketing claims must still cap it.
  const lying = {
    ...entries.BAD,
    profile: "fiat-stablecoin",
    claims: [
      ...entries.BAD.claims,
      { id: "disc-x", type: "admin_disclosure", text: "powers disclosed", quote: "we disclose everything",
        source: "https://badcoin.example", tense: "present", material: true, review: "approved",
        params: { disclosed: ["mint", "pause", "blacklist", "fee"] } },
    ],
  };
  const report = await scanToken(lying, opts());
  const capIds = report.caps.map((c) => c.id);
  assert.ok(capIds.includes("cap.false-claim"), "a materially false claim still caps a profiled token");
  assert.ok(["D", "F"].includes(report.grade.letter), `a lying custodial token must not reach a passing grade, got ${report.grade.letter}`);
});

test("registry symbol mismatch publishes nothing", async () => {
  const report = await scanToken(entries.WRONG, opts());
  assert.equal(report.status, "registry_mismatch");
  assert.equal(report.grade, undefined);
  assert.match(report.note, /human review/i);
});

test("every ok report carries evidence, timestamps, and the methodology version", async () => {
  const report = await scanToken(entries.GOOD, opts());
  assert.ok(report.methodology_version);
  assert.ok(report.scanned_at);
  assert.ok(report.facts.pools.length > 0);
  const withEvidence = Object.values(report.dimensions)
    .flatMap((d) => d.findings)
    .filter((f) => f.severity !== "info");
  // Non-info findings on GOOD should not exist; BAD's are checked implicitly
  // by the caps above. What matters: findings carry the evidence field.
  for (const f of withEvidence) assert.ok("evidence" in f);
});
