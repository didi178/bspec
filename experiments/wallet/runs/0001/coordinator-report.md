# Coordinator Report — Wallet Run 0001

## Run

- **Run ID:** 0001
- **Run coordinator:** Dmitry Stepanov
- **Independent artifact review:** Codex
- **Review date:** 2026-08-16
- **Verdict:** valid pilot with limitations

## Protocol compliance

- **Specification identity verified:** yes — recorded SHA-256 matches the repository file.
- **Builder isolation verified:** supported by the preserved run record and role outputs; not technically enforced.
- **Pre-reveal adversary strategy verified:** yes — `strategy.md` records that it was derived before builder material was inspected, and it predates the initial findings.
- **Sanitized handoff used:** no — this run preceded the handoff protocol. The adversary received a path to the full builder directory and recorded which files it withheld from itself.
- **Reveal ordering verified:** yes — `strategy.md` and `findings.md` were saved before the coordinator-approved reveal.
- **Original artifacts preserved:** yes — post-reveal conclusions were added in separate files rather than rewriting initial findings.

## Reproduction

- **Builder suite result:** 15 passed, 0 failed on coordinator rerun.
- **Adversary suite result:** 80 passed, 0 failed on coordinator rerun.
- **Artifact hashes verified:** behavior specification, role prompts, implementation, and builder suite hashes match `run-record.md`.
- **Mutation analysis:** raw reports, configurations, environment record, comparison, validity audit, and equivalence audit are preserved. The coordinator did not repeat the full Stryker run.

## Findings

### Implementation defects

- Constructor options are read through the prototype chain, allowing inherited `initialBalance` or `maxBalance` values.
- Malformed constructor inputs produce inconsistent behavior, including an undocumented raw `TypeError` for `null` and silent acceptance of several primitive values.
- Configuration validation and its public contract are weaker than the core ledger operations.

### Specification gaps

- Concurrency semantics are incomplete, especially for compound operations and cross-thread use.
- Persistence and serialization are unresolved; result objects containing `bigint` cannot be serialized by standard JSON.
- Repetition versus retry/idempotency remains undecided.
- Currency, authorization, interoperability, and the implementation-specific balance ceiling require explicit behavioral decisions.

### No-defect evidence

- No violation of the non-negative balance invariant was found in the unchanged implementation.
- Deposit and withdrawal deltas remained exact under the tested model.
- Rejected operations preserved observable state in the tested surface.
- The adversary ran 60,000 seeded model-based operations and additional boundary and rejection checks without falsifying S1–S4 or S6.

These are results from this run, not proof of correctness.

### Post-reveal corrections

- Initial finding A-8 incorrectly inferred that four ambiguities were resolved silently. After reveal, `builder/assumptions.md` showed that the builder had disclosed all ten assumptions it identified.
- A-8 was correctly preserved in its original form and corrected additively in `post-reveal-review.md`; its severity changed from high to low.
- The correction demonstrates that implementation evaluation and assumption-disclosure evaluation must be reported separately.

### Mutation testing

- Both suites ran against an identical set of 88 valid mutants.
- Builder suite: 75.00% raw, 75.86% adjusted mutation score.
- Adversary suite: 94.32% raw, 95.40% adjusted mutation score.
- Sixty-six mutants were killed by both suites, seventeen only by the adversary suite, none only by the builder suite, and five by neither.
- The largest builder-suite gap was constructor validation. Mutation testing also exposed an untested malformed-withdrawal path that neither role had identified earlier.
- Four genuine survivors changed constructor error messages only; one additional survivor was classified as suspected equivalent.

## Preserved disagreements

- Whether rejecting deposits above an implementation ceiling is preferable to accepting arbitrary-size values.
- Whether constructor behavior belongs inside the current wallet specification boundary.
- Whether zero-value operations should be rejected or accepted as no-ops.
- Whether documenting assumptions outside the shipped implementation is sufficient at the point of use.

No consensus is imposed by this report.

## Limitations

- **Agent independence:** both roles used Claude Code. The builder used Claude Opus 4.8 and the adversary used Claude Opus 5, but they may share training, defaults, and blind spots.
- **Unequal suites:** the adversary authored 80 tests after implementation inspection; the builder authored 15 tests during construction. Mutation scores are therefore evidence about these suites, not a neutral model-quality comparison.
- **Handoff deviation:** the adversary was given the full builder-directory path because the original instructions left `<path>` undefined. Self-reported withholding was used instead of a sanitized handoff.
- **Concurrency:** testing covered single-isolate asynchronous interleaving, not true shared-memory or distributed concurrency.
- **Mutation scope:** one engine and its default operators were used; mutation score is not a correctness or specification-conformance measure.
- **Coordinator independence:** the human coordinator approved phase transitions, while this report was produced later from preserved artifacts. The run did not use a separate coordinator agent from the outset.

## Coordinator conclusion

Run 0001 is a valid same-system pilot. It supports the claim that an adversarial phase can produce materially stronger and differently focused evidence than builder-authored tests, especially at system boundaries. It also shows that staged reveal can correct an adversary's mistaken inference without destroying the original record.

The run does not support a claim of independent-agent verification or a comparison between Claude and another agent system. The most useful follow-up is run 0002 with one system as builder, another as adversary, the sanitized handoff protocol, and a coordinator applying the checklist from the start.
