# Dispute & Correction Process

Assay publishes opinions derived from disclosed facts. If a **specific
factual statement** in a report is wrong, this is the process to get it
fixed. (Disagreement with the methodology's weights or caps is welcome too —
open a discussion — but it is not a factual dispute.)

## Filing a dispute

1. Open a GitHub issue titled `Dispute: <TOKEN SYMBOL> — <one-line summary>`.
2. Identify the **exact statement** disputed (quote it from the report).
3. Attach verifiable evidence: transaction hash, contract address, storage
   slot, or documentation URL. To authenticate as the project team, include
   a message signed by an address the project has publicly identified as its
   own (any standard personal_sign; state the signing address).

## What happens

- **SLA: 10 business days** to a public written outcome.
- Possible outcomes:
  - **Corrected** — the report is fixed, the correction is recorded
    permanently in [CORRECTIONS.md](CORRECTIONS.md), and the grade
    recomputes on the next scan.
  - **Annotated** — "disputed by issuer; our verification stands", with
    reasons, linked from the report page.
  - **No action** — with reasons, in public.
- Every rated project may additionally have **one official response**
  linked from its rating page, on request.

## Scope notes

- UNVERIFIABLE is not an accusation. It means nothing on-chain can confirm
  or deny the claim; providing on-chain proof converts it.
- A FALSE verdict states what the chain showed at scan time. If state has
  changed since (e.g., liquidity has now been locked), the next scan picks
  it up automatically — you can request an expedited rescan in the issue.
- Abusive or evidence-free filings are closed without action.
