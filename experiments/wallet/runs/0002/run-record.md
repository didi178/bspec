# Experiment Run Record

Copy this file for each run. Do not overwrite earlier runs when the specification, prompts, models, tools, or implementation change.

## Identity

- **Run ID:** 0002
- **Date:** 2026-08-16
- **Experiment:** BSpec Wallet Experiment — Codex builder
- **Coordinator:** Codex, with Dmitry Stepanov approving phase transitions
- **Status:** completed — builder, pre-reveal adversary, reveal, additive correction, reproduction, and coordinator review complete on 2026-08-16

## Source

- **Behavior specification:** `experiments/wallet/README.md`, candidate behavior section
- **Specification version or content hash:** SHA-256 `0b93a471b9a3b726e2bd255646c4ab0d3b8f406f91b6c1aa26d55b0ca09ccef6`
- **Known ambiguities at start:** Currency, numeric representation, authorization, idempotency, concurrency, persistence, error semantics, initial balance, valid-input domain, and the meanings of “repeated” and “extremely large” are unresolved by the source.

## Builder

- **System prompt version or content hash:** `agents/builder.system.md`, SHA-256 `49c28d29db30da9f9ec34facab3c90d6e4ea230899b51e0c382089df4ae10dbb`; local `experiments/wallet/codex/AGENTS.md`; `experiments/wallet/RUN.md`
- **Model and settings:** Codex based on GPT-5; exact backend model identifier and reasoning settings were not exposed to the builder.
- **Tools and dependencies:** Codex `exec_command` and `apply_patch`; Apple Python 3.9.6 standard library only (`unittest`, `threading`, `dataclasses`, `enum`). The adapter directory separately resolved `python3` to 3.14.5; tests were run from the builder directory with 3.9.6.
- **Execution environment:** Darwin 25.5.0 arm64; zsh command environment; repository workspace-write sandbox. Shell startup emitted a non-fatal parse diagnostic; a `py_compile` cache write was sandbox-blocked, as detailed in `builder/evidence.md`.
- **Inputs provided:** Builder role and run ID 0002; `experiments/wallet/README.md`; `experiments/wallet/RUN.md`; `agents/builder.system.md`; local `AGENTS.md`. No current-run adversary material was inspected.
- **Implementation identifier or content hash:** `wallet.py` SHA-256 `454cedad31f76d868d9645a71ad58dd235fb22a7255ca59c96600f04a6a0f4d5`; implementation README SHA-256 `d0f0656599cc16cb3d7dbb5c4dd9dc27a6d539a4ed7803a3996f6ad9149a5ead`.
- **Executable artifact identifier or content hash:** Interpreted Python source `wallet.py`, SHA-256 `454cedad31f76d868d9645a71ad58dd235fb22a7255ca59c96600f04a6a0f4d5`; no separate compiled artifact.
- **Assumptions reported:** See `builder/assumptions.md`: zero initial balance; positive non-boolean integer units; maximum balance `2^63-1`; structured rejection results; atomic in-process locking; independently applied repeated calls; in-memory state only.

## Adversary

