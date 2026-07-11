# Go-Live Runbook — assayratings.com

Everything in this repository is built and tested. These are the only steps
that require the founder's hands (each is minutes, not hours).

## 1. Put the repository on GitHub

1. github.com → **New repository** → name: `assay-ratings`, owner
   `Bgenc48`, **Public**, no README/License (the repo has them). Create.
2. Push (from wherever this repository's clone lives):
   ```bash
   git remote add origin https://github.com/Bgenc48/assay-ratings.git
   git push -u origin main
   ```
3. The **Tests** workflow runs automatically and must be green.

## 2. Enable GitHub Pages

1. Repo → **Settings → Pages** → Source: **GitHub Actions**.
2. Repo → **Actions** tab → run **“Deploy site”** (workflow_dispatch) once.
3. The site is now live at `https://bgenc48.github.io/assay-ratings/`.

## 3. Point assayratings.com at it

At your domain registrar's DNS panel, add:

| Type | Host | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `bgenc48.github.io` |

Then: repo → Settings → Pages → **Custom domain** → `assayratings.com` →
Save → wait for the DNS check → tick **Enforce HTTPS** (appears once the
certificate is issued, up to ~24h). The `site/CNAME` file is already in the
repo so deploys keep the domain binding.

## 4. First live scan

Repo → Actions → **Scan** → “Run workflow”. It reads live chain state for
every registry token, commits the data, and redeploys the site — the N/R
“pending first scan” rows become real grades. It then runs itself daily
(05:17 UTC). **Check the first run's output**: any `registry_mismatch`
lines mean a seeded address failed the symbol gate — those tokens publish
nothing until the registry entry is fixed by PR (this is the safety gate
working, not a bug).

## 5. Optional, later

- **Claims extraction**: `ANTHROPIC_API_KEY` as a repo secret (or run
  locally: `npm run extract-claims base 0x… https://project-site`).
  Extracted drafts land as `review: "pending"` — you approve them by
  editing to `"approved"` in a PR. Never approve a claim you haven't
  checked against its source URL.
- **Add tokens**: PR to `registry/tokens.json` (address + expectSymbol +
  official source in the PR description).
- **X / Farcaster / Telegram bots and paid alerts**: phase 2 per the
  venture plan (Token-Trust-Rating-Venture-Plan.pdf, Parts III–V).
- **Wyoming LLC, ToS review, media-liability insurance**: legal runway per
  the venture plan Part VI — form the LLC before publishing the first F
  grade on a large token.

## Costs at this scale

$0/month: public repo (free Actions), GitHub Pages (free), public RPCs +
Blockscout + DexScreener (free tiers), no servers, no database. The domain
renewal is the only recurring cost.
