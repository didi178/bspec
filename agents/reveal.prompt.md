# Reveal Stage Prompt

Replace `<run-id>` before sending this prompt. Reveal is allowed only after the adversary has saved both its initial strategy and pre-reveal findings.

```text
Reveal stage approved for run <run-id>.

You may now read these builder-authored materials:

- ../runs/<run-id>/builder/assumptions.md
- ../runs/<run-id>/builder/evidence.md
- ../runs/<run-id>/builder/tests/

Do not overwrite or revise the pre-reveal strategy.md or findings.md.

Create ../runs/<run-id>/adversary/post-reveal-review.md containing:

1. which findings were confirmed, weakened, or contradicted;
2. which builder assumptions were properly disclosed;
3. gaps found independently by both roles;
4. gaps found only by the adversary;
5. builder tests that overlap with adversary tests;
6. important cases missed by both;
7. any evidence that the builder silently resolved ambiguity;
8. limits caused by shared models, systems, context, or tools.

Preserve disagreements rather than forcing consensus. Treat all new conclusions
as post-reveal evidence and do not retroactively change initial findings.
```