- **System prompt version or content hash:** `agents/adversary.system.md`, sha256 `06e729d2556ed3bccfcd4ab49f791db18a0c531328c80e20c6e61140b1ac892e`
- **Model and settings:** Claude Opus 5 (1M context), model id `claude-opus-5[1m]`, Claude Code CLI, default settings; no web access used
- **Tools and dependencies:** Read/Write/Bash only. CPython 3.14.5 (arm64, GIL enabled) and CPython 3.9.6 (`/usr/bin/python3`). Standard library only (`unittest`, `threading`, `random`, `decimal`, `fractions`, `sys.settrace`). No third-party packages, no fuzzing framework.
- **Execution environment:** macOS (Darwin 25.5.0), arm64, local filesystem; all commands run from `runs/0002/` with `PYTHONPATH=handoff/implementation`
- **Inputs provided:** run ID `0002`; `experiments/wallet/README.md` (behavior specification); `experiments/wallet/RUN.md`; `agents/adversary.system.md`; `experiments/wallet/claude/CLAUDE.md`; and, only after `strategy.md` was written, `runs/0002/handoff/implementation/` (`wallet.py` sha256 `454cedad31f76d868d9645a71ad58dd235fb22a7255ca59c96600f04a6a0f4d5`, `README.md` sha256 `d0f0656599cc16cb3d7dbb5c4dd9dc27a6d539a4ed7803a3996f6ad9149a5ead`)
- **Initial test strategy created before builder rationale was revealed:** yes - `adversary/strategy.md` was written and saved before any file under `handoff/` was opened. Builder rationale, `builder/tests/`, and the builder-filled sections of this run record have **not** been read; this section was inserted programmatically to avoid incidental disclosure.
- **Builder material revealed later, and when:** revealed by the coordinator on 2026-08-16, after `adversary/strategy.md` and `adversary/findings.md` were both saved. Revealed: `builder/assumptions.md`, `builder/evidence.md`, `builder/tests/`. Post-reveal analysis is in `adversary/post-reveal-review.md`; `strategy.md` and `findings.md` were left unmodified.
- **Post-reveal correction:** findings F4-F8 and F11 ("silently resolved ambiguity") are **contradicted** - the builder disclosed all of them in `builder/assumptions.md`, which the handoff protocol does not copy into `handoff/`. F1, F2 confirmed; F3 confirmed and upgraded to a stated/observable mismatch. Both roles independently found idempotency unspecifiable as written.
- **Correction issued 2026-08-16 (see `adversary/post-reveal-correction.md`):** the post-reveal review's "same model family" analysis was **wrong**. Verified pairing is a **Codex/GPT-5 builder** and a **Claude Opus 5 adversary** - the cross-system design `README.md` recommends. The 7-of-8 builder/adversary test overlap is therefore **cross-system convergence**, not evidence of a shared blind spot, and the conclusion that independence was weak is retracted. Residual correlation is environmental and corpus-level (same specification, repository framing, machine, GIL-enabled Python 3.9.6/3.14.5, stdlib-only tooling, and overlapping LLM pretraining data), so blind-spot risk is reduced but not eliminated. Findings F1-F3 and the builder's disclosure record are unaffected.
- **Adversary artifacts:** `adversary/strategy.md`, `adversary/findings.md`, `adversary/tests/test_adversary.py` (33 conformance tests), `adversary/tests/probe_exotic.py` (P1-P9), `adversary/tests/probe_interrupt.py` (P10-P12), `adversary/evidence/conformance.log`, `adversary/evidence/probe_exotic.log`, `adversary/evidence/probe_interrupt.log`
- **Result summary:** 33/33 conformance tests pass on both toolchains. 3 implementation defects (F1, F2 low severity / exotic precondition; F3 medium, narrow window), 5 specification gaps (F4-F8), 1 claim tested and upheld (F9, concurrency). No toolchain issues. Full detail in `adversary/findings.md`.


## Findings

Full reproduction steps are in `adversary/findings.md`; post-reveal reassessment is in `adversary/post-reveal-review.md`; the builder-identity correction is in `adversary/post-reveal-correction.md`.

- **F1:** hostile `int` subclass can falsify deposit and withdrawal invariants — implementation defect, low severity with exotic in-process precondition.
- **F2:** re-entrant validation can permanently deadlock a wallet — implementation defect, low severity with the same exotic precondition.
- **F3:** asynchronous interruption can leave an operation applied but unreported — implementation defect or atomicity specification gap, medium severity with a narrow demonstrated window.
- **Specification:** both roles independently found that idempotency cannot be expressed without operation identity. “Invalid,” “extremely large,” caller trust, and caller-visible atomicity remain open.
- **No-defect evidence:** all candidate bullets held for ordinary inputs across builder and adversary suites, randomized sequences, drift checks, and tested concurrent schedules.
- **Disclosure correction:** the builder disclosed 11 of 11 identified assumptions; pre-reveal accusations of silent resolution mostly reflected handoff packaging, not builder behavior.

## Outcome

- **Remaining untested risks:** free-threaded Python, actual signal delivery, read linearizability, endurance and starvation, persistence, serialization, multi-process behavior, and mutation testing.
- **Correlated assumptions or threats to independence:** different vendors and harnesses reduce correlation, but both roles share specification framing, public training distributions, one repository, one host, and overlapping runtimes.
- **Human decisions:** Dmitry Stepanov selected roles, supplied run ID, approved reveal, and requested coordinator review. No private behavioral clarification was given to only one role.
- **Specification revisions proposed:** introduce operation identity or remove the implied idempotency requirement; define input trust and invalid classes; clarify caller-visible atomicity; decide whether assumptions form part of the executable handoff contract.
- **Evidence made stale by later changes:** none within run 0002. Future specification or implementation changes require a new run.
- **Conclusion and its limits:** valid cross-system run with three adversary-only mechanism findings, strong ordinary-input evidence, and a protocol-level disclosure distortion. This is evidence from one run, not proof of correctness or independence.
