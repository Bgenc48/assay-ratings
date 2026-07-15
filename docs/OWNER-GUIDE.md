# Assay — Owner's Guide

*Written for you, Burak, assuming no technical background. Everything you
personally need to do, in order, with exact clicks. The technical system
runs itself; your job is the handful of human decisions it deliberately
refuses to automate.*

---

## 1. What you own (one page)

**Assay** (assayratings.com) is a token rating website that maintains
itself. Once a day, a robot ("the scanner") wakes up inside GitHub, reads
the blockchain, re-grades every token, finds new tokens worth covering,
records every change, and republishes the website. It costs **$0/month**
to run (the domain renewal is your only bill).

- **The website:** https://bgenc48.github.io/assay-ratings/ (becomes
  https://assayratings.com after step 2 below)
- **The engine room:** https://github.com/Bgenc48/assay-ratings — the code,
  the data, and the buttons you'll press all live here
- **What makes it special:** it checks projects' own promises ("liquidity
  locked!", "ownership renounced!") against the blockchain and publishes
  the receipts — and it keeps a permanent day-by-day record nobody can
  rewrite, not even us.

**The three rules that everything depends on** (they're published on the
site, and breaking any one destroys the business):
1. **No project ever pays for a score.** Not for a grade, a better grade,
   or a faster grade.
2. **ATA Coin never gets a grade from Assay.** Its page will show facts
   only, with the conflict-of-interest notice. Never "fix" this.
3. **You never trade a token around its rating change**, and never short
   a rated token.

---

## 2. One-time setup — finish going live (~15 minutes)

You already did: create the repo ✓, enable Pages ✓. Remaining:

**A. Point your domain at the site.**
1. Log in to the registrar where you bought assayratings.com.
2. Find "DNS settings" / "Manage DNS" for the domain.
3. Add these five records (delete any existing A/CNAME on `@` and `www`):

   | Type | Host/Name | Value |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | bgenc48.github.io |

4. On GitHub: your repo → **Settings → Pages → Custom domain** → type
   `assayratings.com` → **Save**. Wait for the green DNS check (can take
   an hour).
5. When the checkbox appears, tick **Enforce HTTPS** (may take up to a
   day). Done — assayratings.com is live.

**B. (Optional, recommended) Turn on Telegram alerts to your phone.**
1. In Telegram, message **@BotFather** → send `/newbot` → follow the two
   questions → copy the long token it gives you.
2. Message your new bot anything (e.g. "hi"). Then open
   `https://api.telegram.org/bot<YOUR-TOKEN>/getUpdates` in a browser and
   find `"chat":{"id":123456789` — that number is your chat ID.
3. On GitHub: repo → **Settings → Secrets and variables → Actions → New
   repository secret**. Add two secrets: `TELEGRAM_BOT_TOKEN` (the token)
   and `TELEGRAM_CHAT_ID` (the number).
4. From the next scan on, every 🔴 CRITICAL and 🟠 WARN change lands in
   your Telegram. No secrets = no messages; nothing breaks either way.

**C. (Optional) Enable AI claim-reading.** Add a repository secret named
`ANTHROPIC_API_KEY` (from console.anthropic.com). This is only used when
you explicitly run claim extraction — nothing automatic.

---

## 3. Your recurring duties

### Weekly (~20 minutes): review the "UR — Under Review" tokens
This is the single most important human job. When the math computes a D or
F for a token with over $1M liquidity, the system **refuses to publish the
letter** until you confirm it — because one wrong low grade on a big token
is the way rating sites die.

1. Open the site → click a token showing **UR** → read the "Hard caps
   triggered" and "Findings" sections. Each states a checkable fact.
2. Ask me (Claude) in a session: *"Review the UR on <token> — is the
   finding real or does it need the custodial/bridged profile?"* I'll check
   the evidence with you.
3. If the low grade is genuinely deserved: edit `registry/tokens.json` on
   GitHub (pencil icon), add `"reviewedLowGrade": true` to that token's
   entry, and commit. The next scan publishes the real letter.
4. If it's a profile problem (e.g. a stablecoin scored like a memecoin):
   the v0.2 methodology now has category profiles for exactly this. Add a
   `"profile"` field to that token's entry in `registry/tokens.json` —
   `"fiat-stablecoin"`, `"custodial-wrapped"`, `"bridged"`, or
   `"native-representation"` (a bridged L1 coin, which then publishes as NS,
   Not Scored). A custodial profile only lifts the grade once its
   issuer-disclosure claim is approved (see "Approve claims" below); until
   then it publishes at C ("insufficient data"), which is honest and no
   longer UR. When in doubt about which profile fits, ask me.

