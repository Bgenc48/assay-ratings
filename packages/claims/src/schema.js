// Claim records live in registry/claims/<chain>/<address>.json.
//
// A claim enters the registry one of two ways:
//   1. Hand-curated (a human reads the project's site and records the claim
//      with its exact quote and source URL).
//   2. LLM-extracted via extract.js — which writes { review: "pending" }
//      drafts that are INERT until a human flips them to "approved".
//
// Either way, the VERDICT is never authored by a human or an LLM: it is
// computed by verify.js from chain state on every scan. Humans and LLMs
// decide what was claimed; the chain decides whether it is true.

/** Claim types the deterministic verifier understands today. */
export const CLAIM_TYPES = [
  "fixed_supply", //   "supply is fixed / no mint function"
  "renounced", //      "ownership renounced / no owner"
  "lp_locked", //      "liquidity locked/burned" params: { minMonths? }
  "vesting", //        "team tokens vested" params: { wallet, cliffDays?, durationDays? }
  "multisig", //       "treasury is an N-of-M multisig" params: { address, threshold, owners }
  "timelock", //       "admin actions behind an N-hour timelock" params: { address, minHours }
  "admin_disclosure", // docs enumerate the admin powers found on-chain
  "audited", //        "audited by X" params: { reportUrl } — scored link-resolves only
  "other", //          extracted but not yet checkable — always UNVERIFIABLE
];

export const TENSES = ["present", "forward"]; // forward => tracked commitment
export const REVIEW_STATES = ["approved", "pending", "rejected"];

/** Structural validation; returns a list of problems (empty = valid). */
export function validateClaim(claim) {
  const problems = [];
  if (!claim.id) problems.push("missing id");
  if (!CLAIM_TYPES.includes(claim.type)) problems.push(`unknown type: ${claim.type}`);
  if (!claim.text) problems.push("missing text (the claim as the project states it)");
  if (!claim.quote) problems.push("missing quote (verbatim evidence span)");
  if (!claim.source) problems.push("missing source URL");
  if (!TENSES.includes(claim.tense)) problems.push(`tense must be one of ${TENSES.join("/")}`);
  if (typeof claim.material !== "boolean") problems.push("material must be boolean");
  if (!REVIEW_STATES.includes(claim.review)) problems.push(`review must be one of ${REVIEW_STATES.join("/")}`);
  if (claim.tense === "forward" && !claim.deadline) problems.push("forward-looking claims need a deadline (ISO date)");
  return problems;
}
