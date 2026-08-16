# Reveal Stage Prompt

Replace `<run-id>` before sending this prompt. Reveal is allowed only after the adversary has saved both its initial strategy and pre-reveal findings.

```text
Reveal stage approved for run <run-id>.

You may now read these builder-authored materials:

- ../runs/<run-id>/builder/evidence.md
- ../runs/<run-id>/builder/tests/
- the Builder section of ../runs/<run-id>/run-record.md

Before writing correlation or independence conclusions, verify and quote the
builder and adversary systems from run-record.md. Do not infer system identity
from test overlap, coding style, adapter directory, or model behavior.

Do not overwrite or revise the pre-reveal strategy.md or findings.md.

Create ../runs/<run-id>/adversary/post-reveal-review.md containing:

1. which findings were confirmed, weakened, or contradicted;
2. whether the assumptions included in the handoff match the builder's declared assumptions and accurately describe the implementation;
3. gaps found independently by both roles;
4. gaps found only by the adversary;
5. builder tests that overlap with adversary tests;
6. important cases missed by both;
7. any evidence that the builder silently resolved ambiguity;
8. limits caused by shared models, systems, context, or tools, based on verified role metadata.

Preserve disagreements rather than forcing consensus. Treat all new conclusions
as post-reveal evidence and do not retroactively change initial findings.
```
