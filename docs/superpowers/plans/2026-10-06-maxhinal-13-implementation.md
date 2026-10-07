# MAXHINAL-13 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build and prove a thirteen-node logically sovereign Supabase constellation across WITNESS and pantry-gate, with exact-byte transport, mandatory HOLD, node-local constitutions, signed reLATTE-compatible receipts, replay-safe recovery, and no shared semantic authority.

**Architecture:** Human-Witness owns a bounded adapter under adapters/maxhinal13. Two Supabase projects host seven and six private logical nodes respectively. One public custom-authenticated ingress Edge Function receives P-256-signed reLATTE-compatible crossings; one capability-protected operator/worker function seeds and pumps outboxes. Every node stores exact payload bytes privately, commits HOLD before evaluating its constitution, signs its own disposition, and may forward the unchanged source particular onward even when its local disposition is REFUSE or RETURN. Forwarding is a new attributable act, not retroactive admission.

**Tech Stack:** Supabase Postgres 17, Supabase Edge Functions/Deno, TypeScript, WebCrypto P-256/ECDSA-SHA256, json-canonicalize 3.0.1, postgres 3.4.9, Node 22 test runner, reLATTE v0 protocol semantics pinned to 5d96af53a730b0ce3111e8551e62030596815069.

**Spec:** docs/superpowers/specs/2026-10-06-maxhinal-13-constellation-design.md

## Global Constraints

- Physical hosts are exactly WITNESS and pantry-gate; logical sovereignty is never described as physical isolation.
- WITNESS hosts nodes 01, 03, 05, 07, 09, 11, 13. pantry-gate hosts nodes 02, 04, 06, 08, 10, 12.
- Each logical node has one distinct P-256 signing identity. Private keys never cross the physical host boundary and never enter Git.
- The reLATTE compatibility layer must remain byte-for-byte compatible with the current v0 signing/id rules at commit 5d96af53a730b0ce3111e8551e62030596815069; Human-Witness does not become protocol owner.
- Cross-project and same-project deliveries use the same HTTP ingress contract. Same-host routing may not directly insert into another node's private tables.
- Every accepted delivery enters durable HOLD before constitution evaluation. A crash after HOLD must remain reconstructible and resumable.
- Router/transport code may verify, store, retry, and forward. It may not select node-local ADMIT/REFUSE/RETURN meaning.
- Local disposition and onward transport are separate acts. REFUSE or RETURN does not erase the source bytes and does not prevent a separately signed route-forward crossing when the experiment route requires continuation.
- Raw payload limit for MX13 v0 is 1,048,576 bytes. Oversized payloads are rejected before durable node state is created.
- Accepted timestamps may be at most 300 seconds from the receiving host's current time. Stale/future envelopes outside that window are rejected before HOLD.
- Node-private tables live outside public. Existing WITNESS and pantry-gate application schemas are not modified.
- Edge Functions use SUPABASE_DB_URL with a single-connection postgres 3.4.9 client per isolate; no remote project secret/API key is ever sent across the network.
- Public ingress uses verify_jwt=false only because it performs reLATTE P-256 verification, destination allowlisting, timestamp checks, payload hashing, and replay checks itself.
- Operator/worker control uses a random 256-bit host capability. The database stores only its SHA-256 hash; the raw capability stays only in ignored local operator material or an external secret manager and is never committed or returned by public status endpoints.
- Realtime, if added after the durable path passes, is visualization only. Reconstructibility may not depend on a WebSocket message.
- MX13-001 source particular is INVITATION: SHA-256 af82b9a3b2d5eeb1ce3d58038b3415ca62f0815bd6f0a04662ec8cf5b773d171, 670478 bytes, observed filename 1000018575.png, detected media type image/jpeg. The original bytes are supplied externally at execution time and are not committed to this repository.
- Security and performance advisors must be run on both projects after final DDL deployment and after the live adversarial pass.

## Review Focus

