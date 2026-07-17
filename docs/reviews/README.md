# Under-Review memos

The files in this folder are the working papers for the human-review gate
described in `docs/METHODOLOGY.md` §8: when the methodology computes a D or
F for a token with more than $1M of liquidity, the scanner publishes the
facts and findings but holds the letter at "UR — Under Review" until a
human independently checks the evidence. Each `UR-<TOKEN>-<YYYY-MM>.md`
memo documents one such review: the dimension-by-dimension math behind the
computed grade, what was verified against vendor sources during the review,
what still needs a live on-chain check, and a concrete recommendation with
the exact registry change for each possible decision. `CURATION-*.md` memos
cover registry curation work (locker allowlist, address labels) under the
same evidence standards. Memos state what the chain and the reports show as
of a named scan; they are point-in-time documents and are not rewritten
after the fact — a later review gets a new memo.

Nothing in this folder changes a published grade by itself. A letter leaves
UR only one of two ways: the methodology recomputes something other than
D/F on a later scan, or `"reviewedLowGrade": true` is set on the token's
entry in `registry/tokens.json` in a reviewed pull request — after the
owner has independently confirmed the findings, never before. Tokens that
live in `registry/discovered.json` (auto-discovery) must first be promoted
to `registry/tokens.json` by reviewed PR, with the official source of the
address cited, before any review flag can apply to them.
