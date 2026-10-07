# MAXHINAL-13 scoped operator runbook

Only WITNESS `edxoiynjspjtxjauxhlz` and pantry-gate `kbhqacsdvjsstzyplqij` are targets. Run reviewed code from this feature branch. No new project, host pause, application table modification, signing-key export, or implicit key rotation is part of this ceremony.

## Current boundary and the exact next step

The executor has scoped management/read access and applied the additive MAXHINAL hardening migration. It does **not** have an authenticated CLI environment or either host's SQL credentials. The source archive also does not contain the original INVITATION image. The four reviewed functions are now deployed through the existing project-scoped management connection (genesis v3, other functions v1). Authenticated bootstrap, two-host crossing, 13-node crossing, live SINEW, and live PNEUMA have **not** run.

The next step is to run **step 3 (bootstrap)** below inside an already authorized operator environment. Alternatively provide the executor only that environment's configuration location, without putting credentials in chat. Step 4 additionally requires the exact original image. The Constellation Rack visualization remains gated on verified two-host crossing, as issue #4 requires.

## 1. Review and prepare privately

Use Node 22+ for tests, Deno **2.5.4** and the official Supabase CLI (validated locally with **2.81.3**). Supabase CLI deployment is documented at <https://supabase.com/docs/reference/cli/supabase-functions-deploy>. Postgres.js transaction-pooler connections use `prepare:false`: <https://supabase.com/docs/guides/database/connecting-to-postgres>.

From `adapters/maxhinal13`:

```sh
npm ci --ignore-scripts
npm test
deno check --frozen --config deno.json functions/mx13-{genesis,ingress,worker,status}/index.ts scripts/operator.ts scripts/replay-traces.ts
deno run --no-prompt --frozen --config deno.json scripts/operator.ts bootstrap --dry-run
```

Dry-run is noninteractive and does not read credentials, connect to a host, or mutate anything. `--dry-run` overrides any execution mode. The same dry-run can be used for `deploy`, `two-host`, `thirteen`, or `sinew`.

Configure these **inside secure operator storage**, outside the checkout, with shell tracing disabled. Load them from the operator's existing protected environment/config, never from an issue body or pasted terminal command:

| Variable | Private configuration |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Official CLI login capability authorized for these existing projects; needed only for deployment. |
| `MX13_WITNESS_DB_URL` | TLS direct database or transaction pooler URL belonging to WITNESS. |
| `MX13_PANTRY_DB_URL` | TLS direct database or transaction pooler URL belonging to pantry-gate. |
| `MX13_OPERATOR_DIR` | Dedicated directory outside repository, mode **0700**, no symlink; temporary raw capability files are **0600**. |
| `MX13_INVITATION_PATH` | External original file, **670478 bytes**, SHA-256 **af82b9a3b2d5eeb1ce3d58038b3415ca62f0815bd6f0a04662ec8cf5b773d171**. |
| `MX13_EVIDENCE_OUTPUT` | New, protected output filename outside checkout; commands refuse overwriting. Use a different path for each ceremony. |
| `MX13_WITNESS_STATUS_JWT` / `MX13_PANTRY_STATUS_JWT` | Optional valid project-scoped JWTs for the read-only status gateway; each is sent only to its own host. No service-role credential is needed. |
| `MX13_PARENT_TRACE_PATH` | For SINEW only: the verified `two-host` evidence file. |

The filename observed by the founding witness is `1000018575.png`; its bytes are JPEG/JFIF. Renaming or re-encoding is not a repair of the same particular. Never vendor these personal image bytes.

The additive `supabase/migrations/20261007030054_maxhinal13_transport_hardening.sql` is already applied on both projects. It adds only capability expiry and MAXHINAL payload/backlog indexes. Do not run `db push` across unrelated migrations or replace existing app schemas. Reviewed genesis v3 is deployed on both hosts and enforces expiry. The preexisting v2 implementation did not enforce this column; if reproducing from an older deployment, **deploy reviewed genesis before activating any expiring operator capability.**

## 2. Deploy the reviewed four functions

After existing official CLI authentication is loaded:

```sh
deno run --no-prompt --frozen --config deno.json --allow-env --allow-net --allow-read --allow-write --allow-run=supabase scripts/operator.ts deploy
```

The operator stages only source/config/lock files, then explicitly deploys `mx13-genesis`, `mx13-ingress`, `mx13-worker`, and `mx13-status` to each fixed project. It never uses `--prune`. Gateway JWT verification remains **enabled for status**. It is disabled only for the custom-auth protocol functions: genesis/worker enforce the custom operator capability; ingress verifies signed peer identity, destination, exact bytes and freshness; status is a bounded projection behind its JWT gateway. Host-provided `SUPABASE_DB_URL` stays local to that function host. No service key is sent across hosts.

Read-only status uses its project JWT gateway and needs no operator capability and prints only whitelisted metadata; errors/malformed views become UNKNOWN:

```sh
deno run --no-prompt --frozen --config deno.json --allow-env --allow-net scripts/operator.ts status
```

## 3. Bootstrap without transferring private node keys

```sh
deno run --no-prompt --frozen --config deno.json --allow-env --allow-net --allow-read --allow-write scripts/operator.ts bootstrap
```

This ceremony creates an independent random **32-byte / 256-bit** capability per host, writes the raw token only to protected operator storage, and writes its SHA-256 hash plus a **30-minute expiry** to that host's private capability table. Active unexpired capabilities are not overwritten. Tokens are never stdout, argv, git or CI material.