- Duplicate delivery after a terminal receipt: return the already-recorded result without a second consequence or second disposition receipt.
- Crash/retry after durable HOLD but before disposition: resume the original HOLD and preserve its receipt ID rather than creating a second HOLD.
- Payload overflow or content-address mismatch: reject before any inbox, payload, HOLD, receipt, or ancestry row is created.
- Stale/future signed envelope outside the 300-second window: reject even when the signature is otherwise valid.
- Destination outage during forwarding: keep one pending outbox item with the signed next crossing and exact payload bytes; retry must not rewrite the first failed attempt into a successful historical occurrence.

---

## File Structure

Create this bounded adapter without changing Human Witness core:

~~~
adapters/maxhinal13/
  README.md
  package.json
  deno.json
  src/
    model.ts
    nodes.ts
    relatte_v0.ts
    payload.ts
    constitutions.ts
    store.ts
    ingress.ts
    worker.ts
    status.ts
  functions/
    mx13-ingress/index.ts
    mx13-worker/index.ts
    mx13-status/index.ts
  sql/
    witness/001_maxhinal13.sql
    pantry-gate/001_maxhinal13.sql
    verify.sql
  scripts/
    generate-identities.ts
    build-bootstrap-sql.ts
    mx13-route.ts
    verify-evidence.ts
  fixtures/
    relatte/
      sb001-signed-crossing.json
      sb001-release-receipt.json
    mx13/
      invitation-manifest.json
  test/
    relatte_v0.test.ts
    payload.test.ts
    constitutions.test.ts
    store-contract.test.ts
    ingress.test.ts
    worker.test.ts
    status.test.ts
    route.test.ts
    adversarial.test.ts
  evidence/
    .gitkeep
.github/workflows/maxhinal13.yml
.gitignore
~~~

The implementation keeps pure protocol/constitution logic in src, Deno environment wiring in functions, host-specific DDL in sql, operator tooling in scripts, and generated live proof material in evidence only after sanitization.

### Task 1: Pin the adapter runtime and reLATTE v0 compatibility

**Files:**
- Create: adapters/maxhinal13/package.json
- Create: adapters/maxhinal13/deno.json
- Create: adapters/maxhinal13/src/model.ts
- Create: adapters/maxhinal13/src/relatte_v0.ts
- Create: adapters/maxhinal13/fixtures/relatte/sb001-signed-crossing.json
- Create: adapters/maxhinal13/fixtures/relatte/sb001-release-receipt.json
- Create: adapters/maxhinal13/test/relatte_v0.test.ts
- Modify: .gitignore

**Interfaces:**
- Consumes: reLATTE v0 canonicalization/signature semantics at commit 5d96af53a730b0ce3111e8551e62030596815069.
- Produces:
  - type NodeId = mx13:01-witness through mx13:13-misspeldd-maxhinal as the exact 13-value union.
  - type LocalDisposition = ADMIT | REFUSE | RETURN | FORWARD | HOLD | EXPIRE.
  - interface CrossingEnvelopeV0 matching reLATTE crossing-envelope/v0.
  - interface ReceiptV0 matching reLATTE receipt/v0.
  - sealCrossingEnvelope(draft: CrossingDraftV0, key: CryptoKeyPairLike): Promise<CrossingEnvelopeV0>.
  - verifyCrossingEnvelope(value: unknown): Promise<boolean>.
  - sealReceipt(draft: ReceiptDraftV0, key: CryptoKeyPairLike): Promise<ReceiptV0>.
  - verifyReceipt(value: unknown): Promise<boolean>.
  - publicKeyFingerprint(jwk: JsonWebKey): string.

- [ ] **Step 1: Write the failing compatibility tests**

In relatte_v0.test.ts assert that the pinned SB-001 crossing and release receipt verify, that changing WAIT/authority/payload-address material invalidates signatures, and that a newly sealed crossing verifies and contains no private d material.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="reLATTE v0"

Expected: FAIL because relatte_v0.ts/model.ts do not exist.

- [ ] **Step 3: Add exact runtime pins**

package.json pins json-canonicalize to 3.0.1 and declares Node >=22. deno.json maps json-canonicalize to npm:json-canonicalize@3.0.1 and postgres to npm:postgres@3.4.9. No floating dependency versions.

