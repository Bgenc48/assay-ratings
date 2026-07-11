#!/usr/bin/env node
// Regenerates recorded.json — a deterministic fictional universe used by
// tests and offline scans. Three tokens exercise the pipeline's three big
// paths: a pristine fixed-supply token, a rug-shaped token (EOA owner,
// mint selector, unlocked LP, false claim), and a registry mismatch.
// Run: node apps/scanner/fixtures/make-fixtures.js

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const S = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  owner: "0x8da5cb5b",
  getOwners: "0xa0e67e2b",
  getThreshold: "0xe75235b8",
  getMinDelay: "0xf27a0c92",
  balanceOf: "0x70a08231",
};

const word = (v) => BigInt(v).toString(16).padStart(64, "0");
const str = (s) => {
  const hex = Buffer.from(s, "utf8").toString("hex");
  const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, "0");
  return "0x" + word(0x20) + word(s.length) + padded;
};
const uint = (v) => "0x" + word(v);
const addr20 = (a) => "0x" + word(BigInt(a));
const padAddr = (a) => a.replace(/^0x/, "").toLowerCase().padStart(64, "0");
const ZERO32 = "0x" + "0".repeat(64);

const GOOD = "0x" + "aa".repeat(20);
const BAD = "0x" + "bb".repeat(20);
const MISM = "0x" + "ab".repeat(20);
const GOOD_LP = "0x" + "cc".repeat(20);
const BAD_LP = "0x" + "dd".repeat(20);
const BAD_OWNER = "0x" + "ee".repeat(20);
const DEAD = "0x000000000000000000000000000000000000dead";
const ZERO = "0x0000000000000000000000000000000000000000";
const HOLDER = (n) => "0x" + String(n).padStart(2, "0").repeat(20);

const E18 = 10n ** 18n;
const GOOD_SUPPLY = 1_000_000_000n * E18;
const BAD_SUPPLY = 1_000_000n * E18;
const LP_SUPPLY = 1000n * E18;

const call = (to, data) => `eth_call:${to.toLowerCase()}:${data}`;
const bal = (lp, holder) => call(lp, S.balanceOf + padAddr(holder));

const rpc = {
  // ---------- GOOD: pristine fixed-supply token ----------
  [call(GOOD, S.name)]: str("Goodcoin"),
  [call(GOOD, S.symbol)]: str("GOOD"),
  [call(GOOD, S.decimals)]: uint(18),
  [call(GOOD, S.totalSupply)]: uint(GOOD_SUPPLY),
  [call(GOOD, S.owner)]: { error: "execution reverted" }, // ownerless
  [`eth_getCode:${GOOD}`]: "0x6080604052deadbeefcafebabe",
  [`eth_getStorageAt:${GOOD}:0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`]: ZERO32,
  [`eth_getStorageAt:${GOOD}:0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`]: ZERO32,
  [`eth_getStorageAt:${GOOD}:0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50`]: ZERO32,
  [`eth_getStorageAt:${GOOD}:0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3`]: ZERO32,
  [`eth_getStorageAt:${GOOD}:0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b`]: ZERO32,
  // GOOD LP: 95% burned
  [call(GOOD_LP, S.totalSupply)]: uint(LP_SUPPLY),
  [bal(GOOD_LP, DEAD)]: uint((LP_SUPPLY * 95n) / 100n),
  [bal(GOOD_LP, ZERO)]: uint(0),

  // ---------- BAD: EOA owner, mint+pause+blacklist, unlocked LP ----------
  [call(BAD, S.name)]: str("Badcoin"),
  [call(BAD, S.symbol)]: str("BAD"),
  [call(BAD, S.decimals)]: uint(18),
  [call(BAD, S.totalSupply)]: uint(BAD_SUPPLY),
  [call(BAD, S.owner)]: "0x" + padAddr(BAD_OWNER),
  [`eth_getCode:${BAD}`]: "0x6080604052" + "40c10f19" + "8456cb59" + "f9f92be4" + "69fe0e2d",
  [`eth_getStorageAt:${BAD}:0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`]: ZERO32,
  [`eth_getStorageAt:${BAD}:0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`]: ZERO32,
  [`eth_getStorageAt:${BAD}:0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50`]: ZERO32,
  [`eth_getStorageAt:${BAD}:0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3`]: ZERO32,
  [`eth_getStorageAt:${BAD}:0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b`]: ZERO32,
  // Controller classification: BAD_OWNER is an EOA (no code)
  [`eth_getCode:${BAD_OWNER}`]: "0x",
  [call(BAD_OWNER, S.getOwners)]: { error: "execution reverted" },
  [call(BAD_OWNER, S.getThreshold)]: { error: "execution reverted" },
  [call(BAD_OWNER, S.getMinDelay)]: { error: "execution reverted" },
  // BAD LP: 3% burned, 97% held by the owner EOA
  [call(BAD_LP, S.totalSupply)]: uint(LP_SUPPLY),
  [bal(BAD_LP, DEAD)]: uint((LP_SUPPLY * 3n) / 100n),
  [bal(BAD_LP, ZERO)]: uint(0),

  // ---------- MISM: registry expects "WRONG", chain says "REAL" ----------
  [call(MISM, S.name)]: str("Realcoin"),
  [call(MISM, S.symbol)]: str("REAL"),
  [call(MISM, S.decimals)]: uint(18),
  [call(MISM, S.totalSupply)]: uint(BAD_SUPPLY),
  [call(MISM, S.owner)]: { error: "execution reverted" },
  [`eth_getCode:${MISM}`]: "0x6080604052",
  [`eth_getStorageAt:${MISM}:0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`]: ZERO32,
  [`eth_getStorageAt:${MISM}:0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`]: ZERO32,
  [`eth_getStorageAt:${MISM}:0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50`]: ZERO32,
  [`eth_getStorageAt:${MISM}:0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3`]: ZERO32,
  [`eth_getStorageAt:${MISM}:0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b`]: ZERO32,
};

