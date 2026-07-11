// MCP smoke test: spawns the real server over stdio and exercises the
// protocol — initialize, tools/list, and a tools/call — against the
// committed data tree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function rpc(child, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 8000);
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString();
      for (const line of buffer.split("\n")) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === id) {
            clearTimeout(timer);
            child.stdout.off("data", onData);
            resolve(msg);
            return;
          }
        } catch {
          /* partial line */
        }
      }
    };
    child.stdout.on("data", onData);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

test("MCP server: initialize, list tools, call list_ratings and about_assay", async () => {
  const child = spawn("node", ["apps/mcp/src/server.js"], { cwd: ROOT, stdio: ["pipe", "pipe", "inherit"] });
  try {
    const init = await rpc(child, 1, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0" },
    });
    assert.equal(init.result.serverInfo.name, "assay-ratings");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

    const tools = await rpc(child, 2, "tools/list");
    const names = tools.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["about_assay", "get_changes", "get_claims", "get_history", "get_rating", "list_ratings"]);
    // Read-only by construction: no tool name implies writing/sending.
    assert.ok(names.every((n) => !/set|send|write|sign|swap|buy|sell/.test(n)));

    const about = await rpc(child, 3, "tools/call", { name: "about_assay", arguments: {} });
    const aboutBody = JSON.parse(about.result.content[0].text);
    assert.match(aboutBody.grade_meaning, /NOT.*investment/i);

    const ratings = await rpc(child, 4, "tools/call", { name: "list_ratings", arguments: {} });
    const body = JSON.parse(ratings.result.content[0].text);
    // Works both pre-first-scan (error object) and after (token list).
    assert.ok(Array.isArray(body.tokens) || typeof body.error === "string");

    const bad = await rpc(child, 5, "tools/call", {
      name: "get_rating",
      arguments: { chain: "base", address: "0x" + "99".repeat(20) },
    });
    const badBody = JSON.parse(bad.result.content[0].text);
    assert.match(badBody.error ?? "", /No report/);
  } finally {
    child.kill();
  }
});
