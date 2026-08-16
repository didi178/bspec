# Concepts

This document establishes provisional vocabulary for BSpec. These terms are working concepts, not a settled design.

## Behavior is the source

“Behavior is the Source” means that intended, observable behavior is the durable input to software construction. Implementation code may be generated, replaced, or regenerated as long as the resulting system continues to satisfy that behavioral source.

For behavior to serve as a source of truth, it must be inspectable, versionable, and precise enough to challenge an implementation. Natural-language intent may be part of it, but prose alone may not provide sufficient evidence of correctness.

## Behavior specification

A behavior specification describes what a system must do without prematurely fixing how it does it. It may include:

- examples and counterexamples;
- invariants and state transitions;
- preconditions, postconditions, and forbidden outcomes;
- observable inputs, outputs, and failures;
- security, performance, and resource constraints;
- explicit ambiguity and unresolved choices.

A specification is not assumed to be complete. Discovering its gaps is part of the workflow.

## Builder agent

The builder agent derives an implementation from the behavior specification. Its output is replaceable implementation code, plus any trace or evidence needed to explain how the implementation relates to specified behavior.

The builder is not the authority on whether its own output is correct.

## Adversary agent

The adversary agent independently attempts to break or falsify the implementation against the specification. It searches for counterexamples, boundary conditions, invariant violations, unsafe behavior, and underspecified cases.

Independence matters: an adversary that simply repeats the builder's reasoning provides weak evidence. How to establish meaningful independence is an open research question.

## Conventional toolchain

BSpec does not assume that proven compilers, runtimes, package managers, debuggers, or deployment tools should be replaced. In the working model, a conventional compiler or toolchain turns generated implementation code into an executable artifact.

## Evidence

Evidence is any reproducible result that connects a specification to an implementation or executable artifact. Tests, model-checking results, proofs, traces, fuzzing corpora, and adversarial counterexamples may all contribute evidence. No single evidence form is presumed sufficient for every system.

## Research boundary

The representation of behavior is unresolved. BSpec might ultimately be a new language, a semantic IR, a graph model, a methodology using existing tools, or a hybrid. Experiments should compare these possibilities rather than encode an answer by assumption.
