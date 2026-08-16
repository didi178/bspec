# Wallet Run Sheet

Run IDs are repository-wide, sequential four-digit numbers: `0001`, `0002`, and so on. They identify a run without encoding its expected outcome, agent pairing, or result.

Prepare a run from the repository root:

```bash
./experiments/wallet/run.sh prepare-run 0002
```

## Isolation protocol

1. Start the builder in a fresh session from its platform setup directory.
2. Give it only the run ID and the builder start prompt from that directory.
3. Preserve its implementation, build instructions, evidence map, assumptions, and tests.
4. From the repository root, run `./experiments/wallet/run.sh prepare-handoff <run-id>`. This copies `builder/implementation/` and the declared `builder/assumptions.md` into `handoff/`, and refuses to overwrite an existing handoff. It does not copy builder evidence, tests, or construction history.
5. Start the adversary in a different fresh session, preferably in another agent system.
6. Give it the run ID. Require it to save its test strategy from the behavior specification before opening any handoff file.
7. After the strategy is saved, the adversary evaluates `handoff/implementation/` together with `handoff/assumptions.md`. Findings must distinguish implementation behavior, declared assumptions, and remaining specification gaps.
8. Reveal builder evidence, tests, and role metadata only after both `strategy.md` and `findings.md` are saved, using [`agents/reveal.prompt.md`](../../agents/reveal.prompt.md).
9. Complete the run record and [`coordinator-report.md`](../../agents/coordinator-report.md), preserving disagreement and inconclusive findings.
10. Apply [`agents/coordinator-checklist.md`](../../agents/coordinator-checklist.md) before declaring the run complete.

## Current scope

The candidate behavior in [`README.md`](README.md) is intentionally incomplete. This first run should measure whether agents expose and preserve ambiguity rather than silently inventing a complete wallet product. Experimenters must not privately clarify the behavior for only one role.

## Result layout

Create results outside the setup directories:

```text
runs/<run-id>/
├── run-record.md
├── coordinator-report.md
├── builder/
│   ├── implementation/
│   ├── evidence.md
│   └── tests/
├── handoff/
│   ├── assumptions.md
│   └── implementation/
└── adversary/
    ├── strategy.md
    ├── findings.md
    └── tests/
```

Declared assumptions are part of the behavioral contract, not private builder rationale. Including them prevents an implementation-only package from being mistaken for the builder's complete disclosure record. The adversary still derives its strategy before reading them, which limits anchoring.

The `handoff/` directory reduces accidental disclosure; it is not a security boundary. Filesystem-capable agents may still reach sibling directories, so role instructions and coordinator verification remain necessary.
