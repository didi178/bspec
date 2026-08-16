# BSpec-0001: Behavior-First Research Loop

- **Status:** Draft
- **Audience:** Contributors and experiment authors

## Summary

Establish a minimal research loop in which a behavior specification is the durable source, a builder agent derives an implementation, an independent adversary agent attempts to falsify it, and a conventional toolchain produces the executable artifact.

This proposal defines a way to run experiments. It does not propose a BSpec language.

## Motivation

AI has sharply reduced the cost of writing implementation code. As generated code grows and is regenerated more often, humans may stop reading much of it. A workflow that still treats implementation code as the sole source of truth then loses an important trust mechanism: direct human review.

The behavior-first hypothesis is that intent, constraints, and observable outcomes can become the durable source while implementation code becomes derived and replaceable. This requires evidence independent of the builder, not merely confidence from the system that generated the implementation.

## Proposed loop

Each experiment should preserve these artifacts:

1. **Behavior specification:** intended observations, invariants, constraints, examples, and known ambiguities.
2. **Builder output:** implementation code and a trace from behavioral claims to implementation decisions where practical.
3. **Adversary output:** independently generated challenges, counterexamples, and uncovered ambiguities.
4. **Toolchain output:** the executable artifact and reproducible build metadata from a conventional compiler or toolchain.
5. **Evidence record:** results that connect claims to the implementation or artifact, including failures and unresolved questions.

When the adversary finds a counterexample, the experiment must distinguish between an implementation defect and a specification gap. Both outcomes are valuable and should remain visible.

Initial system prompts and run-record requirements are defined in [`agents/`](../agents/). Experiments may change them, but must preserve the exact versions used so results remain interpretable.

## Non-goals

This proposal does not:

- define a programming or specification language;
- claim that generated code never needs human inspection;
- replace compilers, runtimes, or existing verification tools;
- guarantee that two agents are genuinely independent;
- prescribe one universal form of correctness evidence.

## Alternatives to compare

Experiments should avoid assuming their conclusion and compare at least the following when practical:

- a methodology using prose, examples, and existing tools;
- a structured semantic intermediate representation;
- a graph model connecting behavior, constraints, implementation, and evidence;
- a new dedicated language or syntax.

The preferred option should be the least new machinery that produces clear, composable, and reproducible behavioral evidence.

## Initial validation

Use the wallet experiment to evaluate:

- whether independent adversarial work reveals defects or specification gaps missed by the builder;
- whether a human can understand and approve behavioral changes without reading all generated code;
- whether evidence remains traceable after regenerating the implementation;
- whether alternative representations materially improve precision or merely add ceremony.

## Open issues

- How should agent independence be measured or enforced?
- What is the minimal portable form of a behavioral claim?
- How should evidence become stale when behavior or dependencies change?
- What result would falsify the behavior-first hypothesis?
