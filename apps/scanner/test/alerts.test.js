import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAlerts, mergeFeed } from "../src/alerts.js";

const report = (over = {}) => ({
  status: "ok",
  chain: "base",
  address: "0x" + "aa".repeat(20),
  symbol: "GOOD",
  grade: { letter: "B+" },
  facts: { owner: null, proxyImplementation: null, verifiedSource: true, pools: [] },
  caps: [],
  claims: [],
  ...over,
});

test("first listing emits a single INFO", () => {
  const out = computeAlerts(null, report());
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "listed");
  assert.equal(out[0].severity, "INFO");
});

test("downgrade to D/F is CRITICAL; ordinary downgrade WARN; upgrade INFO", () => {
  const crit = computeAlerts(report({ grade: { letter: "B" } }), report({ grade: { letter: "D" } }));
  assert.equal(crit[0].severity, "CRITICAL");
  const warn = computeAlerts(report({ grade: { letter: "B+" } }), report({ grade: { letter: "B-" } }));
  assert.equal(warn[0].severity, "WARN");
  const info = computeAlerts(report({ grade: { letter: "C" } }), report({ grade: { letter: "B" } }));
  assert.equal(info[0].severity, "INFO");
  assert.equal(info[0].kind, "upgrade");
});

test("field appearing in a newer schema is a baseline, never an 'upgraded' alert", () => {
  // prev has no proxyImplementation field at all (older report schema).
  const prev = report();
  delete prev.facts.proxyImplementation;
  const cur = report({ facts: { owner: null, proxyImplementation: "0xabc", pools: [] } });
  const out = computeAlerts(prev, cur);
  assert.ok(!out.some((a) => a.kind === "upgraded"), "no upgrade alert on baseline establishment");
});

test("controller change and implementation change are CRITICAL", () => {
  const owner = computeAlerts(report(), report({ facts: { owner: "0xbeef", proxyImplementation: null, pools: [] } }));
  assert.ok(owner.some((a) => a.kind === "controller-changed" && a.severity === "CRITICAL"));

  const upgraded = computeAlerts(
    report({ facts: { owner: null, proxyImplementation: "0x1", pools: [] } }),
    report({ facts: { owner: null, proxyImplementation: "0x2", pools: [] } }),
  );
  assert.ok(upgraded.some((a) => a.kind === "upgraded" && a.severity === "CRITICAL"));
});

test("liquidity security drop >10 points is CRITICAL", () => {
  const pools = (pct) => [{ lockAnalyzed: true, liquidityUsd: 100, lpBurnedPct: pct, lpLockedPct: 0 }];
  const out = computeAlerts(
    report({ facts: { owner: null, proxyImplementation: null, pools: pools(95) } }),
    report({ facts: { owner: null, proxyImplementation: null, pools: pools(40) } }),
  );
  assert.ok(out.some((a) => a.kind === "liquidity-security-drop" && a.severity === "CRITICAL"));
});

test("new caps WARN, cleared caps INFO, claim flip to FALSE is CRITICAL", () => {
  const out = computeAlerts(
    report({ caps: [{ id: "old", reason: "old cap", letter: "C" }], claims: [{ id: "c1", text: "LP locked", verdict: "VERIFIED" }] }),
    report({ caps: [{ id: "new", reason: "new cap", letter: "D" }], claims: [{ id: "c1", text: "LP locked", verdict: "FALSE" }] }),
  );
  assert.ok(out.some((a) => a.kind === "cap-triggered" && a.severity === "WARN"));
  assert.ok(out.some((a) => a.kind === "cap-cleared" && a.severity === "INFO"));
  assert.ok(out.some((a) => a.kind === "claim-verdict" && a.severity === "CRITICAL"));
});

test("no changes → no alerts; failed scans → no alerts", () => {
  assert.deepEqual(computeAlerts(report(), report()), []);
  assert.deepEqual(computeAlerts(report(), { status: "registry_mismatch" }), []);
});

test("mergeFeed caps the rolling feed and puts new alerts first", () => {
  const old = { alerts: Array.from({ length: 299 }, (_, i) => ({ kind: `old-${i}` })) };
  const merged = mergeFeed(old, [{ kind: "fresh-1" }, { kind: "fresh-2" }], { cap: 300, generatedAt: "t" });
  assert.equal(merged.alerts.length, 300);
  assert.equal(merged.alerts[0].kind, "fresh-1");
  assert.equal(merged.generated_at, "t");
});
