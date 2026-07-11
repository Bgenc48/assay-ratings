#!/usr/bin/env node
// Assay MCP server — read-only trust ratings for AI agents.
//
// Runs over stdio from a checkout of the repository and answers exclusively
// from the committed data/ tree (the same bytes assayratings.com serves).
// No keys, no write tools, no network. Usage (Claude Desktop / any MCP
// client):
//   { "command": "node", "args": ["apps/mcp/src/server.js"], "cwd": "<repo>" }

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DATA = path.join(ROOT, "data");

const readJson = async (...p) => JSON.parse(await readFile(path.join(DATA, ...p), "utf8"));
const text = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const errText = (message) => ({ content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true });

const ADDRESS = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "0x-prefixed 40-hex-char address");
const CHAIN = z.string().regex(/^[a-z0-9-]+$/).describe('Chain slug, e.g. "base"');

const server = new McpServer({ name: "assay-ratings", version: "0.1.0" });

server.tool(
  "about_assay",
  "What Assay grades mean, how to read them, and the binding caveats (not investment advice; grades measure undisclosed-betrayal risk, not price).",
  {},
  async () => {
    let generated = null;
    try {
      generated = (await readJson("index.json")).generated_at;
    } catch { /* pre-first-scan */ }
    return text({
      what: "Assay publishes one letter grade (A+..F) for the gap between what a token project promises and what its blockchain proves, plus a Trust Model badge (Code-Enforced / Governance-Gated / Custodial / Discretionary) and per-dimension evidence.",
      grade_meaning: "The grade measures whether a token can betray holders in ways it hasn't disclosed — NOT whether it is a good investment, and NOT a price prediction.",
      special_letters: {
        "N/R": "not ratable (insufficient data)",
        UR: "computed low grade on a high-liquidity token, withheld pending human review (published policy)",
        COI: "not rated — founder conflict of interest, facts published without a grade",
      },
      provisional: "Tokens under 12 months old carry a Provisional badge; no token can grade above B+ under 6 months, A- under 12, or A under 24.",
      methodology: "https://assayratings.com/methodology.html (versioned; every score is stamped with the version that produced it)",
      disclaimer: "Opinions derived by a published methodology from disclosed on-chain facts. Not investment advice. Attribution required: 'Ratings by Assay — assayratings.com'.",
      data_generated_at: generated,
    });
  },
);

server.tool(
  "list_ratings",
  "List all rated tokens with letter grade, trust-model badge, coverage, provisional flag, and liquidity. Sorted by liquidity.",
  { min_liquidity_usd: z.number().optional().describe("Only tokens with at least this much tracked liquidity") },
  async ({ min_liquidity_usd }) => {
    try {
      const index = await readJson("index.json");
      let tokens = index.tokens ?? [];
      if (min_liquidity_usd) tokens = tokens.filter((t) => (t.liquidityUsd ?? 0) >= min_liquidity_usd);
      return text({ generated_at: index.generated_at, methodology_version: index.methodology_version, count: tokens.length, tokens });
    } catch {
      return errText("No rating data available yet (first scan pending).");
    }
  },
);

server.tool(
  "get_rating",
  "Full evidence report for one token: grade, dimensions with findings, triggered hard caps, claim verdicts, and raw on-chain facts.",
  { chain: CHAIN, address: ADDRESS },
  async ({ chain, address }) => {
    try {
      return text(await readJson("tokens", `${chain}-${address.toLowerCase()}.json`));
    } catch {
      return errText(`No report for ${chain}:${address}. Use list_ratings to see covered tokens; anyone can request coverage via the repository.`);
    }
  },
);

server.tool(
  "get_claims",
  "The docs-vs-chain claim verdicts for one token: what the project says, verbatim quotes, and whether the chain confirms it (VERIFIED / FALSE / UNVERIFIABLE / FORWARD_LOOKING / STALE).",
  { chain: CHAIN, address: ADDRESS },
  async ({ chain, address }) => {
    try {
      const report = await readJson("tokens", `${chain}-${address.toLowerCase()}.json`);
      return text({ symbol: report.symbol, claims: report.claims ?? [], scanned_at: report.scanned_at });
    } catch {
      return errText(`No report for ${chain}:${address}.`);
    }
  },
);

server.tool(
  "get_changes",
  "Recent trust-relevant changes across all tokens: grade moves, hard-cap triggers, controller changes, contract upgrades, claim-verdict flips.",
  { limit: z.number().int().min(1).max(300).optional(), severity: z.enum(["CRITICAL", "WARN", "INFO"]).optional() },
  async ({ limit = 50, severity }) => {
    try {
      const feed = await readJson("alerts.json");
      let alerts = feed.alerts ?? [];
      if (severity) alerts = alerts.filter((a) => a.severity === severity);
      return text({ generated_at: feed.generated_at, alerts: alerts.slice(0, limit) });
    } catch {
      return errText("No change records yet.");
    }
  },
);

server.tool(
  "get_history",
  "Append-only grade time series for one token (one entry per scan).",
  { chain: CHAIN, address: ADDRESS },
  async ({ chain, address }) => {
    try {
      const raw = await readFile(path.join(DATA, "history", `${chain}-${address.toLowerCase()}.jsonl`), "utf8");
      return text({ history: raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) });
    } catch {
      return errText(`No history for ${chain}:${address}.`);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
