# MAXHINAL-13 — Misfit Sovereign Constellation Design

## Status

Accepted architecture design. Documentation only; implementation remains gated pending review of this written spec and a separate implementation plan.

## One-line law

> **COMMON GRAMMAR != COMMON MEANING.**

MAXHINAL-13 turns the two presently available hosted Supabase projects into two physical network worlds carrying thirteen logically sovereign, deliberately incompatible nodes.

The experiment is not “make thirteen databases.”

It is:

> **How much real plurality can two physical machines carry without collapsing thirteen local constitutions into one hidden authority?**

## Context

SupaBardo already established the architectural boundary for unresolved crossings:

> **SupaBardo owns unresolved existence between release and local constitution.**

The first bounded live specimen, SB-001, demonstrated one released particular moving through a genuinely unresolved field, receiving an independent destination-local disposition, and remaining reconstructible after the transient membrane was destroyed.

Current external proof pin:

~~~
the-static-collective/reLATTE
5d96af53a730b0ce3111e8551e62030596815069
~~~

STATIC OS has subsequently pinned that destructible boundary and begun carrying exact-byte particulars through a mandatory HOLD before local admission.

MAXHINAL-13 asks the next question:

> Can multiple worlds share one crossing grammar while preserving materially different local meanings, restrictions, failure behaviors, and memory policies?

## Decision

Build thirteen logical nodes across exactly two existing hosted Supabase projects:

~~~
WITNESS
  01 THE WITNESS
  03 DEAD LETTER
  05 MIRRORGØAT
  07 LANTERN EATER
  09 CHOIR-OF-ONE
  11 ORACL
  13 MISSPELDD MAXHINAL

pantry-gate
  02 THE GATE
  04 COMPOST MONK
  06 THE CONTRARY
  08 PIRATE CLERK
  10 BONE ORCHARD
  12 FERRYMAN
~~~

The odd/even split is physical placement only. It carries no semantic rank.

~~~
SUPABASE HOST != WORLD
WORLD != DATABASE
SHARED HOST != SHARED AUTHORITY
SHARED TRANSPORT != SHARED MEANING
COMMON GRAMMAR != COMMON CONSTITUTION
~~~

## Why thirteen logical worlds instead of thirteen fake databases

The Free plan currently permits only two active hosted projects for this organization. That constraint is useful rather than merely inconvenient.

MAXHINAL-13 therefore treats physical hosting and logical sovereignty as separate questions.

A logical node earns sovereignty from:

- its own cryptographic identity;
- its own local constitution;
- its own inbox and outbox history;
- its own HOLD and disposition state;
- its own receipts;
- its own ancestry;
- its own refusal conditions;
- its own memory policy;
- its inability to silently exercise another node's authority.

A separate database would provide a stronger physical fault boundary. MAXHINAL-13 does not pretend otherwise.

The first implementation must preserve this claim limit:

~~~
LOGICAL SOVEREIGNTY != PHYSICAL ISOLATION
~~~

## Architecture

~~~
                    signed reLATTE envelope
                             |
                             v
                  +---------------------+
                  | network ingress     |
                  | verify + route only |
                  +----------+----------+
                             |
                    destination node_id
                             |
                             v
               +--------------------------+
               | NODE-LOCAL CONSTITUTION  |
               |                          |
               | RECEIVE                  |
               |   v                      |
               | HOLD                     |
               |   v                      |
               | local interpretation     |
               |   v                      |
               | ADMIT / REFUSE / RETURN  |
               |   v                      |
               | local consequence        |
               |   v                      |
               | signed receipt           |
               +------------+-------------+
                            |
                            v
                  durable local ancestry
~~~

No node may infer another node's disposition.

No physical host may treat colocated nodes as one world.

## Shared transport kernel

The two physical projects may share one minimal transport implementation.

The shared kernel may:

- receive HTTP requests;
- parse a bounded crossing envelope;
- verify the reLATTE crossing signature;
- enforce payload size and timestamp bounds;
- reject unknown source identities;
- reject unknown destination node IDs;
- enforce replay/idempotency rules;
- record transport-local receipt facts;
- route the crossing to the addressed node constitution;
- emit the destination's signed receipt;
- retry bounded outbound delivery;
- expose operational health.