- [ ] **Step 4: Implement the minimal compatibility module**

Implement the exported signatures above using WebCrypto P-256 and the exact domain strings/current canonical field sets from the pinned reLATTE source. Put an ownership comment at the top stating that this is a compatibility adapter and reLATTE remains canonical protocol owner.

- [ ] **Step 5: Run compatibility tests**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="reLATTE v0"

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: feat(maxhinal13): pin relatte v0 compatibility

### Task 2: Bind exact payload bytes and transport limits

**Files:**
- Create: adapters/maxhinal13/src/payload.ts
- Create: adapters/maxhinal13/fixtures/mx13/invitation-manifest.json
- Create: adapters/maxhinal13/test/payload.test.ts

**Interfaces:**
- Consumes: CrossingEnvelopeV0 from Task 1.
- Produces:
  - const MAX_PAYLOAD_BYTES = 1048576.
  - const MAX_CLOCK_SKEW_SECONDS = 300.
  - decodePayloadB64(value: string): Uint8Array.
  - sha256Address(bytes: Uint8Array): Promise<string>.
  - verifyPayload(envelope: CrossingEnvelopeV0, payloadB64: string): Promise<{bytes: Uint8Array; address: string}>.
  - assertFreshTimestamp(createdAt: string, now: Date): void.

- [ ] **Step 1: Write failing payload tests**

Assert the exact INVITATION manifest values: 670478 bytes, sha256:af82b9a3b2d5eeb1ce3d58038b3415ca62f0815bd6f0a04662ec8cf5b773d171, observed name 1000018575.png, media type image/jpeg, filename_media_type_mismatch=true. Add tests for hash mismatch, 1,048,577-byte rejection, malformed base64, and timestamps +/-301 seconds.

- [ ] **Step 2: Run and confirm failure**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="payload"

Expected: FAIL because payload.ts is missing.

- [ ] **Step 3: Implement payload verification**

Reject malformed/oversized payload before hashing into accepted state. Verify exactly one payload_ref whose address and byte_length match the decoded bytes. Do not normalize filename or media type.

- [ ] **Step 4: Run payload tests**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="payload"

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: feat(maxhinal13): bind exact payload transport

### Task 3: Encode all thirteen constitutions as restrictions

**Files:**
- Create: adapters/maxhinal13/src/nodes.ts
- Create: adapters/maxhinal13/src/constitutions.ts
- Create: adapters/maxhinal13/test/constitutions.test.ts

**Interfaces:**
- Consumes: NodeId, LocalDisposition, CrossingEnvelopeV0.
- Produces:
  - interface ConstitutionContext { nodeId; envelope; payloadAddress; observedFilename; detectedMediaType; priorReceiptIds; routeIndex }.
  - interface ConstitutionResult { disposition: LocalDisposition; semanticEffect: string; descendantSpecs: DescendantSpec[]; notes: string[]; routeForwardAllowed: boolean }.
  - evaluateConstitution(ctx: ConstitutionContext): ConstitutionResult.
  - nodeDefinition(nodeId: NodeId): NodeDefinition.

- [ ] **Step 1: Write the table-driven failing constitution test**

Pin all thirteen node names, hosts, and laws. For the MX13-001 INVITATION path pin these local results:

01 THE WITNESS -> FORWARD, semantic effect witness-only.
02 THE GATE -> ADMIT only when exact payload address and prior ancestry are present.
03 DEAD LETTER -> FORWARD with no-failure-observed evidence on a successful crossing.
04 COMPOST MONK -> ADMIT plus one lineage-bound compost descendant.
05 MIRRORGØAT -> RETURN plus one reflection descendant while routeForwardAllowed remains true.
06 THE CONTRARY -> ADMIT plus a contrary local valuation descendant.
07 LANTERN EATER -> ADMIT plus a reduced-context descendant that lists omitted non-authoritative metadata.
08 PIRATE CLERK -> REFUSE because MX13-001 is not marked abandoned/salvage-eligible; routeForwardAllowed remains true.
09 CHOIR-OF-ONE -> ADMIT plus one composition descendant retaining all prior receipt IDs.
10 BONE ORCHARD -> ADMIT plus descendant-index event; no retroactive parent mutation.
11 ORACL -> FORWARD plus advisory descendant with authority=false.
12 FERRYMAN -> FORWARD and never ADMIT.
13 MISSPELDD MAXHINAL -> ADMIT while preserving the .png / image/jpeg mismatch and emitting no silent correction.

