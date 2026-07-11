#!/usr/bin/env node
// Sends this run's CRITICAL and WARN alerts to a Telegram chat. Entirely
// optional and gated: without TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in the
// environment it exits 0 silently, so CI never fails on a missing secret.
//
// Alert texts state chain facts only (the engine's language rule), so the
// messages inherit the same calibrated wording as the site.

import { readFile } from "node:fs/promises";
import path from "node:path";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
if (!token || !chatId) {
  console.log("notify-alerts: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — skipping (this is fine).");
  process.exit(0);
}

let latest;
try {
  latest = JSON.parse(await readFile(path.join(process.cwd(), "data", "alerts-latest.json"), "utf8"));
} catch {
  console.log("notify-alerts: no alerts-latest.json — nothing to send.");
  process.exit(0);
}

const send = (latest.alerts ?? []).filter((a) => a.severity === "CRITICAL" || a.severity === "WARN");
if (send.length === 0) {
  console.log("notify-alerts: no CRITICAL/WARN alerts this run.");
  process.exit(0);
}

const icon = { CRITICAL: "🔴", WARN: "🟠" };
const lines = send
  .slice(0, 25)
  .map((a) => `${icon[a.severity]} ${a.symbol ?? a.address} — ${a.text}\nhttps://assayratings.com/token.html?t=${a.chain}-${a.address}`);
const text = `Assay scan ${latest.generated_at}\n\n${lines.join("\n\n")}${send.length > 25 ? `\n\n(+${send.length - 25} more)` : ""}`;

const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
});
if (!res.ok) {
  console.error(`notify-alerts: Telegram API ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log(`notify-alerts: sent ${send.length} alert(s).`);