The shared kernel may not:

- select ADMIT;
- synthesize local meaning;
- rewrite node constitutions;
- merge node histories;
- infer consent;
- assign ownership;
- treat successful HTTP delivery as admission;
- hide failed or duplicate crossings.

~~~
ROUTER != JUDGE
DELIVERY != ADMISSION
VALID SIGNATURE != AUTHORIZED SEMANTIC EFFECT
~~~

## Network authentication

Cross-project calls must not share Supabase secret keys.

Each logical node receives a distinct P-256 signing identity.

Peer records contain public verification material only.

The receiving Edge Function verifies the signed crossing and source allowlist before any node-local processing occurs.

A destination project may use its own server-side Supabase secret to write to its own private database state. That secret never crosses the project boundary.

The ingress function may therefore disable platform JWT verification only if the function itself performs the required custom cryptographic authentication and replay controls.

~~~
NO SHARED SERVICE ROLE
PRIVATE KEY STAYS LOCAL
PUBLIC KEY != AUTHORITY TO ADMIT
~~~

## Same-host traffic must not cheat

Two logical nodes colocated on WITNESS or pantry-gate must traverse the same crossing contract used by cross-project traffic.

A sender may not directly insert into another node's inbox table.

The implementation may optimize transport later, but the observable contract must remain:

~~~
sign
  -> transport
  -> verify
  -> route
  -> HOLD
  -> node-local disposition
  -> receipt
~~~

A same-host shortcut that bypasses signature verification or local HOLD fails the experiment.

## Storage posture

Each logical node receives its own private namespace on its physical host.

The expected local shape is conceptually:

~~~
node identity
peer/public-key registry
inbox
outbox
hold queue
local receipts
constitution events
ancestry / replay state
~~~

Implementation may use one private schema per node plus a tiny host-level registry.

Private schemas are preferred over the exposed public schema.

Any exposed table must have RLS enabled with explicit policies. Authorization must not rely on authenticated alone.

The schema boundary is an inspectable organizational boundary, not proof of physical isolation.

## The thirteen constitutions

### 01 — THE WITNESS

Host: WITNESS

Purpose: preserve attributable occurrence without deciding consequence.

Hard restriction:

~~~
WITNESS != JUDGE
~~~

Behavior:

- accepts valid attributable crossings into HOLD;
- records what arrived and what was observed;
- may produce witness receipts;
- never selects downstream ADMIT on behalf of another world;
- contradiction is preserved rather than resolved.

### 02 — THE GATE

Host: pantry-gate

Purpose: require unusually explicit ancestry before local admission.

Hard restriction:

~~~
PRESENCE != PEDIGREE
~~~

Behavior:

- defaults to HOLD;
- demands declared parentage and exact payload address;
- refuses ancestry gaps rather than guessing;
- local admission is rare and explicit.

### 03 — DEAD LETTER

Host: WITNESS

Purpose: treat failed, refused, expired, malformed, or undeliverable crossings as first-class evidence.

Hard restriction:

~~~
FAILURE != ABSENCE
~~~

Behavior:

- prefers terminal failures over successful payloads;
- receives REFUSE / RETURN / expiry evidence;
- never rewrites failure into success;
- may index recurring failure shapes without claiming a universal cause.

### 04 — COMPOST MONK

Host: pantry-gate

Purpose: derive new artifacts from admitted material while retaining ancestry.

Hard restriction:

~~~
DERIVATION != ORIGINAL
~~~

Behavior:

- does not claim transformed output is the source particular;
- emits descendants with parent references;
- may deliberately discard semantic form while preserving provenance;
- refuses lineage-free mutation.

### 05 — MIRRORGØAT

Host: WITNESS

Purpose: return a crossing through a distinct local frame.

Hard restriction:

~~~
RETURN != IDENTITY
~~~

Behavior:

- receives, HOLDs, and emits a local reflection;
- preserves the incoming particular separately from the returned descendant;
- never claims the reflection is byte-identical unless it actually is.

### 06 — THE CONTRARY

Host: pantry-gate

Purpose: maintain lawful disagreement.

Hard restriction:

~~~
AGREEMENT != SUCCESS
~~~

Behavior:

- may retain a contrary local valuation after receiving valid shared evidence;
- does not falsify evidence to disagree;
- signs its own local conclusion;
- disagreement survives network convergence.

### 07 — LANTERN EATER

Host: WITNESS

Purpose: test whether a particular remains intelligible after explanatory scaffolding is stripped away.

Hard restriction:

~~~
OMITTED EXPLANATION != CHANGED PARTICULAR
~~~

Behavior:

- removes non-authoritative presentation metadata in a bounded derived view;
- never removes bytes or fields that define the addressed source particular;
- records exactly what was omitted;
- refuses to call reduced context “the whole thing.”

### 08 — PIRATE CLERK

Host: pantry-gate

Purpose: scavenge abandoned or returned crossings without manufacturing title.

Hard restriction:

~~~
CUSTODY != OWNERSHIP
~~~

Behavior:

- may receive explicitly abandoned, returned, or salvage-eligible material;
- preserves prior ownership/custody claims as separate evidence;
- cannot convert possession into authority;
- can offer a new crossing only from its own bounded custody role.

### 09 — CHOIR-OF-ONE

Host: WITNESS

Purpose: compose plural witnesses into one descendant without erasing the choir.

Hard restriction:

~~~
COMPOSITION != CONSENSUS
~~~

Behavior:

- accepts multiple parent crossings;
- emits a composed descendant;
- retains every contributing lineage;
- no majority vote is implied;
- unresolved contradiction may remain audible in the descendant.

### 10 — BONE ORCHARD

Host: pantry-gate

Purpose: remember what a crossing later grew into.

Hard restriction:

~~~
DESCENDANT != RETROACTIVE CAUSE
~~~

Behavior:

- maintains descendant references and later consequences;
- permits reverse navigation from descendant to ancestors;
- does not rewrite ancestor meaning using future outcomes;
- preserves dead branches as history.

### 11 — ORACL

Host: WITNESS

Purpose: generate prediction, interpretation, or recommendation without admission authority.

Hard restriction:

~~~
ORACLE != AUTHORITY
~~~

Behavior:

- may emit forecasts or interpretations as descendants;
- every output is explicitly advisory;
- cannot ADMIT its own recommendation into another node;
- prediction accuracy does not increase its authority class.

### 12 — FERRYMAN

Host: pantry-gate

Purpose: specialize entirely in unresolved transit.

Hard restriction:

~~~
FERRYMAN != DESTINATION
~~~

Behavior:

- may RECEIVE, HOLD, forward, return, expire, and witness transit;
- may never locally ADMIT the carried particular as constituted destination meaning;
- its durable outputs are transit receipts, not ownership or canon.

### 13 — MISSPELDD MAXHINAL

Host: WITNESS

Purpose: preserve malformed-but-intelligible particulars without laundering their strangeness away.

Hard restriction:

~~~
CORRECTION != FIDELITY
~~~

Behavior:

- accepts bounded syntactic irregularity when identity and safety constraints still verify;
- records the malformed surface as received;
- may emit a corrected descendant only as a distinct particular;
- typo, glitch, dialect, compression artifact, or unconventional label is not silently normalized.

## Node specialization is a restriction

The weirdness must not become a collection of extra privileges.

A node's specialty primarily constrains what it is allowed to claim.

Examples:

- ORACL may predict, but cannot admit.
- FERRYMAN may transport, but cannot constitute.
- WITNESS may observe, but cannot judge.
- PIRATE CLERK may hold salvage, but cannot manufacture ownership.
- COMPOST MONK may transform, but cannot impersonate the source.
- THE CONTRARY may disagree, but cannot alter the evidence.
- MISSPELDD MAXHINAL may preserve malformed form, but cannot call silent correction fidelity.

~~~
SPECIALIZATION = BOUNDED POWER
SPECIALIZATION != SUPERUSER
~~~

## Crossing lifecycle

Every normal crossing uses the same outer lifecycle:

~~~
SOURCE
  v
sign exact crossing
  v
OUTBOX
  v
network transport
  v
RECEIVE
  v
verify source + payload address + destination
  v
HOLD
  v
node-local constitution
  v
ADMIT / REFUSE / RETURN / FORWARD / EXPIRE
  v
