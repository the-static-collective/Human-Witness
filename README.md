# Human Witness

**A reusable witness membrane for attributable human encounters with exact instruments.**

Human Witness exists to preserve a narrow fact:

> **Witness the human act locally. Let the larger graph determine what that act changes.**

It is not a signing authority, legal engine, identity provider, trust runtime, or document-management system. It records bounded evidence of what a human was presented, the capacity they declared, the act they deliberately performed or refused, and the receipt that resulted.

The first intended consumers are Upper Room-derived interfaces, Formation Trace, Corpus OS, and trust/legal administration surfaces. Human Witness stays useful precisely by **not** absorbing their authority.

## The problem

A field such as:

```text
document.signed = true
```

collapses too much.

It can erase distinctions between:

- the exact artifact that was presented;
- the artifact's formation history;
- who was named as acting;
- the capacity in which they declared themselves to act;
- what interaction actually occurred;
- whether the person assented, signed, witnessed, refused, or revoked;
- what evidence exists for that occurrence;
- whether some other system admitted the occurrence as authoritative;
- what consequence, if any, followed.

Human Witness preserves those distinctions.

## Defining boundary

Human Witness owns **encounter evidence**.

It may record:

- an encounter identifier;
- an exact subject reference and digest/version;
- presentation evidence sufficient to identify what was shown;
- an attributed or declared human actor reference;
- a declared acting capacity;
- explicit human acts and refusals;
- timestamps and local sequence;
- links to relevant Formation Trace evidence;
- a sealed encounter receipt;
- adapter-safe references for downstream systems.

Human Witness does **not** decide:

- whether a person's claimed identity is authentic;
- whether they possessed legal capacity;
- whether a signature is legally valid or enforceable;
- whether an instrument formed a trust, contract, covenant, conveyance, or other legal relation;
- whether an act grants executable authority;
- whether Corpus OS Trust Runtime should admit a request;
- whether Corpus Session should execute a capability;
- what later world-state is constituted from the evidence.

Those are separate questions with separate owners.

## Architectural lineage

Human Witness is intentionally descended from existing Static Collective primitives without merging them.

### Upper Room — encounter grammar

Upper Room contributes the interaction law of **continuity without captivity**: preserve the attributable thread required for honest return without treating maximal observation as continuity.

Human Witness carries that discipline into deliberate human acts around instruments. It should witness what matters without becoming a surveillance recorder.

### Formation Trace — how the instrument came to be

Formation Trace concerns the artifact's formation provenance. Observed formation history and reconstructed formation history remain different evidence classes.

Human Witness may reference Formation Trace, but it must not manufacture unwitnessed authorship, keystrokes, edit order, intent, or provenance merely because a final artifact exists.

### Corpus OS — authority, admission, consequence

Corpus OS already separates declared actor, capacity, power, trust admission, one-shot Action Warrant, Session admission, consequence, refusal, causal accounting, and constituted reality.

Human Witness does not duplicate that stack. It emits evidence that Corpus OS may later evaluate.

A Human Witness receipt is **not automatically an Action Warrant** and is **not automatically authority**.

### Jubilee Authority Kit — instrument/domain semantics

Trust, covenant, declaration, notice, agreement, or other instrument-specific semantics belong outside this repository. Human Witness can provide the encounter evidence those domains consume without deciding their legal meaning.

## Candidate flow

```text
exact instrument / subject@digest
        ↓
begin human encounter
        ↓
present exact bound subject
        ↓
record declared actor + capacity
        ↓
record deliberate act OR refusal
        ↓
seal Human Witness receipt
        ↓
        ├── Formation Trace reference / ancestry
        ├── archive / evidence store
        ├── Corpus OS Trust request input
        └── other domain-specific adapter

receipt ≠ authority
receipt ≠ legal validity
receipt ≠ consequence
```

## Candidate human acts

The vocabulary is intentionally broader than `SIGN` and intentionally narrow enough to be explicit.

```text
ACKNOWLEDGE
DECLARE
ASSENT
SIGN
WITNESS
ACCEPT_CAPACITY
REFUSE
REVOKE
```

These are occurrence labels, not universal legal conclusions. A downstream profile may define stricter semantics or refuse a verb entirely.

## Evidence classes

The first design should keep at least these classes distinguishable:

1. **Subject evidence** — what exact artifact or constituted subject the encounter concerns.
2. **Presentation evidence** — what exact subject/version was presented in the encounter.
3. **Actor declaration** — who is named and in what capacity they claim or declare they are acting.
4. **Human act** — the attributable deliberate occurrence or refusal.
5. **Formation reference** — relevant observed/reconstructed provenance supplied by Formation Trace.
6. **Encounter receipt** — the sealed record tying the bounded occurrence together.
7. **External attestation** — optional evidence supplied by some other witness, authentication, notarial, device, or institutional system without silently promoting it into authority.

## Repository map

```text
Human-Witness/
├─ README.md
├─ docs/
│  └─ superpowers/specs/
│     └─ 2026-08-25-human-witness-design.md
├─ schemas/
│  └─ README.md
├─ core/
│  └─ README.md
├─ adapters/
│  └─ README.md
└─ specimens/
   └─ README.md
```

The first commit intentionally establishes boundaries and vocabulary before choosing a runtime, persistence layer, signature technology, identity mechanism, or jurisdiction-specific profile.

## First proof target

The smallest useful specimen is not a full signing application.

It is one deterministic encounter in which a human is presented an exact bound artifact, declares an acting capacity, deliberately performs one supported act or refusal, and receives an inspectable receipt whose subject digest and event lineage can be independently checked.

The proof passes only if downstream systems can consume that receipt **without Human Witness claiming what legal or executable consequence follows from it**.

## Governing rules

> Preserve the encounter, not a story about the encounter.

> Presentation is not comprehension.

> A declared identity or capacity is not automatically authenticated identity or legal capacity.

> A witnessed act is not automatically authority.

> A receipt may become evidence in another system; it does not silently become that system's judgment.

> Refusal is a first-class occurrence.

> Observed formation and reconstructed formation remain different evidence classes.

> Do not record more human behavior than is necessary to establish the declared encounter.

## Status

**v0.1 architecture seed.** No executable implementation, legal-validity claim, authentication scheme, digital-signature standard, durable ledger, or jurisdiction-specific profile is constituted by this repository yet.