Also assert every specialization law is a restriction and no result grants another node authority.

- [ ] **Step 2: Run and confirm failure**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="constitution"

Expected: FAIL because nodes.ts/constitutions.ts are missing.

- [ ] **Step 3: Implement node registry and pure evaluator**

Use one explicit switch/table keyed by the 13 NodeId values. Keep transport continuation separate from local disposition; routeForwardAllowed does not convert REFUSE/RETURN into ADMIT.

- [ ] **Step 4: Run constitution tests**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="constitution"

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: feat(maxhinal13): encode thirteen constitutions

### Task 4: Create host-private Postgres custody and identity schemas

**Files:**
- Create: adapters/maxhinal13/sql/witness/001_maxhinal13.sql
- Create: adapters/maxhinal13/sql/pantry-gate/001_maxhinal13.sql
- Create: adapters/maxhinal13/sql/verify.sql
- Create: adapters/maxhinal13/scripts/generate-identities.ts
- Create: adapters/maxhinal13/scripts/build-bootstrap-sql.ts
- Create: adapters/maxhinal13/test/store-contract.test.ts
- Create: adapters/maxhinal13/src/store.ts

**Interfaces:**
- Consumes: NodeId and NodeDefinition.
- Produces:
  - private schema mx13_host on each project.
  - private per-node schemas mx13_n01 through mx13_n13 on their assigned hosts only.
  - mx13_host.node_keys(node_id, key_version, public_jwk, private_jwk, fingerprint, created_at).
  - mx13_host.peers(node_id, host_id, public_jwk, fingerprint, ingress_url, active).
  - mx13_host.operator_capabilities(id, token_hash, active, created_at) with no grants to anon/authenticated.
  - per-node payloads(address primary key, bytes bytea, byte_length, observed_name, detected_media_type, received_at).
  - per-node inbox(crossing_id primary key, source_node_id, state, hold_receipt_id, disposition_receipt_id, received_at, updated_at).
  - per-node outbox(crossing_id primary key, destination_node_id, envelope jsonb, payload_address, state, attempts, last_error, created_at, updated_at).
  - per-node receipts(receipt_id primary key, kind, body jsonb, created_at).
  - per-node constitution_events(event_id uuid primary key, crossing_id, class, body jsonb, created_at).
  - per-node ancestry(child_ref, parent_ref, relation, primary key(child_ref,parent_ref,relation)).
  - MeshStore methods loadNodeKey, loadPeer, beginHold, getInbound, persistDisposition, putPayload, getPayload, enqueueOutbox, claimOutbox, recordAttempt, completeOutbox, readStatus.

- [ ] **Step 1: Write the failing store contract tests**

Use an in-memory FakeMeshStore implementing the MeshStore interface. Pin the key behavior that beginHold is idempotent, a terminal disposition cannot be overwritten, payload address is unique, and a failed outbox attempt remains pending with attempts incremented.

- [ ] **Step 2: Run and confirm failure**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="store contract"

Expected: FAIL because store.ts is missing.

- [ ] **Step 3: Write host-specific DDL**

Both migrations create mx13_host plus only that host's assigned node schemas. Revoke all schema/table/function access from PUBLIC, anon, and authenticated. No object is created in existing WITNESS public tables or pantry schemas.

- [ ] **Step 4: Implement identity generation tooling**

generate-identities.ts generates exactly 13 extractable P-256 node keypairs plus one random 256-bit operator capability per host, writes only under adapters/maxhinal13/.local/, and prints public fingerprints. .gitignore must exclude that directory. The raw operator capabilities never enter SQL; build-bootstrap-sql.ts emits only their SHA-256 hashes.

build-bootstrap-sql.ts accepts the generated local JSON and emits two operator-reviewed INSERT scripts. It must refuse if any duplicate public-key fingerprint exists.

