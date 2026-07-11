// Token-level chain checks: ERC-20 metadata, bytecode selector scan,
// EIP-1967 proxy detection, and owner classification. One batched read
// per stage keeps a full token scan to a handful of HTTP round-trips.

import { rpcBatch, batchCall } from "../rpc.js";
import {
  SELECTORS,
  callData,
  decodeUint,
  decodeAddress,
  decodeString,
  decodeAddressArray,
  scanSelectors,
} from "../abi.js";

// EIP-1967 storage slots.
const SLOT_IMPLEMENTATION = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const SLOT_ADMIN = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const SLOT_BEACON = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
// Legacy ZeppelinOS proxy slots (pre-EIP-1967; USDC's FiatTokenProxy uses
// these): keccak256("org.zeppelinos.proxy.implementation") / ".admin".
const SLOT_ZOS_IMPLEMENTATION = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3";
const SLOT_ZOS_ADMIN = "0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b";

const ZERO32 = "0x" + "0".repeat(64);

/**
 * Reads metadata + bytecode + proxy slots + owner in two RPC batches.
 * Never throws on per-field failures; absent data comes back as null so the
 * scorer can treat it as reduced coverage, not worst-case.
 */
export async function inspectToken(network, address, opts = {}) {
  const to = address;

  // Batch 1: metadata, owner, code, proxy slots.
  const [nameHex, symbolHex, decimalsHex, totalSupplyHex, ownerHex, code, implSlot1967, adminSlot1967, beaconSlot, implSlotZos, adminSlotZos] =
    await rpcBatch(
      network,
      [
        { method: "eth_call", params: [{ to, data: SELECTORS.name }, "latest"] },
        { method: "eth_call", params: [{ to, data: SELECTORS.symbol }, "latest"] },
        { method: "eth_call", params: [{ to, data: SELECTORS.decimals }, "latest"] },
        { method: "eth_call", params: [{ to, data: SELECTORS.totalSupply }, "latest"] },
        { method: "eth_call", params: [{ to, data: SELECTORS.owner }, "latest"] },
        { method: "eth_getCode", params: [to, "latest"] },
        { method: "eth_getStorageAt", params: [to, SLOT_IMPLEMENTATION, "latest"] },
        { method: "eth_getStorageAt", params: [to, SLOT_ADMIN, "latest"] },
        { method: "eth_getStorageAt", params: [to, SLOT_BEACON, "latest"] },
        { method: "eth_getStorageAt", params: [to, SLOT_ZOS_IMPLEMENTATION, "latest"] },
        { method: "eth_getStorageAt", params: [to, SLOT_ZOS_ADMIN, "latest"] },
      ],
      { ...opts, soft: true },
    );

  const totalSupply = safe(() => decodeUint(totalSupplyHex));
  if (totalSupply === null || totalSupply === 0n) {
    // Zero supply on an ERC-20 read usually means an RPC returned empty
    // data. Treat as failure, never publish garbage. (ATA lesson.)
    throw new Error("totalSupply read returned zero/empty — refusing to scan");
  }

  const proxyImpl = slotAddress(implSlot1967) ?? slotAddress(implSlotZos);
  const proxyAdmin = slotAddress(adminSlot1967) ?? slotAddress(adminSlotZos);
  const proxyBeacon = slotAddress(beaconSlot);
  const proxyType = slotAddress(implSlot1967)
    ? "eip1967"
    : slotAddress(implSlotZos)
      ? "zos-legacy"
      : proxyBeacon
        ? "beacon"
        : null;

  // If proxied, the risk selectors live in the implementation bytecode.
  let scanCode = code;
  if ((proxyType === "eip1967" || proxyType === "zos-legacy") && proxyImpl) {
    const [implCode] = await rpcBatch(network, [{ method: "eth_getCode", params: [proxyImpl, "latest"] }], opts);
    scanCode = (code ?? "") + (implCode ?? "");
  }

  const riskSelectors = scanSelectors(scanCode);
  const ownerAddress = safe(() => decodeAddress(ownerHex));

  // Classify the controller: the proxy admin outranks owner() for upgrade
  // power; otherwise the owner is the controller of privileged selectors.
  const controller = proxyAdmin ?? ownerAddress;
  const control = controller ? await classifyController(network, controller, opts) : { type: "none" };

  return {
    address: to,
    meta: {
      name: safe(() => decodeString(nameHex)),
      symbol: safe(() => decodeString(symbolHex)),
      decimals: safe(() => Number(decodeUint(decimalsHex))),
      totalSupply: totalSupply.toString(),
    },
    supply: {
      mintable: riskSelectors.some((s) => s.kind === "mint"),
      upgradeable: proxyType !== null,
      feeOnTransfer: null, // advisory-only in v1 (see docs/METHODOLOGY.md)
    },
    admin: {
      ownerAddress,
      proxy: { type: proxyType, implementation: proxyImpl, admin: proxyAdmin, beacon: proxyBeacon },
      privilegedSelectors: riskSelectors.map((s) => ({ sig: s.sig, kind: s.kind, material: s.material })),
      controller,
      controlType: control.type,
      safe: control.safe ?? null,
      timelockDelaySeconds: control.timelockDelaySeconds ?? null,
    },
    evidence: {
      owner: { type: "eth_call", to, data: SELECTORS.owner, result: ownerHex ?? null },
      proxySlots: {
        implementation: implSlot1967 ?? ZERO32,
        admin: adminSlot1967 ?? ZERO32,
        zosImplementation: implSlotZos ?? ZERO32,
        zosAdmin: adminSlotZos ?? ZERO32,
      },
      bytecodeBytes: ((code?.length ?? 2) - 2) / 2,
    },
  };
}

/** EOA vs Safe vs Timelock vs other-contract, by probing the controller. */
export async function classifyController(network, address, opts = {}) {
  if (!address) return { type: "none" };
  try {
    const [code] = await rpcBatch(network, [{ method: "eth_getCode", params: [address, "latest"] }], opts);
    if (!code || code === "0x") return { type: "eoa" };

    const [ownersHex, thresholdHex, delayHex] = await batchCall(
      network,
      [
        { to: address, data: SELECTORS.getOwners },
        { to: address, data: SELECTORS.getThreshold },
        { to: address, data: SELECTORS.getMinDelay },
      ],
      { ...opts, soft: true },
    ).catch(() => [null, null, null]);

    const owners = safe(() => decodeAddressArray(ownersHex));
    const threshold = safe(() => Number(decodeUint(thresholdHex)));
    if (owners && owners.length > 0 && threshold) {
      return { type: "safe", safe: { owners: owners.length, threshold } };
    }
    const delay = safe(() => Number(decodeUint(delayHex)));
    if (delay !== null && delay > 0) {
      return { type: "timelock", timelockDelaySeconds: delay };
    }
    return { type: "contract" };
  } catch {
    return { type: "unknown" };
  }
}

function slotAddress(slotValue) {
  if (!slotValue || slotValue === ZERO32 || slotValue === "0x0" || slotValue === "0x") return null;
  const h = slotValue.replace(/^0x/, "").padStart(64, "0");
  const addr = "0x" + h.slice(24);
  return addr === "0x0000000000000000000000000000000000000000" ? null : addr;
}

function safe(fn) {
  try {
    const v = fn();
    return v === undefined ? null : v;
  } catch {
    return null;
  }
}
