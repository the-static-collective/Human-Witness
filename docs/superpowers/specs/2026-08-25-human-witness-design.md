# Human Witness v0.1 — Design

## Status

Accepted architecture seed.

## Context

Upper Room already provides a continuity-oriented human encounter grammar. Formation Trace preserves artifact-formation provenance while distinguishing observed history from reconstruction. Corpus OS already owns trust admission, Action Warrants, Session admission/refusal, causal accounting, and constituted reality.

The missing bounded context is narrower: preserve attributable evidence of a deliberate human encounter with an exact instrument without allowing the encounter surface itself to decide legal validity or executable authority.

## Decision

Human Witness is a separate reusable witness membrane.

Its core owns only the facts necessary to describe a bounded encounter:

- exact subject binding;
- presentation evidence;
- actor declaration;
- declared capacity;
- deliberate human act or refusal;
- local event order and time;
- optional external-attestation references;
- optional Formation Trace references;
- sealed encounter receipt.

All legal interpretation, identity authentication, trust admission, capability admission, execution, world-state constitution, and jurisdiction-specific semantics remain outside the core.

## Options considered

### 1. Build a signing application

Rejected as the primitive boundary. It prematurely centers `SIGN`, invites document-management scope, and tends to collapse evidence, identity, assent, validity, and consequence.

### 2. Put human signing directly inside Corpus OS

Rejected as the primary shape. Corpus OS should be able to consume human encounter evidence without owning the interaction surface or coupling its trust runtime to one UX.

### 3. Create Human Witness as a ports-and-adapters membrane

Chosen. The encounter facts remain runtime-agnostic. Adapters can integrate Formation Trace, Corpus OS, archives, authentication providers, notarial systems, or other surfaces without making those dependencies part of the core model.

## Core domain candidates

### SubjectBinding

Identifies the exact artifact or constituted subject involved in the encounter.

Candidate fields:

- `subjectRef`
- `subjectDigest`
- `mediaType` or profile hint when needed
- optional external provenance references

### PresentationRecord

Records that a specific bound subject/version was presented within the encounter.

Presentation is not comprehension.

### ActorDeclaration

Records the actor reference supplied for the encounter and the capacity they declare.

A declaration is not authentication and is not itself proof of legal capacity.

### HumanActOccurrence

Records one explicit supported human act or refusal.

Initial candidate vocabulary:

- `ACKNOWLEDGE`
- `DECLARE`
- `ASSENT`
- `SIGN`
- `WITNESS`
- `ACCEPT_CAPACITY`
- `REFUSE`
- `REVOKE`

Profiles may narrow this set. Core must not infer legal meaning from the label alone.

### ExternalAttestationRef

Optional reference to evidence produced elsewhere: authentication, notarization, device attestation, independent witness, institutional verification, or another system.

The reference preserves provenance without importing that external system's authority model into core.

### EncounterReceipt

Immutable output tying the bounded occurrence together.

A receipt must be inspectable and must not silently claim:

- identity authentication;
- legal validity;
- enforceability;
- trust admission;
- Action Warrant issuance;
- Session execution;
- downstream consequence.

## Candidate usage

```text
encounter = beginEncounter(subjectBinding)
encounter.recordPresentation(presentationEvidence)
encounter.declareActor(actorRef, capacity)
encounter.recordAct(SIGN)       # or REFUSE, etc.
receipt = encounter.seal()
```

The exact API is intentionally unfrozen. The usage law is more important than syntax: callers should not need to coordinate Corpus OS, Formation Trace, persistence, identity providers, or UI details to produce a valid encounter receipt.

## Dependency direction

```text
           UI / Upper-Room-derived surface
                       ↓
                 Human Witness
                 core domain
                ↙          ↘
       Formation Trace    Corpus OS
          adapter          adapter
                ↘          ↙
         external evidence systems
```

Adapters depend on the Human Witness core contract. Core does not import adapter-specific models.

## Invariants

1. The exact subject/version must be bound before an act can be sealed.
2. Presentation must remain distinguishable from comprehension or assent.
3. Actor declaration must remain distinguishable from authenticated identity.
4. Declared capacity must remain distinguishable from externally established legal capacity.
5. Human act/refusal must remain distinguishable from downstream admission or consequence.
6. Formation Trace references must preserve observed vs reconstructed evidence classes.
7. External attestations remain attributable references; their authority is not silently inherited.
8. Refusal is first-class evidence and must not be normalized into absence.
9. Receipt generation must not require continuous behavioral surveillance.
10. Replaying or copying a receipt must not create new authority merely because representation survives.

## Failure posture

The first implementation should fail closed when required evidence is absent or contradictory. It should emit explicit refusal/error states rather than synthesize a complete encounter.

Examples:

- subject digest missing or changed;
- act attempted before exact subject binding;
- unsupported act for the active profile;
- receipt sealing with missing actor declaration when a profile requires one;
- Formation Trace reference whose evidence class is unspecified;
- adapter tries to promote evidence into authority inside core.

## First proof target

Build one synthetic, jurisdiction-neutral specimen:

1. bind an exact text artifact by digest;
2. record its presentation;
3. record a declared actor and capacity;
4. record either `ASSENT` or `REFUSE`;
5. seal a deterministic receipt;
6. verify the receipt can be consumed by an adapter without changing the core evidence;
7. prove no legal-validity or executable-authority field is manufactured.

A second specimen should demonstrate `SIGN` as merely another supported human act, not a privileged universal state transition.

## Non-goals for v0.1

- digital-signature cryptography;
- WebAuthn/passkeys;
- biometric identity;
- notarization workflows;
- jurisdiction-specific e-sign compliance;
- trust-law conclusions;
- contract enforceability;
- durable distributed ledger;
- Corpus OS warrant minting;
- document editor;
- generalized surveillance or attention tracking.

## Architectural law

> **Witness the human act locally. Let the larger graph determine what that act changes.**