- [ ] **Step 5: Implement PostgresMeshStore**

Use postgres 3.4.9 against SUPABASE_DB_URL with max:1 and short idle timeout. Every node table reference is selected from the closed NodeId -> schema map; never interpolate arbitrary caller-controlled schema names.

- [ ] **Step 6: Run local tests**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="store contract"

Expected: PASS.

- [ ] **Step 7: Deploy DDL to both projects and verify**

Apply the reviewed host-specific migration to WITNESS and pantry-gate. Insert generated host/node identity material through an operator-only SQL execution; do not commit private JWKs or raw capabilities.

Run verify.sql on both hosts and assert:
- 7 node schemas on WITNESS, 6 on pantry-gate;
- 13 distinct public fingerprints across the combined exported public registries;
- zero grants to anon/authenticated on mx13_host or node-private schemas;
- zero changes to pre-existing WITNESS public tables and pantry application schemas.

- [ ] **Step 8: Run Supabase security advisors**

Expected: no new security ERROR/WARN findings attributable to MAXHINAL-13. Existing unrelated findings are documented rather than silently claimed as fixed.

- [ ] **Step 9: Commit**

Commit message: feat(maxhinal13): add private host custody schemas

### Task 5: Make ingress prove HOLD before meaning

**Files:**
- Create: adapters/maxhinal13/src/ingress.ts
- Create: adapters/maxhinal13/functions/mx13-ingress/index.ts
- Create: adapters/maxhinal13/test/ingress.test.ts

**Interfaces:**
- Consumes: verifyCrossingEnvelope, verifyPayload, assertFreshTimestamp, MeshStore, evaluateConstitution, sealReceipt.
- Produces:
  - interface IngressRequestV0 { schema: "maxhinal13.ingress/v0"; destination_node_id: NodeId; envelope: CrossingEnvelopeV0; payload_b64: string }.
  - interface IngressResponseV0 { crossing_id; hold_receipt: ReceiptV0; disposition_receipt?: ReceiptV0; state: "HOLD" | "RESOLVED"; replayed: boolean }.
  - handleIngress(req: IngressRequestV0, deps: IngressDeps): Promise<IngressResponseV0>.

- [ ] **Step 1: Write failing ingress tests**

Cover valid crossing, unknown source, wrong destination, invalid signature, hash mismatch, oversized payload, stale timestamp, duplicate delivery after resolution, and the Review Focus crash case.

For crash recovery, inject a constitution evaluator that throws after beginHold. Assert the store contains exactly one HOLD receipt and no disposition receipt. Retry with the normal evaluator and assert the same hold_receipt_id is reused.

- [ ] **Step 2: Run and confirm failure**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="ingress"

Expected: FAIL because ingress.ts is missing.

- [ ] **Step 3: Implement two-phase ingress**

Phase A verifies request, writes exact payload bytes, inbox row, and signed HOLD receipt in one durable transaction. Commit before constitution evaluation.

Phase B evaluates only the addressed node constitution, signs the node-local disposition receipt, records descendants/ancestry, and marks inbox RESOLVED. If Phase B fails, leave HOLD intact.

- [ ] **Step 4: Wire the Edge Function**

mx13-ingress uses verify_jwt=false. It creates PostgresMeshStore from SUPABASE_DB_URL, parses JSON with a hard request-size cap, calls handleIngress, and returns bounded JSON. It never accepts a project secret/API key from the caller.

- [ ] **Step 5: Run ingress tests**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="ingress"

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: feat(maxhinal13): enforce durable hold at ingress

### Task 6: Add signed route forwarding without collapsing disposition into transport

**Files:**
- Create: adapters/maxhinal13/src/worker.ts
- Create: adapters/maxhinal13/functions/mx13-worker/index.ts
- Create: adapters/maxhinal13/test/worker.test.ts