### When a project disputes a finding (10-business-day deadline — you promised this publicly)
1. They must open a GitHub issue titled `Dispute: <TOKEN>` with evidence.
2. Ask me to verify their evidence against the chain.
3. Outcome is always public: corrected (and logged in
   `docs/CORRECTIONS.md` — never delete from that file), annotated
   ("verification stands"), or no action with reasons.

### Monthly (~10 minutes)
- Repo → **Actions** tab: confirm "Scan" ran green in the last day (it
  runs daily at 05:17 UTC). A red run = message me.
- Skim the **Changes** page on the site — it's your product working.
- Check the **Security** tab for Dependabot alerts; merge security PRs.

---

## 4. Growing it

- **Add a specific token:** edit `registry/tokens.json` on GitHub, copy an
  existing entry, change `address` / `expectSymbol` / `name` (get the
  address from the project's *official* site only). If you paste a wrong
  address, nothing bad happens — the scanner refuses to publish when the
  symbol doesn't match.
- **Cover more tokens automatically:** the scanner already adds the
  top-traded Base tokens daily, up to 300. To raise the ceiling, ask me to
  bump `DISCOVER_MAX_TOTAL` (at ~1,000+ tokens we'll want ~$50/month of
  RPC service — the plan's Scale B).
- **Approve claims (the star feature):** the docs-vs-chain tables fill in
  when claims are approved. Easiest path: tell me *"extract and verify
  claims for <token>"* — I'll fetch their site, draft the claim records,
  verify each quote, and prepare the PR; you just merge it. Never approve
  a claim whose quote you haven't seen on the project's page.
- **Marketing (Phase 1 of the venture plan):** 2–3 "grade drops" of
  trending Base tokens weekly + a weekly worst-gap thread, on X/Farcaster.
  The content generates itself from the Changes feed; ask me to draft
  posts from it whenever you want.

---

## 5. Money (from the venture plan — the full detail is docs/Token-Trust-Rating-Venture-Plan.pdf)

- **Free forever:** the grades, the site, the attribution-required API.
- **First revenue when you're ready:** Pro alerts ~$24/mo (Telegram alerts
  for anyone's watchlist — the infrastructure already exists), API tiers
  $99–$399/mo, human deep-dive reports ~$3.5k (buyer pays; never the
  project being rated).
- **Grants:** Base Builder Grants are retroactive — shipping this site is
  itself the application. Also Gitcoin rounds and Optimism Retro Funding.
  Ask me to draft applications once the site has a few weeks of history.
- **Before the first paid customer or the first confirmed F on a big
  token, whichever comes first:** form the **Wyoming LLC** (~$160–300;
  doola/Firstbase-type services do it online) — it's the liability shield
  and it unlocks Stripe. Then ~2 hours of US attorney review of the site
  terms, and a Turkish CPA opinion at first revenue. All budgeted and
  explained in the venture plan, Part VI.

---

## 6. Never-do list

- Never accept anything of value from a rated project — including their
  tokens, "marketing partnerships", or expedited-review fees.
- Never edit a grade, a history file, or the corrections log by hand.
  Grades change only when the chain changes or the methodology versions up.
- Never remove the ATA conflict-of-interest carve-out.
- Never add an affiliate link, a "buy" button, or a "top tokens" list to
  the site (this also keeps you clear of UK/TR financial-promotion rules).
- Never launch an Assay token.

---

## 7. Where everything is

| Thing | Place |
|---|---|
| The site | https://assayratings.com (after DNS) / https://bgenc48.github.io/assay-ratings/ |
| Run/inspect the robot | GitHub repo → Actions tab → "Scan" → Run workflow |
| Token list | `registry/tokens.json` (yours) + `registry/discovered.json` (automatic) |
| Every report, grade history, alert | `data/` in the repo — also served as the free API |
| The method (public promise) | `docs/METHODOLOGY.md` + site Methodology page |
| Policies you're bound by | site Policies page; `docs/COI-POLICY.md`, `docs/DISPUTES.md` |
| For AI agents | `apps/mcp` — an MCP server any agent can plug in |
| For future Claude sessions | `CLAUDE.md` at the repo root — I read it automatically |
| The business plan | `docs/Token-Trust-Rating-Venture-Plan.pdf` + `docs/research/` |
