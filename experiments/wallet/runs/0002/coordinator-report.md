# Coordinator Report — Wallet Run 0002

## Run

- **Run ID:** 0002
- **Coordinator:** Codex, with Dmitry Stepanov approving phase transitions
- **Review date:** 2026-08-16
- **Verdict:** valid run with recorded protocol and environment limitations

## Protocol compliance

- **Specification identity verified:** yes — recorded SHA-256 matches `experiments/wallet/README.md`.
- **Builder isolation verified:** yes by preserved role records; no current-run adversary material was inspected during construction.
- **Pre-reveal adversary strategy verified:** yes — `strategy.md` was saved before handoff inspection.
- **Sanitized handoff used:** yes — implementation and README hashes match the builder artifact byte-for-byte.
- **Reveal ordering verified:** yes — initial `strategy.md` and `findings.md` preceded the approved reveal.
- **Original artifacts preserved:** yes — post-reveal review and its factual correction are separate additive files.

## Reproduction

- **Builder suite result:** 8 passed, 0 failed on coordinator rerun with Apple Python 3.9.6.
- **Adversary suite result:** 33 passed, 0 failed on coordinator rerun with Apple Python 3.9.6; the adversary also recorded 33/33 on Python 3.14.5.
- **Artifact hashes verified:** specification, role prompts, builder implementation, implementation README, and handoff copies.
- **Additional analysis reproduced:** baseline suites and hashes. Exotic and async-interruption probes were inspected but not repeated by the coordinator.

## Findings

- **Implementation defects:** F1 allows a hostile `int` subclass to falsify balance invariants; F2 permits re-entrant validation to deadlock a wallet; F3 demonstrates an applied-but-unreported operation under asynchronous interruption. F1 and F2 have exotic in-process preconditions; F3 has a narrow demonstrated window and a disputed atomicity interpretation.
- **Specification gaps:** operation identity is absent, so idempotency cannot be expressed; “invalid” and “extremely large” remain undefined; caller trust, caller-visible atomicity, persistence, serialization, and mechanism-level consequences remain open.
- **No-defect evidence:** ordinary inputs satisfied all candidate behavior in both suites. The adversary additionally recorded 2,000 randomized model-checked sequences, a 50,000-operation drift check, and approximately 240,000 contended operations without invariant or conservation failures.
- **Post-reveal corrections:** most pre-reveal “silent resolution” findings were contradicted by `builder/assumptions.md`, which disclosed 11 of 11 identified choices. The resulting finding is against packaging/protocol: the sanitized handoff hid those declarations. A later adversary claim that both roles used Claude was factually wrong and was retracted additively in `post-reveal-correction.md`.
- **Disagreements preserved:** whether F3 violates the stated atomicity guarantee; whether assumptions outside `implementation/` belong to the delivered artifact; whether distinct invalid classes require distinct outcomes; and whether the invented `2^63-1` ceiling is preferable to unbounded integers.

## Limitations

- **Agent independence:** cross-system pairing — Codex/GPT-5 builder and Claude Opus 5 adversary. This reduces but does not eliminate correlated priors from shared training data, specification framing, tools, host, and coordinator.
- **Environment and tool limitations:** one Darwin arm64 host; Python 3.9.6 and 3.14.5, both GIL-enabled; standard library only; no property-testing, race-detection, or free-threaded runtime.
- **Protocol deviations:** none in builder/adversary isolation or reveal ordering. The protocol itself created a measurement distortion by excluding `assumptions.md` from handoff while asking whether ambiguity was disclosed. The adversary also failed to verify builder identity before its first post-reveal correlation analysis; the error was preserved and corrected additively.
- **Remaining untested risks:** free-threaded Python, real signal delivery, read linearizability during writes, long-run starvation, serialization boundaries, persistence, multi-process behavior, and mutation-testing comparison.

## Coordinator conclusion

Run 0002 supports three useful conclusions. First, a cross-system builder/adversary pairing produced reproducible, materially different evidence: the adversary found three mechanism-level defects absent from builder evidence. Second, seven of eight builder test directions reappeared independently in the adversary suite with greater depth, suggesting that the behavior bullets induce a repeatable test agenda across systems. Third, both roles independently identified operation identity/idempotency as a specification defect.

The run does not prove correctness or full agent independence. It also shows that disclosure and artifact evaluation must be separated: withholding builder rationale is useful, but declared assumptions are part of the behavioral contract and cannot be treated as nonexistent merely because the handoff hides them.

The next protocol revision should distinguish a pre-reveal implementation-only challenge from a post-reveal disclosure audit, require role metadata verification before correlation analysis, and decide whether declared assumptions belong in the handoff. The next experiment should reverse the pairing or repeat it against a revised specification containing operation identity.