**Interfaces:**
- Consumes: MeshStore, sealCrossingEnvelope, verifyReceipt, peer registry.
- Produces:
  - interface RouteHop { node_id: NodeId; next_node_id: NodeId | null; index: number }.
  - interface WorkerCommandV0 with actions seed and pump.
  - createNextCrossing(sourceNodeId, destinationNodeId, payload, parentReceiptIds, route): Promise<CrossingEnvelopeV0>.
  - pumpOne(nodeId: NodeId, deps: WorkerDeps): Promise<WorkerResult>.
  - verifyOperatorCapability(presented: string, storedHash: string): Promise<boolean>.

- [ ] **Step 1: Write failing worker tests**

Pin that:
- seed accepts only INVITATION bytes matching the manifest in MX13-001 mode and creates a signed 01 -> 01 HTTP loopback crossing so node 01 also earns RECEIVE -> HOLD -> constitution before the alternating route begins;
- each next crossing is signed by the current node, not the physical host;
- REFUSE at node 08 and RETURN at node 05 can still create a separately signed route-forward crossing without changing their local disposition receipts;
- same-host destination uses the same configured HTTP ingress URL, not direct store writes;
- a failed fetch increments attempts and leaves the original signed outbox item pending;
- retry sends the identical crossing_id/payload bytes and does not rewrite the failed attempt;
- a returned receipt with the wrong destination key is rejected.

- [ ] **Step 2: Run and confirm failure**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="worker"

Expected: FAIL because worker.ts is missing.

- [ ] **Step 3: Implement seed/pump core**

The worker loads the source node private key only from its local private store, creates the next signed envelope, stores it before network I/O, then POSTs to the peer ingress_url.

Use at most 3 automatic attempts per explicit pump command. Honor Retry-After on HTTP 429; never recurse indefinitely.

- [ ] **Step 4: Wire mx13-worker**

mx13-worker uses verify_jwt=false but rejects every request without the 256-bit host operator capability. Compare only a SHA-256 token hash; never log the presented token.

The function only exposes seed/pump/status-safe command results. It cannot mutate constitutions or peer keys.

- [ ] **Step 5: Run worker tests**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="worker"

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: feat(maxhinal13): add signed outbox worker

### Task 7: Prove one real crossing in each physical direction

**Files:**
- Create: adapters/maxhinal13/scripts/mx13-route.ts
- Create: adapters/maxhinal13/test/route.test.ts
- Create: adapters/maxhinal13/evidence/.gitkeep
- Create: .github/workflows/maxhinal13.yml

**Interfaces:**
- Consumes: deployed mx13-ingress/mx13-worker on both projects and the public peer registry.
- Produces:
  - runTwoHostProbe(payloadPath: string): Promise<TwoHostProbeEvidence>.
  - sanitized evidence JSON containing crossing/receipt IDs, public-key fingerprints, payload hash, project role names, timestamps, and claim limits; never private JWKs, DB URLs, operator capabilities, or project secret keys.

- [ ] **Step 1: Write the route harness test**

With mocked HTTP peers assert the route 01 -> 02 -> 01 produces two distinct crossings, two mandatory HOLD receipts, destination-local receipts, exact payload hash continuity, and no direct store access to the remote node.

- [ ] **Step 2: Run and confirm failure**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="route"

Expected: FAIL because mx13-route.ts is missing.

- [ ] **Step 3: Implement the two-host probe mode**

The script accepts --payload-path and refuses unless bytes match the INVITATION manifest when invoked with --specimen mx13-001. The full specimen begins by invoking node 01 through the ordinary HTTP ingress as a signed 01 -> 01 loopback; seed is not a privileged direct database admission.

- [ ] **Step 4: Add CI for pure adapter tests**

maxhinal13.yml installs exact package pins, runs the Node 22 test suite, type-checks the function modules, and verifies that no file under adapters/maxhinal13/.local is tracked.

- [ ] **Step 5: Deploy the two Edge Functions to both projects**

Deploy identical source to WITNESS and pantry-gate, with project-local database URLs supplied by the platform. Confirm both functions report their own host_id and only their assigned node IDs.

- [ ] **Step 6: Execute WITNESS -> pantry-gate and pantry-gate -> WITNESS**

Use nodes 01 and 02. Confirm both physical project boundaries are crossed, both payload copies hash to the original INVITATION address, and each destination committed HOLD before its local disposition.

