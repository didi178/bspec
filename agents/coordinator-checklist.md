# Coordinator Checklist

Use this checklist after both roles finish. The coordinator preserves evidence and evaluates protocol compliance; it does not repair either role's work.

## Identity and source

- [ ] Run ID matches the repository format: exactly four digits (`0001`, `0002`, ...).
- [ ] Behavior specification path and content hash are recorded.
- [ ] Builder, adversary, prompt, model, settings, tools, and environment are recorded.
- [ ] Implementation and executable artifact identifiers or hashes are recorded.

## Isolation and ordering

- [ ] Builder used no current-run adversary material.
- [ ] Adversary strategy was saved before implementation inspection.
- [ ] Adversary received the sanitized `handoff/implementation/`, not the full builder directory.
- [ ] Builder rationale and tests remained hidden until initial findings were saved.
- [ ] Reveal was explicitly approved and initial artifacts were not overwritten.
- [ ] Any violation or uncertain ordering is recorded as a protocol deviation.

## Evidence

- [ ] Builder implementation and tests are reproducible.
- [ ] Adversary findings include reproduction steps and classifications.
- [ ] Claims of “no defect found” are scoped and do not claim proof.
- [ ] Specification gaps and implementation defects are kept distinct.
- [ ] Post-reveal corrections are additive and traceable to initial findings.
- [ ] Optional analyses such as mutation testing state their method and limits.

## Completion

- [ ] Remaining risks and threats to independence are recorded.
- [ ] Human decisions and private clarifications are recorded.
- [ ] Coordinator report is complete.
- [ ] Verdict is one of: valid run, valid pilot with limitations, or invalid/inconclusive run.
