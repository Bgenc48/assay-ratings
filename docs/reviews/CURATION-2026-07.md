# Curation memo — lockers & labels (2026-07)

This memo records the trust-data curation done in the v0.2 PR and the
evidence standard for what comes next. Two registries drive real grade
movement and both are governed by the same rule: **an entry is only as good
as its cited, independently-checkable evidence, and a wrong entry converts
"unlocked" into "locked" (or a whale into a CEX) — the exact failure this
product exists to catch.** When in doubt, leave it out.

## 1. Liquidity lockers (`packages/chain/registries/lockers.json`)

### What the code can actually check
`inspectLiquidity` credits an LP position only when the LP **ERC-20 token**
is held at an allowlisted locker's own address (a `balanceOf(locker)` read
on the pair). Consequences to keep in mind:

- Only classic v2-style pools are analyzable. Concentrated-liquidity (v3/v4)
  position-NFT lockers are invisible to this check — **do not add them**; they
  would credit nothing and mislead.
- `lockMonthsRemaining` is never populated yet, so a locked (unburned) LP
  scores at most 50, not 100. Adding a locker turns 25 → 50, not 25 → 100. A
  per-locker expiry reader is a separate follow-up.

### Added in this PR
- **UNCX UniswapV2Locker (Base)** `0xc4E637D37113192F4F1F060DaEbD7758De7F4131`.
  Evidence obtained this session: UNCX's own GitHub repo
  (`uncx-network/liquidity-locker-univ2-contracts`) README deployments table,
  read directly, lists `lockerV2: 0xc4E637D37113192F4F1F060DaEbD7758De7F4131`
  under "Latest deployments (April 2024)".
  - **Owner action before this ships as trusted:** (1) add the audit link
    from `docs.uncx.network` (unreachable from the authoring sandbox), and
    (2) cross-check the address on `https://base.blockscout.com` — verified
    source, contract name `UniswapV2Locker`. Both are marked PENDING in the
    entry's `evidence` block. If either cannot be satisfied, **delete the
    entry** rather than ship an unverified locker.

### Candidates NOT added (documented for a future PR)
- **Team Finance LockToken (proxy)** — an address circulates in explorer tags
  (`0x4f0fd563be89ec8c3e7d595bf3639128c0a7c33a`) but the only evidence found
  was an explorer tag, which is **not sufficient**. Confirm the official
  Base deployment via `app.team.finance` / Team Finance docs before adding.
- **PinkLock v2** — no Base address confirmed; `docs.pinksale.finance` was
  unreachable this session. Same standard applies.

### Evidence standard for any locker addition
1. The vendor's **own** publication of the deployment address (docs or repo),
   not a third-party explorer tag.
2. An audit reference for the locker contract.
3. A Blockscout cross-check: verified source, expected contract name.
4. It must be a v2-style LP-ERC-20 locker (the only kind the code reads).
No Etherscan API, ever (its terms prohibit our use) — Blockscout is the
approved explorer (see `docs/METHODOLOGY.md` §7).

## 2. Address labels (`packages/chain/registries/labels.json`)

### What labels actually move
`inspectHolders` already auto-excludes (a) DexScreener pool addresses and
(b) any holder Blockscout marks as a contract. So bridge, vesting, and
staking **contracts are already excluded** without a label. The only labels
that change a score are therefore **EOA wallets** — chiefly CEX hot/deposit
wallets that would otherwise read as concentrated "unlabeled" holders.
Labels also harden the exclusion against Blockscout's `is_contract` field
being briefly null, and make the exclusion reason legible.

### Added in this PR (Phase A — zero score risk)
Vendor-documented infrastructure contracts (already auto-excluded as
contracts; labels make the exclusion explicit and robust):
- Base L2StandardBridge predeploy `0x4200…0010` (OP-stack specs)
- Aerodrome Voter `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`,
  VotingEscrow `0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4`,
  Minter `0xeB018363F0a9Af8f91F06FEe6613a751b2A33FE5`
  (aerodrome-finance/contracts README)
- UNCX locker (kind `locker`; see §1)

### Phase B — CEX EOA labels (the score-moving pass, owner-gated)
The read-only `scripts/holder-audit.mjs` added in this PR dumps, per scanned
token, the top-10 holders with their Blockscout tag, `is_contract` flag, and
current exclusion status → a candidate table. Curation rule for each
candidate:
1. A Blockscout tag naming a known exchange, **and**
2. behavioral corroboration (deposit/withdrawal pattern consistent with a
   CEX hot wallet).
Never label an address because it improves a grade — mislabeling a genuine
whale as a CEX is the false-negative direction the product must avoid. Each
label lands by its own reviewed PR citing the evidence.

First tokens worth a Phase-B pass (current `cap.concentration` or
high-top-10 readings, to be re-verified against live holders): FUN, QWLA,
ZRO, PROS, MEY. These are candidates for investigation, **not** presumed
mislabels.

## 3. Canonical bridges (`packages/chain/registries/bridges.json`, new)
Added the Base L2StandardBridge predeploy `0x4200…0010` (OP-stack predeploys
specification). This allowlist gates the bridged profile's issuance anchor:
the scanner sets `mintGate: "bridge"` only when a token's declared bridge
address, read on-chain each scan, matches an entry here. Same evidence
standard as lockers — the chain's own predeploy documentation, not a tag.
