# Security

## Threat model

Assay holds no keys, custodies nothing, and signs nothing. The assets worth
attacking are **the integrity of published grades** and **the supply chain**:

- **Grade integrity.** Scores are pure functions of committed inputs; every
  scan result and history line is git-committed, so tampering is visible in
  history. The scan workflow runs with `contents: write` scoped to this
  repository only; all other workflows are read-only. Registry changes
  (tokens, lockers, labels, claim approvals) only land via reviewed PRs.
- **Prompt injection via project docs.** Crawled pages are untrusted data.
  The extractor is extraction-only (quotes required), its output is inert
  until human approval, and verdicts require deterministic on-chain checks —
  text in a project's docs cannot manufacture a VERIFIED.
- **Supply chain.** Zero runtime dependencies in the scanning/scoring path;
  `npm ci --ignore-scripts` everywhere; GitHub Actions pinned to commit
  SHAs; Dependabot on security-updates-only for npm and weekly for Actions.
- **RPC trust.** Every batch verifies the endpoint's `eth_chainId` before
  any result is used; endpoints are tried in order; empty reads are treated
  as failures, never as data.
- **The site** is static: no backend, no cookies, no analytics, no wallet
  connection, strict CSP (`default-src 'none'`), all dynamic content
  rendered via `textContent`.

## Reporting a vulnerability

Open a **private** security advisory on this repository (GitHub → Security →
Advisories → "Report a vulnerability"). Please do not open public issues
for security reports. Good-faith reports acknowledged within 72 hours.
