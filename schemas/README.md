# Schemas

This directory will hold stable external representations for Human Witness evidence once the v0.1 domain model survives the first executable specimen.

Candidate schema families:

- `subject-binding`
- `presentation-record`
- `actor-declaration`
- `human-act-occurrence`
- `external-attestation-ref`
- `encounter-receipt`

## Rule

Do not freeze JSON Schema merely because a convenient object shape exists.

The core invariants come first. Serialization comes after the proof clarifies which fields are required, optional, repeated, derived, or adapter-owned.

Any future schema must keep these distinctions mechanically visible:

```text
presentation ≠ comprehension
actor declaration ≠ authenticated identity
declared capacity ≠ established legal capacity
human act ≠ authority
receipt ≠ consequence
observed formation ≠ reconstructed formation
```

Version schemas explicitly and preserve old receipts rather than silently rewriting them into a newer shape.
