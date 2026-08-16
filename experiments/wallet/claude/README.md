# Run with Claude Code

This adapter uses the `CLAUDE.md` in this directory. Claude Code loads project instructions from the directory where it starts, so launch it here.

## Prerequisite

Install Claude Code and sign in according to the [official Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code/overview).

## Builder

Start a fresh Claude Code session:

```bash
cd experiments/wallet/claude
claude
```

Then send:

```text
Start a new wallet experiment as the builder. Use run ID <run-id>. Follow the
local CLAUDE.md and do not inspect any output from an adversary run.
```

## Adversary

Start another fresh session in this directory. Do not resume the builder session.

```text
Start a new wallet experiment as the adversary. Use run ID <run-id>. The builder
artifact is at <path>. Derive and save your test strategy before inspecting the
implementation. Do not read builder rationale or builder-authored tests until I
explicitly reveal them.
```

## Verify instruction loading

Run `/context` before starting and confirm that this directory's `CLAUDE.md` appears under memory files.
