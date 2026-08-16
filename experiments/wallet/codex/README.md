# Run with Codex

This adapter uses the `AGENTS.md` in this directory. Codex loads project instructions from the repository root down to the current working directory, so start it here rather than at the repository root.

## Prerequisite

Install Codex and sign in according to the [official Codex documentation](https://developers.openai.com/codex/).

## Builder

Start a fresh Codex session:

```bash
cd experiments/wallet/codex
codex
```

Then send:

```text
Start a new wallet experiment as the builder. Use run ID <run-id>. Follow the
local AGENTS.md and do not inspect any output from an adversary run.
```

## Adversary

Start another fresh session in this directory. Do not resume the builder session.

```text
Start a new wallet experiment as the adversary. Use run ID <run-id>. The builder
artifact is at <path>. Derive and save your test strategy before inspecting the
implementation. Do not read builder rationale or builder-authored tests until I
explicitly reveal them.
```

Codex can also be started in this directory from the Codex app. Use the same start prompts and a separate task for each role.

## Verify instruction loading

If unsure, ask Codex to list the instruction files it loaded before starting. It should include this directory's `AGENTS.md`.