- [ ] **Step 7: Save sanitized evidence**

Create adapters/maxhinal13/evidence/mx13-two-host-001.json. It must state:
- two-host live crossing proven;
- thirteen-node route not yet proven;
- physical host failure not yet tested;
- Realtime not required.

- [ ] **Step 8: Commit**

Commit message: test(maxhinal13): prove bidirectional two-host crossing

### Task 8: Execute MX13-001 through all thirteen constitutions

**Files:**
- Modify: adapters/maxhinal13/scripts/mx13-route.ts
- Modify: adapters/maxhinal13/test/route.test.ts
- Create after execution: adapters/maxhinal13/evidence/mx13-001.json

**Interfaces:**
- Consumes: all 13 registered node identities, ingress/worker functions, exact INVITATION bytes.
- Produces: runMx13001(payloadPath: string): Promise<Mx13001Evidence>.

- [ ] **Step 1: Extend the failing route test**

Pin the exact route:
01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12 -> 13.

Assert 13 ingress deliveries total: one signed 01 -> 01 loopback seed plus 12 inter-node deliveries; 12 physical host-boundary changes; 13 HOLD receipts; 13 constitution results; unchanged source SHA at every node; 13 distinct node signer fingerprints; and the Task 3 expected local results.

- [ ] **Step 2: Run and confirm failure**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="MX13-001"

Expected: FAIL until route orchestration/evidence aggregation is implemented.

- [ ] **Step 3: Implement full-route orchestration**

Begin with the signed 01 -> 01 loopback seed so node 01 uses the same ingress/HOLD path as every other node.

At each node:
- resolve any existing HOLD;
- persist the local disposition;
- create the next crossing as a new signed act whose parents include the local disposition receipt;
- carry the identical source payload bytes/address onward.

Do not require a node to ADMIT before it can forward evidence.

- [ ] **Step 4: Run local route tests**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="MX13-001"

Expected: PASS.

- [ ] **Step 5: Execute the live 13-node route**

Supply the external original INVITATION bytes. Run one pump per hop and stop immediately on any signature, payload, ancestry, HOLD, or receipt verification failure.

- [ ] **Step 6: Save sanitized MX13-001 evidence**

mx13-001.json includes:
- source hash/size/media mismatch;
- every crossing_id and node receipt_id;
- every public-key fingerprint;
- HOLD-before-disposition ordering;
- node-local result summary;
- route parent chain;
- physical host at each hop;
- exact-byte hash observed at each node;
- explicit negative claims for physical isolation and universal SupaBardo extraction.

- [ ] **Step 7: Commit**

Commit message: test(maxhinal13): execute one particular through thirteen constitutions

### Task 9: Attack replay, authority collapse, and shared host failure

**Files:**
- Create: adapters/maxhinal13/test/adversarial.test.ts
- Modify: adapters/maxhinal13/scripts/verify-evidence.ts
- Create after execution: adapters/maxhinal13/evidence/mx13-001-adversarial.json

**Interfaces:**
- Consumes: live MX13-001 state and pure ingress/worker interfaces.
- Produces: verifyEvidence(path: string): Promise<VerificationReport> and a bounded adversarial evidence manifest.

- [ ] **Step 1: Write failing adversarial tests**

Exercise all 20 spec failures plus the five Review Focus conditions. Each test names the expected refusal code or durable state.

Required machine-visible codes include UNKNOWN_SOURCE, UNKNOWN_DESTINATION, INVALID_SIGNATURE, PAYLOAD_ADDRESS_MISMATCH, PAYLOAD_TOO_LARGE, STALE_ENVELOPE, DUPLICATE_REPLAY, ROUTER_CANNOT_ADMIT, NODE_KEY_SCOPE_VIOLATION, ORACL_AUTHORITY_VIOLATION, FERRYMAN_CONSTITUTION_VIOLATION, PIRATE_OWNERSHIP_VIOLATION, COMPOST_LINEAGE_REQUIRED, SILENT_CORRECTION_VIOLATION.

- [ ] **Step 2: Run and confirm failure**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="adversarial"

