// Minimal ABI encoding/decoding for the read calls the scanner makes.
// Hand-rolled and tiny on purpose: the entire chain package must stay
// auditable in one sitting, and supply-chain-minimal (zero dependencies).

export const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  owner: "0x8da5cb5b",
  getOwners: "0xa0e67e2b", // Gnosis Safe
  getThreshold: "0xe75235b8", // Gnosis Safe
  getMinDelay: "0xf27a0c92", // OZ TimelockController
  balanceOf: "0x70a08231",
};

// Privileged / risk selectors scanned for in deployed bytecode. Presence of
// a selector's 4-byte pushed constant is strong (not perfect) evidence the
// function is externally dispatchable; verified source in CI confirms.
export const RISK_SELECTORS = [
  { sig: "mint(address,uint256)", selector: "40c10f19", kind: "mint", material: true },
  { sig: "mint(uint256)", selector: "a0712d68", kind: "mint", material: true },
  { sig: "pause()", selector: "8456cb59", kind: "pause", material: true },
  { sig: "unpause()", selector: "3f4ba83a", kind: "pause", material: false },
  { sig: "blacklist(address)", selector: "f9f92be4", kind: "blacklist", material: true },
  { sig: "addBlackList(address)", selector: "0ecb93c0", kind: "blacklist", material: true },
  { sig: "setFee(uint256)", selector: "69fe0e2d", kind: "fee", material: true },
  { sig: "setTaxFeePercent(uint256)", selector: "061c82d0", kind: "fee", material: true },
  { sig: "setMaxTxAmount(uint256)", selector: "ec28438a", kind: "limits", material: true },
  { sig: "burnFrom(address,uint256)", selector: "79cc6790", kind: "burn-from", material: false },
];

const strip0x = (h) => (h?.startsWith("0x") ? h.slice(2) : h ?? "");

export function encodeAddress(addr) {
  return strip0x(addr).toLowerCase().padStart(64, "0");
}

export function callData(selector, ...words) {
  return selector + words.join("");
}

export function decodeUint(hex) {
  const h = strip0x(hex);
  if (!h) return null;
  return BigInt("0x" + h);
}

export function decodeAddress(hex) {
  const h = strip0x(hex);
  if (h.length < 64) return null;
  const addr = "0x" + h.slice(24, 64);
  return addr === "0x0000000000000000000000000000000000000000" ? null : addr;
}

/** Decodes a dynamic `string` return value (offset, length, bytes). */
export function decodeString(hex) {
  const h = strip0x(hex);
  if (h.length < 128) {
    // Some old tokens return bytes32 names.
    if (h.length === 64) {
      const bytes = Buffer.from(h, "hex");
      const end = bytes.indexOf(0);
      return bytes.subarray(0, end === -1 ? 32 : end).toString("utf8") || null;
    }
    return null;
  }
  const len = Number(BigInt("0x" + h.slice(64, 128)));
  const data = h.slice(128, 128 + len * 2);
  return Buffer.from(data, "hex").toString("utf8");
}

/** Decodes `address[]` (Safe getOwners). */
export function decodeAddressArray(hex) {
  const h = strip0x(hex);
  if (h.length < 128) return [];
  const len = Number(BigInt("0x" + h.slice(64, 128)));
  const out = [];
  for (let i = 0; i < len; i++) {
    const word = h.slice(128 + i * 64, 128 + (i + 1) * 64);
    out.push("0x" + word.slice(24));
  }
  return out;
}

/** Scans runtime bytecode for PUSH4-adjacent selector constants. */
export function scanSelectors(bytecode) {
  const code = strip0x(bytecode).toLowerCase();
  if (!code || code === "") return [];
  return RISK_SELECTORS.filter((entry) => code.includes(entry.selector));
}