`mx13-genesis` generates each private P-256 identity inside its own Supabase host and returns only public identity. Both destinations validate all 13 public fingerprints and import the public curve points before syncing; an existing conflicting fingerprint is refused. There is no silent rotation ceremony. A repeated authorized genesis reuses the original identity; an unauthorized or expired/revoked capability is refused.

A `finally` block deactivates only hashes belonging to this invocation, removes its raw files, and closes SQL connections. If revocation fails, the operator reports `OPERATOR_REVOCATION_FAILED_TOKENS_EXPIRE_WITHIN_30_MINUTES`. In the protected environment, immediately deactivate the relevant project capability via the scoped SQL client:

```sql
update mx13_host.operator_capabilities set active=false where id='default';
```

Inspect protected temporary files locally for cleanup; do not copy their values into a support thread. For later execution the operator issues a new capability rather than reusing a revoked one.

## 4. Earn HTTPS crossing evidence in order

Set a new `MX13_EVIDENCE_OUTPUT` for each command in protected configuration. The exact image is checked before any seed upload. Existing pending work is never silently drained: if the worker returns another crossing, the ceremony stops and the operator must inspect/recover its durable outbox.

```sh
deno run --no-prompt --frozen --config deno.json --allow-env --allow-net --allow-read --allow-write scripts/operator.ts two-host
```

The route first seeds signed **01→01** and verifies mandatory HOLD plus Witness's local FORWARD. It then runs actual **01→02→01 HTTPS**. The source worker calls the destination host ingress directly; the operator calls fixed host workers. Every returned HOLD/disposition is verified and persisted before COMPLETE. The operator then independently fetches source and destination durable traces from their own host workers, binds both to the expected crossing/worlds/exact particular, compares their signed receipts, and cold-verifies their combined ancestry before advancing. A sender acknowledgement alone cannot substitute for destination history. A network error leaves PENDING with safe attempt evidence; rerun requires deliberate outbox inspection rather than inventing a receipt.

After that succeeds, with a separate output path:

```sh
deno run --no-prompt --frozen --config deno.json --allow-env --allow-net --allow-read --allow-write scripts/operator.ts thirteen
```

This runs **01→01**, then **01→02→…→13**, maintaining the exact image byte address. REFUSE and RETURN remain native local outcomes; an authorized later FORWARD creates a distinct crossing with the terminal receipt as parent. Neither Oracle, Ferryman nor Witness can manufacture ADMIT.

For the independently played relation ceremony, point `MX13_PARENT_TRACE_PATH` at the `two-host` result, with another new output path:

```sh
deno run --no-prompt --frozen --config deno.json --allow-env --allow-net --allow-read --allow-write scripts/operator.ts sinew
```

It verifies independently fetched source and destination history for every completed relation hop. It sends an unpedigreed **01→02** proposal, explicitly REFUSEs it at Gate, sends a **new** proposal with a verified Witness-local parent, explicitly ACCEPTs at Gate, then proposes **02→01** and explicitly ACCEPTs within Witness's narrower FORWARD-only constitution. Relation JSON is a new particular, not the original image. Proposal dispatch initially returns only HOLD; acceptance/refusal never automatically executes a next hop. Signed source-local parent proof is carried publicly so a bare invented reference cannot bypass Gate policy.

## 5. Cold replay, negative probes, and free-plan breath

Replay the sanitized evidence from a new process, with no SQL connection, browser storage, Realtime, original image, or host contact:

```sh
node --experimental-strip-types scripts/replay-traces.ts /protected/operator/two-host-evidence.json
```

Replay proves signature/binding/order/ancestry consistency, **not** actual HTTPS transport or image-byte rehashing. Its LIVE flags remain false even when input includes a separately observed LIVE ceremony. Preserve the transport observation alongside the receipts rather than allowing replay to promote a claim.

`evidence/unauthorized-http-probes.json` records actual repeated denied genesis requests on both existing hosts. Local hostile tests cover expired/revoked tokens, duplicates, lost reply, tamper, wrong recipient, stale timestamp, key substitution, false authority, foreign schema/key access, unreachable host, immutable terminal decisions and typed relation policy. `evidence/schema-exposure.json` records actual zero anon/authenticated usage/table privileges on the private schemas. These are **not** authenticated live hostile crossing tests.

After authorized execution, re-run project security/performance advisors and inspect scoped Edge Function error logs; never paste credential diagnostics. Current reports are `evidence/advisors-{before,after}.json`. MAXHINAL unindexed foreign keys are resolved. WITNESS has no security findings; pantry has 17 preexisting INFO notices in unrelated `pantry` tables: <https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy>. New mesh indexes legitimately appear unused before traffic: <https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index>. Unrelated app policies/indexes are not changed.

PNEUMA is optional `GET mx13-status?pulse=1`. It uses the existing receipt signature format with kind `PNEUMA_PULSE`; pulses are not persisted crossing history. One response holds the host's seven or six signed observations. Cache per warm isolate is **60 seconds**; observer TTL is **120 seconds**. Poll only while an explicit view is open, once per minute per host, pause when hidden, no timer-driven worker or background polling. A one-hour view costs at most **120 status HTTP requests** (cold starts/isolate multiplicity can add database work). Status reads are not free; review actual plan quotas before extended observation. No Realtime subscription is required. Missing/stale pulses become UNKNOWN, reconnect/reboot becomes RECOVERING, then QUIET or PULSING based on bounded backlog. None admits, refuses, executes or deletes history.

Host outage testing must simulate transport loss or stop only an explicitly local pulse observer. **Do not pause either hosted Supabase project.** The read-only 13-card Rack and live pulse demonstration begin only after the actual two-host evidence gate is earned.
