# MAXHINAL-13 — bounded adapter (experimental)

Thirteen differently constrained local constitutions across two existing hosted Supabase project fault domains, using one compatible signed reLATTE v0 crossing format.

**SUPABASE HOST != WORLD. LOGICAL SOVEREIGNTY != PHYSICAL ISOLATION.**

## Current verified state

The repository carries a **local simulation**, not a live two-project network proof. The archived fixture `evidence/mx13-001.local.json` independently verifies 13 crossing signatures, 13 mandatory HOLD receipts and 13 local disposition receipts. Each of the 13 logical nodes has a distinct P-256 identity **in the local simulation**; the original INVITATION bytes were read by the host runner but are not vendored. Signed receipt verification is independent of the original bytes; rehashing those bytes is not.

The original source was 670,478 bytes, SHA-256 `af82b9a3b2d5eeb1ce3d58038b3415ca62f0815bd6f0a04662ec8cf5b773d171`. Its observed filename ends `.png`, but the bytes are JPEG/JFIF. That mismatch is retained rather than corrected.

## Local checks

From `adapters/maxhinal13`:

~~~sh
npm ci --ignore-scripts
npm test
~~~

When the exact original INVITATION bytes are present, run the complete exact-byte tests:

~~~sh
MX13_INVITATION_PATH=/path/to/original-invitation.jpg npm test
node --experimental-strip-types scripts/run-mx13-local.ts /path/to/original-invitation.jpg evidence/mx13-001.local.json
~~~

The CLI refuses an altered file and writes only signed crossing/receipt traces, public verification keys and clearly negative hosted-execution claims. It does not upload or vendor the image.

On CI, only tests requiring the missing external original skip. The archived 39-signature proof still verifies from a clean checkout without the image.

## Live deployment boundaries

Additive migrations are in `sql/witness/001_maxhinal13.sql` and `sql/pantry-gate/001_maxhinal13.sql`. These private schemas were applied to WITNESS (seven nodes) and pantry-gate (six nodes); zero anon/authenticated grants were observed. Existing application tables were not changed. Each project now has all four reviewed functions deployed (genesis v3; worker v2; ingress/status v1), including an operator-locked `mx13-genesis` Edge Function that has **not** been successfully invoked to generate live private identities. At the archive handoff, a connector security check had blocked an operator invocation. In this implementation pass, authenticated operator credentials are unavailable; the executor has not routed around that boundary. The additive capability-expiry and MAXHINAL-only index migration is now applied on both hosts, with actual schema-exposure checks and advisor reports retained in `evidence/`.

Do not mark the project network LIVE until all of these are verified on the hosted projects: node-local private keys generated in their respective hosts; public peer sync; ingress and worker deployed and verified; a signed 01→01 HOLD; a WITNESS→pantry-gate crossing; a pantry-gate→WITNESS crossing; the full thirteen-hop route; negative/replay tests; advisors; and receipt replay without Realtime. At the current gate, these are **not** earned.

## Host-local route contract

Both hosts deploy the same four reviewed function entrypoints (`functions/mx13-genesis`, `functions/mx13-ingress`, `functions/mx13-worker`, `functions/mx13-status`) after reviewing and testing them. `mx13-ingress` accepts only correctly signed P-256 crossings from a pinned public peer; it writes HOLD before any node-local consequence. `mx13-worker` has a separate host-private operator capability whose SHA-256 hash is stored in a private table, and supports `seed`, `pump`, `advance`, protected `trace`, bounded `probe-return`, `edge-propose` and explicit `edge-disposition` actions. Next-hop validation remains deterministic. `mx13-status` exposes only a bounded read-only operational view. No server key or private signing key travels between hosts.

Import/export must preserve the destination-local signature and the difference between an outcome (including REFUSE/RETURN) and an onward transport operation.

## Laws

~~~text
COMMON GRAMMAR != COMMON MEANING
ROUTER != JUDGE
DELIVERY != ADMISSION
HOLD != ADMIT
LOCAL DISPOSITION != ONWARD TRANSPORT
SPECIALIZATION = BOUNDED POWER
REALTIME != HISTORY
CANDIDATE SECOND CROSSING != AUTOMATIC EXTRACTION
~~~

See [design](../../docs/superpowers/specs/2026-10-06-maxhinal-13-constellation-design.md) and [implementation plan](../../docs/superpowers/plans/2026-10-06-maxhinal-13-implementation.md).

## Issue #4 continuation

[OPERATOR.md](OPERATOR.md) is the noninteractive dry-run, authenticated bootstrap/deployment/crossing runbook. [claim-matrix.json](evidence/claim-matrix.json) separates tested simulation, actual unauthorized-host probes, and unearned LIVE claims. PNEUMA's signed bounded observations are optional; the read-only Rack UI is deferred until the secure two-host proof exists, following the issue's required proof order.

SINEW proposals are bounded relation particulars: explicit dispatch initially yields HOLD, and destination ACCEPT/REFUSE/HOLD cannot bypass its native constitution. A new proposal can be admitted without overwriting a prior refusal. Local parent receipt proof is verified before HOLD; source and destination retain independent custody. Backpressure is observational, with no auto-ADMIT or silent drop.

The executable witness below needs no original image. It uses **synthetic local material and fake host stores**, preserves one refusal, one accepted proposal and the return, and exports only public signed evidence. It is never LIVE:

```sh
node --experimental-strip-types scripts/simulate-sinew.ts /tmp/new-sinew-simulation.json --simulation-only
node --experimental-strip-types scripts/replay-traces.ts /tmp/new-sinew-simulation.json
node --experimental-strip-types scripts/replay-traces.ts evidence/sinew-001.simulation.json
```

The archived 13-node image proof and this new relation proof are separate witnesses. Neither regenerates or rehashes the missing original image. Simulation identity/SQL generators now require `--simulation-only`; live private identities are generated exclusively by host-local genesis.

See the [bounded extension decisions](../../docs/superpowers/specs/2026-10-07-maxhinal13-operator-and-observations.md) for persistence, signature and authentication choices. These extend the approved adapter without changing Human Witness core semantics or introducing a new UI/signature framework.