local consequence, if any
  v
signed receipt
  v
sender records returned receipt
~~~

A node-specific constitution may add stricter gates or derived descendants, but it cannot delete the common HOLD boundary.

## Realtime posture

Realtime may make the constellation visibly alive.

It may carry:

- node heartbeat;
- live crossing appearance;
- HOLD state transitions;
- receipt appearance;
- peer presence;
- operator visualization.

Realtime is not historical authority.

A missed WebSocket message must not destroy reconstructibility.

~~~
REALTIME != HISTORY
LIVE PULSE != DURABLE RECEIPT
~~~

## Bardo posture

A crossing may exist in a transient unresolved field after RELEASE and before destination constitution.

The field may be represented by bounded database state, Edge Function execution, queue state, or other temporary coordination material.

That transient state is allowed to die.

The durable requirement is that enough attributable material escapes to reconstruct the crossing and its local outcomes.

~~~
BARDO MAY DIE
HISTORY MUST NOT REQUIRE IMMORTAL BARDO
~~~

MAXHINAL-13 does not create a permanent SupaBardo database-of-truth.

## Failure model

The network must preserve failure as evidence.

Required failure cases include:

1. unknown source node;
2. unknown destination node;
3. invalid crossing signature;
4. exact payload address mismatch;
5. duplicate crossing delivery;
6. stale or replayed crossing outside its allowed window;
7. same-host direct-write bypass attempt;
8. cross-host delivery timeout;
9. destination host unavailable;
10. destination REFUSE;
11. destination RETURN;
12. destination HOLD that remains unresolved;
13. receipt lost in transport and safely replayed;
14. router attempts to manufacture ADMIT;
15. node constitution attempts to exercise another node's private key;
16. ORACL attempts to promote advice into admission;
17. FERRYMAN attempts local constitution;
18. PIRATE CLERK attempts ownership synthesis;
19. COMPOST MONK emits lineage-free derivative;
20. MISSPELDD MAXHINAL silently “fixes” the incoming particular.

No failure may be rewritten into a successful crossing merely because retry later succeeds.

## Fault-domain experiments

Because thirteen logical nodes share two physical hosts, the design must explicitly test shared-fate events.

### Host failure

If WITNESS becomes unavailable, all seven odd nodes become physically unreachable together.

If pantry-gate becomes unavailable, all six even nodes become physically unreachable together.

The surviving host must not infer that the missing worlds ceased to exist or changed their dispositions.

### Logical failure

One node may be disabled or placed into a refusing posture without treating colocated peers as unavailable.

### Transport failure

Cross-project HTTP failure must leave sender-local outbox state unresolved and replayable.

### Realtime failure

Realtime loss must not prevent durable crossing reconstruction.

## Security requirements

1. Keep mesh tables outside the exposed public schema whenever practical.
2. Do not expose project secret/service-role keys across the network.
3. Each logical node receives its own signing identity.
4. Store peer public keys and explicit peer permissions only.
5. Ingress must verify signature, destination, replay state, timestamp bounds, and payload limits before local processing.
6. If an Edge Function disables Supabase JWT verification, it must implement the custom cryptographic authentication described here.
7. Do not use mutable user metadata for authorization.
8. Do not use authenticated role membership alone as authorization.
9. Do not introduce SECURITY DEFINER merely to bypass permission problems.
10. Existing WITNESS and pantry-gate application schemas remain untouched unless a later reviewed plan explicitly requires integration.
11. Never log private key material, project secret keys, or full sensitive payloads merely for observability.
12. Prefer content addresses and bounded references when raw payload duplication is unnecessary.
13. Run Supabase security advisors after every DDL stage.

## Observability

Every physical host should expose a read-only operator view containing only bounded operational state:

- logical nodes present;
- node public-key fingerprints;
- peer reachability;
- pending outbox count;
- unresolved HOLD count;
- recent receipt IDs;
- failed transport count;
- latest durable crossing timestamps;
- whether forbidden cross-node direct writes were observed.

This operator view is not canonical history.

## First executable specimen — MX13-001

Name: One Particular, Thirteen Constitutions

Purpose: send one exact particular through all thirteen nodes and demonstrate that shared evidence can produce different lawful local outcomes without mutating the source identity.