Expected: FAIL until all refusal paths are explicit.

- [ ] **Step 3: Implement missing refusal codes only**

Do not broaden features while fixing adversarial failures. Every rejection must occur at the narrowest owning layer.

- [ ] **Step 4: Run the complete local suite**

Run: cd adapters/maxhinal13 && npm test

Expected: all tests PASS.

- [ ] **Step 5: Run one live destination-outage experiment**

Temporarily target an intentionally unreachable ingress URL for one bounded outbox item rather than pausing/deleting either production project. Prove the sender retains a pending signed outbox item and exact payload. Restore the correct public URL and explicitly pump once; prove success creates a later transport attempt without rewriting the failed attempt.

This earns transport-failure evidence, not real host-death evidence.

- [ ] **Step 6: Preserve the stronger host-failure claim as unearned unless a host is actually made unavailable**

Do not pause WITNESS or pantry-gate merely to satisfy the test without a separate explicit user approval. Evidence must say host failure NOT RUN unless such approval is later given.

- [ ] **Step 7: Run Supabase advisors on both projects**

Run security and performance advisors after the live pass. Fix MAXHINAL-caused findings before completion; list unrelated pre-existing findings separately.

- [ ] **Step 8: Verify sanitized evidence**

verify-evidence.ts refuses:
- missing HOLD/disposition ordering;
- duplicate signer fingerprints;
- altered source hash;
- leaked private_jwk/dB URL/operator token fields;
- a claimed physical-isolation/host-failure/SupaBardo-extraction result not supported by evidence.

- [ ] **Step 9: Commit**

Commit message: test(maxhinal13): adversarially verify constellation boundaries

### Task 10: Add read-only operator status and close the proof boundary

**Files:**
- Create: adapters/maxhinal13/src/status.ts
- Create: adapters/maxhinal13/functions/mx13-status/index.ts
- Create: adapters/maxhinal13/test/status.test.ts
- Modify: adapters/maxhinal13/README.md
- Modify: README.md

**Interfaces:**
- Consumes: MeshStore.readStatus and public fingerprints only.
- Produces:
  - readHostStatus(store: MeshStore): Promise<HostStatusV0>.
  - mx13-status GET response containing host_id, local node IDs, public fingerprints, pending outbox counts, unresolved HOLD counts, recent receipt IDs, failed transport count, latest durable crossing timestamps, and forbidden-bypass observation state.

- [ ] **Step 1: Write failing status tests**

Assert the status surface never returns private_jwk, raw operator capability, SUPABASE_DB_URL, project secret keys, or full payload bytes. Assert unresolved HOLD is reported as a count plus receipt IDs, not silently resolved.

- [ ] **Step 2: Run and confirm failure**

Run: cd adapters/maxhinal13 && npm test -- --test-name-pattern="status"

Expected: FAIL because status.ts/function do not exist.

- [ ] **Step 3: Implement read-only status**

mx13-status may use verify_jwt=false because it returns only explicitly public/operational fields. It performs no writes and no remote calls.

- [ ] **Step 4: Run the complete suite and CI**

Run: cd adapters/maxhinal13 && npm test

Expected: PASS.

Confirm maxhinal13.yml passes from a clean checkout.

- [ ] **Step 5: Update repository documentation**

README additions must keep these final claim boundaries visible:

~~~
SUPABASE HOST != WORLD
LOGICAL SOVEREIGNTY != PHYSICAL ISOLATION
DELIVERY != ADMISSION
LOCAL DISPOSITION != ONWARD TRANSPORT
REALTIME != HISTORY
CANDIDATE SECOND CROSSING != AUTOMATIC EXTRACTION
~~~

Link the design, plan, two-host evidence, MX13-001 evidence, and adversarial evidence.

- [ ] **Step 6: Final proof review**

Compare executed evidence against the original SupaBardo promotion ladder. Report whether the second meaningfully different live crossing gate appears satisfied, but do not create/extract a standalone SupaBardo repository in this plan.

- [ ] **Step 7: Commit**

Commit message: docs(maxhinal13): close bounded constellation proof
