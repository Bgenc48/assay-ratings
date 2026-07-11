# Contributing

Thanks for helping make token trust legible. Ground rules — they exist
because this is a *rating* project, where a sloppy merge can publish a false
statement about someone's contract:

## Non-negotiables

- **`npm test` green, `npm run lint:site` clean** before any merge.
- **No LLM output in scoring paths.** Claim verdicts and scores are
  deterministic code; extracted claim drafts stay `review: "pending"` until
  a human approves them in a reviewed PR.
- **Registry changes need evidence.** New tokens: official contract address
  with source (project's own site/docs). New lockers
  (`packages/chain/registries/lockers.json`): cite the locker's audit and
  official deployment docs. New labels: cite why the address is
  non-circulating. Unverifiable additions are rejected — an unknown locker
  scoring as "locked" is exactly the failure this project exists to catch.
- **Calibrated language.** Findings and notes state chain facts ("no lock
  found at scan time"), never intent ("scam", "lied"). The honesty lint
  bans promotional language the other direction too — this site never says
  anything that reads as solicitation.
- **No new runtime dependencies** without a very good reason. The chain and
  core packages are deliberately zero-dependency and auditable in one
  sitting.
- **Methodology changes** require: semver bump in
  `packages/core/src/version.js`, changelog entries in
  `docs/METHODOLOGY.md` + `site/methodology.html`, and golden-test updates
  in the same PR.

## Dev loop

```bash
npm install --ignore-scripts
npm test
npm run scan:offline        # full pipeline on recorded fixtures
node apps/scanner/fixtures/make-fixtures.js   # regenerate fixtures if you change them
npm run build:site && npx http-server _site   # eyeball the site
```

## Security

Vulnerabilities: please use GitHub's private security advisories, not public
issues. See SECURITY.md.
