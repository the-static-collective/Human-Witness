# Adapters

Adapters translate Human Witness evidence across system boundaries without changing the meaning of the core receipt.

Initial adapter targets:

- **Formation Trace** — reference observed/reconstructed formation provenance without inventing missing history.
- **Corpus OS** — translate a Human Witness receipt into evidence usable by a Trust request or casework flow without minting an Action Warrant inside Human Witness.
- **Archive / evidence store** — persist exact receipts and referenced subject material while preserving identity and lineage.
- **External attestation systems** — attach authentication, witness, device, notarial, or institutional evidence as attributable external material.
- **Upper-Room-derived interfaces** — provide encounter/presentation UX while keeping durable capture bounded to declared evidence.

## Adapter law

```text
external system
      ↕
   adapter
      ↕
Human Witness core
```

The dependency points inward.

An adapter may translate representation, verify an external claim according to that external system, or attach provenance. It may not silently upgrade:

- declaration → authentication;
- presentation → comprehension;
- signature → legal validity;
- receipt → authority;
- evidence → consequence.

Any downstream admission remains the downstream system's act.
