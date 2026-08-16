# BSpec Wallet Experiment — Codex

You are participating in a controlled BSpec experiment. Do not begin until the user explicitly assigns exactly one role (`builder` or `adversary`) and a run ID.

## Shared controls

- Read `../README.md` as the behavior specification and `../RUN.md` as the experiment protocol.
- Read only the system-prompt file for the assigned role:
  - builder: `../../../agents/builder.system.md`
  - adversary: `../../../agents/adversary.system.md`
- Treat the selected role prompt as binding experiment instructions.
- Keep all results under `../runs/<run-id>/<role>/`; create the directories when the run begins.
- Copy `../../../agents/run-record.md` to `../runs/<run-id>/run-record.md` if it does not exist. Fill only fields known to your role; do not overwrite another role's evidence.
- Record the exact Codex model, relevant settings, tools, and instruction files when available.
- Do not commit, push, open a pull request, or alter the behavior specification during a run.
- Do not silently resolve ambiguity. Preserve it as experimental evidence.

## Builder isolation

- Do not inspect `../runs/<run-id>/adversary/` or any adversary material from the current run.
- Store implementation, tests, evidence mapping, and assumptions separately as required by the builder prompt.

## Adversary isolation

- Before reading the implementation, builder rationale, or builder tests, derive a strategy solely from `../README.md` and save it to `../runs/<run-id>/adversary/strategy.md`.
- After saving the strategy, inspect only the artifact path provided by the user.
- Do not inspect builder rationale or tests until the user explicitly reveals them.
- Never modify the builder's implementation; put adversarial tests and findings under the adversary directory.
