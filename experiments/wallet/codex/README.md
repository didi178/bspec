# Run with Codex

This adapter uses the `AGENTS.md` in this directory. Codex loads project instructions from the repository root down to the current working directory, so start it here rather than at the repository root.

## Prerequisite

Install Codex and sign in according to the [official Codex documentation](https://developers.openai.com/codex/).

## Builder

Prepare the next run from the repository root, then start a fresh Codex session:

```bash
./experiments/wallet/run.sh prepare-run 0002
cd experiments/wallet/codex
codex
```

Then send:

```text
Start a new wallet experiment as the builder. Use run ID 0002. Follow the
local AGENTS.md and do not inspect any output from an adversary run.
```

## Adversary

After the builder finishes, prepare the sanitized handoff from the repository root:

```bash
./experiments/wallet/run.sh prepare-handoff 0002
```

Start another fresh session in this directory. Do not resume the builder session.

```text
Start a new wallet experiment as the adversary. Use run ID 0002. Derive and save
your test strategy before inspecting ../runs/0002/handoff/implementation. Do not
read builder rationale or builder-authored tests until I explicitly reveal them.
```

After initial findings are saved, use the shared [`reveal.prompt.md`](../../../agents/reveal.prompt.md), replacing `<run-id>` with `0002`.

Codex can also be started in this directory from the Codex app. Use the same start prompts and a separate task for each role.

## Verify instruction loading

If unsure, ask Codex to list the instruction files it loaded before starting. It should include this directory's `AGENTS.md`.