Recommended particular: the already-addressed INVITATION image used by STATIC OS BARDO-BOOT-WITNESS-001, because its exact byte address is already known and its filename/media mismatch provides a useful non-normalization test.

### Route

The first route should cross the physical boundary repeatedly rather than grouping nodes by host:

~~~
01 WITNESS
  -> 02 GATE
  -> 03 DEAD LETTER
  -> 04 COMPOST MONK
  -> 05 MIRRORGØAT
  -> 06 CONTRARY
  -> 07 LANTERN EATER
  -> 08 PIRATE CLERK
  -> 09 CHOIR-OF-ONE
  -> 10 BONE ORCHARD
  -> 11 ORACL
  -> 12 FERRYMAN
  -> 13 MISSPELDD MAXHINAL
~~~

This produces twelve physical WITNESS <-> pantry-gate crossings.

Each hop must preserve the addressed source particular while allowing local descendants and local receipts.

### Required proof

MX13-001 succeeds only if:

1. all thirteen logical signing identities are distinct;
2. both physical hosts participate;
3. same-host direct-write bypass is impossible through the supported path;
4. every receive enters HOLD before any local disposition;
5. each node applies its own constitution;
6. at least three nodes produce intentionally different local dispositions or descendants from the same evidence;
7. no node mutates the source content address while claiming continuity;
8. all cross-host requests are independently signature-verified;
9. all returned receipts are attributable to the node that produced them;
10. one host can temporarily disappear without the other synthesizing its state;
11. replay reconstructs the route from durable receipts without Realtime;
12. temporary crossing/Bardo state may be deleted without losing durable ancestry.

## Candidate second live SupaBardo crossing

MX13-001 is a strong candidate for the “second meaningfully different crossing” required by the original SupaBardo promotion ladder because it differs from SB-001 in several material ways:

- image particular rather than the original software-world receipt;
- repeated project-to-project network crossings;
- thirteen independent logical constitutions;
- mandatory HOLD at every destination;
- multiple lawful outcomes from shared evidence;
- shared physical hosts without shared logical authority.

However:

~~~
CANDIDATE SECOND CROSSING != AUTOMATIC EXTRACTION
~~~

Only executed evidence may determine whether the original extraction gate has actually been satisfied.

## Implementation stages

### Stage 0 — Design

This document only.

### Stage 1 — Private mesh substrate

Create isolated MAXHINAL namespaces on WITNESS and pantry-gate without touching existing application tables.

Prove local schema, node identities, and security posture.

### Stage 2 — Two-host crossing

Prove one signed crossing WITNESS -> pantry-gate and one return crossing pantry-gate -> WITNESS.

No thirteen-node choreography yet.

### Stage 3 — Thirteen constitutions

Instantiate all thirteen logical nodes and prove node-local HOLD/disposition behavior.

### Stage 4 — MX13-001 route

Send one exact particular through the full alternating route.

### Stage 5 — Adversarial network pass

Run the required failure, replay, authority-collapse, and host-failure tests.

### Stage 6 — SupaBardo extraction review

Compare executed evidence against the original promotion gate.

Do not extract merely because thirteen nodes exist.

## Explicit non-goals

The first implementation does not attempt to provide:

- thirteen physically isolated databases;
- Byzantine consensus;
- leader election;
- a universal distributed database;
- blockchain semantics;
- one global truth table;
- automatic conflict resolution;
- shared service-role credentials;
- autonomous authority escalation;
- permanent Realtime dependence;
- hidden direct table replication;
- a standalone SupaBardo repository by default.

## Architectural consequence

MAXHINAL-13 deliberately creates plurality without pretending plurality requires thirteen cloud accounts.

Two physical worlds can carry thirteen local constitutions if the system keeps the distinctions visible:

~~~
where the bytes live
!=
which world is speaking
!=
who signed the crossing
!=
who may decide locally
!=
what consequence became constituted
~~~

The experiment succeeds when thirteen nodes can receive the same evidence, disagree lawfully, transform differently, fail differently, remember differently, and still remain mutually intelligible through one narrow crossing grammar.

That is the point:

> **Make the network interoperable enough to cross, but never homogeneous enough to erase the worlds.**
