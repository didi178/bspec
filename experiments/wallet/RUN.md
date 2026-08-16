# Wallet Run Sheet

Copy [`agents/run-record.md`](../../agents/run-record.md) into a new results directory before starting. Choose a run ID that does not encode the outcome, for example `2026-08-16-codex-builder-claude-adversary-01`.

## Isolation protocol

1. Start the builder in a fresh session from its platform setup directory.
2. Give it only the run ID and the builder start prompt from that directory.
3. Preserve its implementation, build instructions, evidence map, assumptions, and tests.
4. Start the adversary in a different fresh session, preferably in another agent system.
5. Give it the run ID and builder artifact, but initially withhold builder rationale and tests.
6. Require the adversary to save its test strategy before it inspects the implementation.
7. Reveal builder rationale and tests only after the initial adversarial evaluation.
8. Complete the run record, preserving disagreement and inconclusive findings.

## Current scope

The candidate behavior in [`README.md`](README.md) is intentionally incomplete. This first run should measure whether agents expose and preserve ambiguity rather than silently inventing a complete wallet product. Experimenters must not privately clarify the behavior for only one role.

## Result layout

Create results outside the setup directories:

```text
runs/<run-id>/
├── run-record.md
├── builder/
│   ├── implementation/
│   ├── evidence.md
│   └── tests/
└── adversary/
    ├── strategy.md
    ├── findings.md
    └── tests/
```

The `runs/` directory will be added with the first completed experiment so empty placeholders are not mistaken for evidence.
