# SupaBardo — Crossing Field Design

## Status

Accepted architecture seed. Documentation only; implementation remains gated pending review of this written spec.

## One-line law

> **Store the crossing, not the canon.**

SupaBardo is a bounded Supabase-backed crossing field under Human Witness. It may carry unresolved relations, live participation, transient event flow, queued obligations, and deliberately short-lived crossing state. It must not silently become the authoritative record of what a human meant, what the law means, or what the larger system is permitted to do.

## Context

Human Witness already owns attributable evidence of a bounded human encounter with an exact subject. Its architectural law is:

> **Witness the human act locally. Let the larger graph determine what that act changes.**

That leaves a real gap between encounter and durable consequence:

```text
world A
  ↓
encounter / handoff
  ↓
???
  ↓
receipt / return / admission
  ↓
world B
```

The `???` is often not absence. It can be an unresolved, attributable relation currently in transit.

SupaBardo exists to make that non-final interval executable without pretending the interval is already canon.

## Decision

SupaBardo will begin as an **experimental crossing-field adapter/specimen inside Human Witness**, not as a standalone repository or universal event bus.

Its first proof is one witnessed signature crossing involving:

- one exact document digest;
- one Human Witness encounter;
- one private Supabase Realtime channel;
- one formation trace stream;
- one unresolved obligation requiring a human witness outcome;
- one deliberate human act (`SIGN` or `REFUSE`);
- one sealed Human Witness encounter receipt;
- one explicit exit from Supabase into a durable downstream carrier.

If the proof survives adversarial testing, SupaBardo earns continued existence. It does **not** earn promotion to standalone infrastructure merely by working once.

## Why Supabase fits this bounded role

As of 2026-08-25, Supabase exposes several primitives that map unusually well onto an unresolved crossing field:

- Realtime private channels with RLS-controlled Broadcast and Presence permissions;
- Presence for small connected-client state;
- Broadcast for low-latency event delivery;
- Postgres-native durable queues for obligations that must survive disconnects;
- database triggers/webhooks and Edge Functions for bounded assembly or forwarding;
- Cron for timeout, expiry, and decay policies;
- ordinary Postgres rows for crossing state whose persistence is explicit rather than accidental.

These primitives are implementation materials, not semantic authority.

Current Supabase references:

- Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- Broadcast: https://supabase.com/docs/guides/realtime/broadcast
- Queues: https://supabase.com/docs/guides/queues
- Realtime Settings: https://supabase.com/docs/guides/realtime/settings

## Architecture

```text
                WORLD A
                   │
       ┌───────────┼───────────┐
       │           │           │
 Human Witness  Groove Room  Upper-Room-like UI
       │
       │ encounter opens around exact subject digest
       ▼
┌───────────────────────────────────────────┐
│                SUPABARDO                  │
│                                           │
│  Presence    → who is locally present     │
│  Broadcast   → what is occurring now      │
│  RLS         → who may hear/speak here    │
│  Queue       → what remains unresolved    │
│  Rows        → bounded crossing state     │
│  Cron        → when unresolved becomes    │
│                expired / escalated        │
│  Functions   → assemble / forward only    │
│                                           │
│     non-canonical crossing membrane       │
└───────────────────────────────────────────┘
       │
       │ seal / exit
       ▼
 Human Witness EncounterReceipt
       │
       ├────────→ Corpus OS / trust request
       ├────────→ TranchNode / artifact carrier
       ├────────→ archive / evidence store
       └────────→ other explicit downstream adapter

                WORLD B
```

## Boundary ownership

### Human Witness owns

- exact subject binding;
- presentation evidence;
- actor declaration;
- declared capacity;
- deliberate human act or refusal;
- local event ordering required by the encounter;
- Formation Trace references;
- sealed encounter receipt.

### SupaBardo owns

- transport-local channel membership;
- temporary participant presence;
- transient formation-event delivery;
- explicit unresolved crossing records;
- queued obligations;
- crossing timeout / expiry state;
- bounded references needed to assemble or export a receipt.

### SupaBardo does not own

- legal identity;
- legal capacity;
- comprehension;
- consent inferred from presence;
- signature validity;
- contract enforceability;
- trust admission;
- Action Warrant issuance;
- executable authority;
- Corpus OS world-state;
- universal canonical history.