const dexPair = (token, lp, usd, site) => [
  {
    chainId: "base",
    dexId: "uniswap",
    pairAddress: lp,
    labels: ["v2"],
    baseToken: { address: token },
    quoteToken: { symbol: "WETH" },
    liquidity: { usd },
    pairCreatedAt: 1672531200000,
    info: site ? { websites: [{ url: site }], socials: [] } : undefined,
  },
];

const BS = "https://base.blockscout.com/api/v2";
const DS = "https://api.dexscreener.com/token-pairs/v1/base";

const holdersJson = (list) => ({
  items: list.map(([address, value, isContract]) => ({
    address: { hash: address, is_contract: isContract, name: null },
    value,
  })),
});

const http = {
  [`${DS}/${GOOD}`]: dexPair(GOOD, GOOD_LP, 250000, "https://goodcoin.example"),
  [`${DS}/${BAD}`]: dexPair(BAD, BAD_LP, 40000, null),

  // GOOD holders: distributed EOAs (~8% top-10), one labeled pool excluded
  [`${BS}/tokens/${GOOD}/holders`]: holdersJson([
    [GOOD_LP, ((GOOD_SUPPLY * 15n) / 100n).toString(), true],
    [HOLDER(11), ((GOOD_SUPPLY * 3n) / 100n).toString(), false],
    [HOLDER(12), ((GOOD_SUPPLY * 3n) / 100n).toString(), false],
    [HOLDER(13), ((GOOD_SUPPLY * 2n) / 100n).toString(), false],
  ]),
  // BAD holders: one EOA whale with 60%
  [`${BS}/tokens/${BAD}/holders`]: holdersJson([
    [BAD_OWNER, ((BAD_SUPPLY * 60n) / 100n).toString(), false],
    [HOLDER(21), ((BAD_SUPPLY * 5n) / 100n).toString(), false],
  ]),
  // BAD LP holders (for the rug-ready probe): owner EOA holds 97%
  [`${BS}/tokens/${BAD_LP}/holders`]: holdersJson([
    [BAD_OWNER, ((LP_SUPPLY * 97n) / 100n).toString(), false],
  ]),

  // Ages: GOOD created 2023-01-15, BAD created 2025-01-01
  [`${BS}/addresses/${GOOD}`]: { creation_tx_hash: "0x" + "11".repeat(32) },
  [`${BS}/transactions/0x${"11".repeat(32)}`]: { timestamp: "2023-01-15T00:00:00Z" },
  [`${BS}/addresses/${BAD}`]: { creation_tx_hash: "0x" + "22".repeat(32) },
  [`${BS}/transactions/0x${"22".repeat(32)}`]: { timestamp: "2025-01-01T00:00:00Z" },

  // Verified source: GOOD yes, BAD no
  [`${BS}/smart-contracts/${GOOD}`]: { is_verified: true, source_code: "contract Goodcoin {}" },
  [`${BS}/smart-contracts/${BAD}`]: { is_verified: false },
};

const fixtures = {
  recorded_at: "2026-07-11T00:00:00Z",
  chainId: "0x2105",
  tokens: [
    {
      chain: "base",
      address: GOOD,
      expectSymbol: "GOOD",
      name: "Goodcoin",
      claims: [
        {
          id: "fixed-1", type: "fixed_supply", text: "Supply is fixed; no mint function exists.",
          quote: "There is no mint function.", source: "https://goodcoin.example/docs",
          tense: "present", material: true, review: "approved",
        },
        {
          id: "lp-1", type: "lp_locked", text: "Liquidity is burned.",
          quote: "LP tokens were sent to the dead address.", source: "https://goodcoin.example/docs",
          tense: "present", material: true, review: "approved",
        },
      ],
    },
    {
      chain: "base",
      address: BAD,
      expectSymbol: "BAD",
      name: "Badcoin",
      claims: [
        {
          id: "lp-1", type: "lp_locked", text: "Liquidity locked for 2 years.",
          quote: "Liquidity locked for 2 years!", source: "https://badcoin.example",
          tense: "present", material: true, review: "approved",
        },
        {
          id: "ren-1", type: "renounced", text: "Ownership renounced.",
          quote: "Contract renounced.", source: "https://badcoin.example",
          tense: "present", material: true, review: "approved",
        },
      ],
    },
    { chain: "base", address: MISM, expectSymbol: "WRONG", name: "Mismatch probe" },
  ],
  rpc,
  http,
};

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "recorded.json");
await writeFile(out, JSON.stringify(fixtures, null, 2) + "\n");
console.log(`wrote ${out}`);
