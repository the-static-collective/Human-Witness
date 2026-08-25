# Core

The core owns runtime-agnostic Human Witness domain rules.

Candidate responsibilities:

- begin a bounded encounter;
- bind an exact subject/version;
- record presentation evidence;
- record actor declaration and declared capacity;
- record one or more supported human acts or refusals;
- attach provenance references without importing external authority;
- seal an immutable encounter receipt.

The core must not depend on UI frameworks, databases, Corpus OS runtime objects, Formation Trace implementation details, authentication vendors, notarial systems, or jurisdiction-specific legal rules.

## Core law

```text
exact subject
    ↓
presentation
    ↓
actor + declared capacity
    ↓
deliberate act / refusal
    ↓
encounter receipt
```

Each arrow is attributable evidence, not an inference that the next legal or executable consequence follows.

## First implementation target

Prefer a small pure module with deterministic receipt formation and adversarial tests before introducing persistence or UI.