## The first ceremony

### 1. ENTER

A Human Witness encounter opens around an exact subject digest.

The SupaBardo crossing receives a unique crossing reference tied to that encounter and digest. A private Realtime topic is created from the crossing reference; topic naming must not itself leak sensitive subject content.

### 2. FORM

The human-facing surface may emit bounded formation occurrences such as:

- section presented;
- selection made;
- revision requested;
- acknowledgment made;
- pause / resume;
- explicit question;
- explicit refusal;
- witness joined / left.

These are evidence candidates, not automatic claims about comprehension or consent.

Formation events carried through Broadcast remain attributable to their emitter and sequence context. They do not become true merely because they were broadcast.

### 3. WITNESS

Presence may show that declared participants are currently connected to the private crossing channel.

Presence must never be interpreted as:

```text
connected = authenticated identity
connected = attentive
connected = comprehending
connected = assenting
```

Any identity authentication or external attestation must remain explicit external evidence referenced by Human Witness.

### 4. WAIT

If the crossing requires an unresolved outcome, a durable queue item or bounded database record represents the obligation.

Examples:

- human act required;
- independent witness required;
- external attestation pending;
- receipt export pending;
- return expected.

The queue item means **unresolved work exists**. It is not the receipt and not the authority to synthesize an outcome.

### 5. ACT

The human performs an explicit Human Witness act such as `SIGN` or `REFUSE` against the exact bound subject.

Supabase may transport and persist the act occurrence. Supabase is not the signer and a server acknowledgment is not human assent.

### 6. SEAL

Human Witness seals the EncounterReceipt from admissible encounter evidence.

A minimal exit receipt should be able to reference:

- encounter reference;
- crossing reference;
- exact subject digest;
- actor declaration;
- declared capacity when used;
- human act occurrence;
- relevant Formation Trace references;
- external attestation references, if any;
- local occurrence ordering;
- unresolved items that remain unresolved;
- sealed-at timestamp;
- receipt digest / identity once the core format is stable.

SupaBardo may assist with assembly but may not add facts that Human Witness did not witness or explicitly reference.

### 7. EXIT

The sealed receipt exits Supabase through a declared adapter into its durable destination.

Successful export is its own attributable occurrence. Export does not prove downstream admission.

After export, crossing-local state follows its declared retention policy rather than silently becoming permanent history.

### 8. DECAY

Ephemeral crossing state is allowed to disappear.

That is a feature.

A successful crossing should leave behind the smallest durable carrier required to establish what occurred, not an immortal duplicate of every transient coordination detail.

## Memory strata

SupaBardo distinguishes memory by purpose:

| Stratum | Example | Intended lifetime | Authority |
| --- | --- | --- | --- |
| Immediate | client Broadcast | live crossing | none beyond attributable occurrence |
| Presence | connected participant state | connection-local | none |
| Short-horizon replay | selected database-origin crossing events | bounded replay window | evidence candidate only |
| Obligation | queue item / unresolved row | until resolved, expired, or explicitly abandoned | obligation state only |
| Encounter receipt | Human Witness sealed output | durable by downstream policy | evidence, not consequence |
| Canon / constituted state | Corpus OS / other owner | owner-defined | outside SupaBardo |

## Anti-confusion laws

These are invariants, not documentation niceties:

```text
Presence                 ≠ proof of identity
RLS permission           ≠ lawful authority
Realtime delivery        ≠ truth
server acknowledgment    ≠ human assent
queue persistence        ≠ canonical history
Supabase row              ≠ Human Witness receipt
Human Witness receipt    ≠ legal validity
Human Witness receipt    ≠ Corpus OS admission
export succeeded         ≠ downstream consequence
replay                    ≠ new human act
```

## Security posture

The first specimen must assume that Realtime access control and database access control are security boundaries, not convenience filters.

Requirements:

1. Use private Realtime channels.
2. Authorize Broadcast and Presence with explicit RLS relationships scoped to the crossing topic.
3. Do not treat `authenticated` role membership alone as sufficient authorization.
4. Keep authorization predicates based on explicit crossing membership / capability relations.
5. Never expose server secret keys to clients.
6. Do not place semantic authority in mutable user metadata.
7. Keep service-role or security-definer operations out of client reach and narrowly scoped if introduced later.
8. Store the minimum sensitive crossing material necessary; prefer digests/references over document duplication when the document already has a durable owner.
9. Design retention and deletion before enabling production capture.
10. Preserve refusal, timeout, contradiction, and failed export as explicit outcomes rather than rewriting them as success.

## Failure posture

SupaBardo fails closed when it cannot establish the prerequisites for a valid crossing.

Examples:

- subject digest changes after crossing opened;
- unauthorized participant attempts to join a private channel;
- formation event claims an unknown encounter;
- human act references the wrong subject digest;
- required external attestation remains unresolved;
- duplicate act appears with conflicting payload;
- queue item exceeds declared deadline;
- receipt assembly lacks required Human Witness evidence;
- export fails;
- downstream system refuses the receipt.

Failure must remain attributable. Do not synthesize a successful crossing from partial evidence.

## First bounded specimen: SB-001

**Name:** One witnessed signature crossing

**Purpose:** prove that unresolved relation can be represented operationally without letting transport become canon.

### Required path

```text
exact synthetic document@digest
        ↓
Human Witness encounter opens
        ↓
private SupaBardo crossing opens
        ↓
participant presence + formation events
        ↓
UNRESOLVED: human act required
        ↓
SIGN or REFUSE
        ↓
Human Witness receipt seals
        ↓
receipt exports to one durable test carrier
        ↓
SupaBardo crossing resolves and decays
```

### Required adversarial cases

- wrong digest;
- unauthorized join;
- event from non-member;
- replayed SIGN presented as new SIGN;
- participant disconnect during unresolved crossing;
- timeout before act;
- contradictory `SIGN` and `REFUSE` occurrences;
- receipt export failure;
- downstream refusal;
- attempted adapter promotion of `receipt` into `authority`.

### Success criteria

SB-001 succeeds only if all of the following are demonstrated:

1. A crossing can remain explicitly unresolved without being treated as absent.
2. Presence and event transport can support the encounter without manufacturing comprehension or assent.
3. A durable obligation survives disconnects without manufacturing an outcome.
4. The human act remains bound to the exact subject digest.
5. Human Witness can seal a deterministic encounter receipt.
6. The receipt can exit Supabase without semantic mutation.
7. Supabase-local crossing state can be expired or deleted while the durable receipt remains usable.
8. No field or server action silently creates legal validity, trust admission, or executable authority.

## Promotion ladder

### Stage 0 — Design

This document only.

### Stage 1 — Human-Witness specimen

Implement SB-001 entirely as a bounded specimen/adapter under Human Witness.

### Stage 2 — Candidate reusable adapter

Allowed only after SB-001 survives adversarial tests and the Human Witness core boundary remains unchanged.

### Stage 3 — Extraction consideration

Consider a standalone SupaBardo / Crossing Field repository or service only after a **second, meaningfully different crossing kind** reuses the same semantics without special-case architecture.

Candidate second crossings might include a Groove Room handoff, a Toaster proposal awaiting human admission, or a Storyship return.

One success proves feasibility. Two distinct successes begin to prove a reusable boundary.

## Explicit non-goals

For the first specimen, do not build:

- a universal event bus;
- a general workflow engine;
- a blockchain or distributed ledger;
- jurisdiction-specific e-sign compliance;
- biometric identity;
- notarization;
- permanent storage for all formation events;
- generalized analytics;
- agent authority delegation;
- automated legal conclusions;
- a new canonical graph;
- a standalone SupaBardo repository.

## Naming posture

**SupaBardo** is a working architectural nickname for the interval between departure and durable arrival.

The durable semantic term is **crossing field**.

If the nickname later becomes confusing, implementation names may use `crossing`, `crossing_field`, or `witness_crossing` without changing the design.

## Architectural consequence

The important new capability is not “we can use Supabase for realtime signing.”

It is narrower and stranger:

> **Non-finality becomes representable.**

A relation can be present without being complete. An obligation can exist without its outcome. A human can be locally witnessed without the transport layer deciding what that act means. A crossing can resolve, leave a receipt elsewhere, and then be allowed to forget.

That is the boundary SupaBardo must prove.
