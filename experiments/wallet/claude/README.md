# Run with Claude Code

This adapter uses the `CLAUDE.md` in this directory. Claude Code loads project instructions from the directory where it starts, so launch it here.

## Prerequisite

Install Claude Code and sign in according to the [official Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code/overview).

## Builder

Prepare the next run from the repository root, then start a fresh Claude Code session:

```bash
./experiments/wallet/run.sh prepare-run 0002
cd experiments/wallet/claude
claude
```

Then send:

```text
Start a new wallet experiment as the builder. Use run ID 0002. Follow the
local CLAUDE.md and do not inspect any output from an adversary run.
```

## Adversary

After the builder finishes, prepare the sanitized handoff from the repository root:

```bash
./experiments/wallet/run.sh prepare-handoff 0002
```

Start another fresh session in this directory. Do not resume the builder session.

```text
Start a new wallet experiment as the adversary. Use run ID 0002. Derive and save
your test strategy before inspecting any handoff file. Then evaluate
../runs/0002/handoff/implementation together with
../runs/0002/handoff/assumptions.md. Do not read builder evidence or
builder-authored tests until I explicitly reveal them.
```

After initial findings are saved, use the shared [`reveal.prompt.md`](../../../agents/reveal.prompt.md), replacing `<run-id>` with `0002`.

## Verify instruction loading

Run `/context` before starting and confirm that this directory's `CLAUDE.md` appears under memory files.
