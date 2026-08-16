# Post-Reveal Correction — Wallet, Run 0002

**Issued:** 2026-08-16, after the coordinator supplied a factual correction.

**Scope:** this document corrects `adversary/post-reveal-review.md` §8 and the
conclusions that depend on it. Per the coordinator's instruction,
`strategy.md`, `findings.md`, and `post-reveal-review.md` are **unmodified**;
this file supersedes the specific claims identified below and should be read
alongside them.

---

## 1. The incorrect claim, precisely identified

**Location:** `post-reveal-review.md` §8, first bullet, opening sentence.

**Claim as written:**

> **Same model family, and it shows.** Both roles were Claude (adversary: Claude
> Opus 5, 1M context, `claude-opus-5[1m]`). `RUN.md` recommends different systems
> for the two roles; this run did not do that.

**Both sentences are false.** The builder was not Claude, and the run *did*
follow `RUN.md`'s recommendation to use different systems for the two roles.

Three further statements inherit the error and are retracted with it:

- §8, same bullet: "Independently derived test suites should not align that
  closely. Every 'no defect found' result in `findings.md` should be discounted
  accordingly — we plausibly share the blind spot rather than having jointly
  excluded a defect."
- §8, second half of that bullet: the "supporting evidence for the shared-blind-spot
  reading" argument, which reads §6.2/§6.4/§6.5/§6.6 as proof that "both roles
  reasoned about the domain well and about the runtime poorly, **in the same way**."
- **Recommended additions to the coordinator report, item 5:** "Independence was
  weak and the near-identical test coverage is the measured proof. Re-run with
  different systems per role before treating any 'no defect found' as
  meaningful." The prescribed remedy had already been applied.

Note for the record that the pre-reveal documents did **not** contain this error.
`strategy.md` §5 says "I share a model family with the builder **if** the run
pairs Claude with Claude," and `findings.md` says "**if** the builder was also a
Claude model." Both are correctly conditional. The error was introduced only in
the post-reveal review, by dropping a hedge that had been properly stated twice.

---

## 2. Verified systems

Verified against `runs/0002/run-record.md` (read post-reveal for this correction):

| Role | System | Source of verification |
|---|---|---|
| **Builder** | **Codex based on GPT-5.** Exact backend model identifier and reasoning settings were not exposed to the builder. Adapter: `experiments/wallet/codex/AGENTS.md`. Tools: Codex `exec_command` and `apply_patch`. Shell: zsh, repository workspace-write sandbox. | `run-record.md` → Identity ("BSpec Wallet Experiment — Codex builder") and Builder → "Model and settings" |
| **Adversary** | **Claude Opus 5 (1M context)**, model id `claude-opus-5[1m]`, Claude Code CLI, default settings. Adapter: `experiments/wallet/claude/CLAUDE.md`. Tools: Read/Write/Bash. Shell: fish. | `run-record.md` → Adversary (written by me), and this session's own environment |

**The two roles were run on different vendors, different model families, and
different agent harnesses.** This run satisfies `README.md`'s guidance —
"For the strongest initial comparison, use different systems for the two roles."

---

## 3. Retraction of same-model-correlation conclusions

The following are withdrawn in full:

1. **That the run had weak independence by construction.** It did not. The
   cross-vendor pairing is the stronger of the two designs the README offers.
2. **That the 7-of-8 test overlap is evidence of a shared blind spot.** Under the
   corrected facts the overlap cannot support that reading at all — see §4.
3. **That "no defect found" results should be discounted for same-model
   correlation.** That specific discount does not apply. A weaker discount
   remains, for reasons that have nothing to do with vendor — see §5.
4. **That §6's jointly-missed cases demonstrate two Claude models failing "in the
   same way."** The cases were jointly missed; the *explanation* offered for why
   is void. A replacement reading is in §6 below.
5. **The recommendation to re-run with different systems per role.** Already
   done. The correct forward-looking recommendation is to re-run with a
   *different* pairing, or to repeat this pairing, to see whether the convergence
   reproduces.

I want to be explicit that this is a substantive retraction, not a wording fix.
§8 was the section that told the coordinator how much to trust everything else,
and it pointed in the wrong direction.

---

## 4. Reassessing the 7-of-8 overlap as cross-system convergence

The observation itself is unchanged and stands: **7 of 8 builder tests have a
direct adversary counterpart**, and in every case the adversary version is a
superset or strictly more stressful. The §5 mapping table in
`post-reveal-review.md` remains factually correct — only its interpretation
changes, and it inverts.

**Previous reading (void):** two same-family models converged because they share
priors; the convergence is a warning.

**Corrected reading:** a GPT-5-based builder and a Claude-based adversary,
working in separate sessions from the same seven-bullet specification with no
contact, independently arrived at nearly the same set of behavioral properties to
test. That is **cross-system convergence**, and it is a positive result for the
experiment's central question:

- It is evidence that **the seven bullets are specific enough to induce a
  reproducible test agenda** across independent implementations of "an agent."
  What each role chose to test was driven substantially by the specification
  rather than by the model reading it. For a project asking whether behavior
  specifications can carry meaning between systems, this is close to the result
  BSpec would want.
- It correspondingly **raises** confidence in the "no defect found" verdicts for
  C1–C7, since two differently-built agents probed the same properties and
  neither found a violation under ordinary inputs.
- The persistent *depth* difference — the adversary's counterpart was broader or
  more stressful in all seven cases — is now attributable to **role**, not
  vendor. The builder wrote construction evidence (and labelled it as such:
  "Tests are construction evidence only, not proof of correctness"); the
  adversary wrote falsification evidence. That is the division of labour the
  protocol asked for, and it worked.

**What the convergence does not show.** It does not show that the two systems
have non-overlapping blind spots, and it is not proof that the specification is
complete. Convergence on *what to test* says nothing about the region neither
system thought to test — which is precisely §6 of the review, and which the
corrected facts make more interesting rather than less.

---

## 5. Shared-environment limitations that survive the correction

Different vendors reduce correlated-blind-spot risk. They do not eliminate it,
and several correlations in this run are untouched by the builder's identity:

- **Identical specification text.** Both roles read the same
  `experiments/wallet/README.md` (SHA-256 `0b93a471…`). Any ambiguity, omission,
  or framing bias in those seven bullets applies to both roles equally. This is
  by design — it is the experiment's controlled variable, not a flaw — but it
  means neither role could catch a defect the specification steers *both* away
  from.
- **Same repository framing.** Both adapters (`codex/AGENTS.md`,
  `claude/CLAUDE.md`) derive from the same experiment definition and shared
  prompts, and `RUN.md` states the adapters are "intentionally thin." Both roles
  inherited the same framing of what a wallet is and what counts as evidence.
- **Same machine.** Darwin 25.5.0, arm64, one host. Confirmed independently:
  the builder's `evidence.md` reports the same `python3` version split I observed
  (3.14.5 in the adapter directory, 3.9.6 in the run directory).
- **Same Python runtimes.** Apple CPython 3.9.6 and Homebrew CPython 3.14.5, both
  **GIL-enabled**. Neither role could have tested a free-threaded build; that
  jointly-missed case (§6.4 of the review) is an environment limit, not a
  reasoning failure by either agent.
- **Same tool constraints.** Standard library only, no property-testing or
  fuzzing library on either side, no `Hypothesis`, no thread-sanitizer, no
  race-detection instrumentation. Both roles hand-rolled generation; neither had
  a tool that would have surfaced §6.6 (read linearizability).
- **Same task-level constraints.** Both roles were told the artifact is small and
  inspectable, and both were operating under time and scope expectations set by
  the same run sheet.
- **Overlapping pretraining corpora — the deepest residual correlation.** GPT-5
  and Claude Opus 5 are different models from different vendors, but both are
  LLMs trained on largely overlapping public text. The canonical wallet/ledger
  test idioms — overdraw-by-one, concurrent-withdrawal races, `0.1 + 0.2` — are
  well-represented in that shared corpus. Vendor diversity does not buy
  independence from a shared training distribution, and I would not claim it
  does. This is my best explanation for the convergence in §4, and it is also the
  reason the convergence should be read as *encouraging* rather than *conclusive*.
- **Single coordinator, single run.** One human framed both sessions, and n = 1.

**Net position:** independence in this run was **better than I claimed but weaker
than "independent."** The correct discount on "no defect found" is smaller than
§8 asserted and larger than zero.

---

## 6. Which other sections of the post-reveal review change

| Section | Status |
|---|---|
| §0 — handoff protocol destroyed the disclosure | **Unchanged.** A protocol-mechanics finding; independent of who built the artifact. |
| §1 — findings confirmed/weakened/contradicted | **Unchanged.** F1–F3 confirmed, F4–F8/F11 contradicted, all on the basis of `assumptions.md` and `tests/` content, not authorship. The preserved disagreement about what "atomic" means also stands. |
| §2 — assumptions properly disclosed (11 for 11) | **Unchanged**, and now attributable to a Codex/GPT-5 builder. Worth recording as a positive cross-system data point: the disclosure discipline `RUN.md` hopes to elicit was produced by a system other than the one evaluating it. |
| §3 — gaps found independently by both roles | **Strengthened.** The joint idempotency finding — adversary from bullet C5 contradicting the prose, builder from "no operation IDs exist to key on" — is now a **cross-vendor** convergence on the same specification defect. This was already the run's strongest result; it is stronger than the review states. Items 2–5 gain the same lift. |
| §4 — adversary-only findings | **Unchanged.** F1/F2/F3 and the precision-coverage gap in `evidence.md` are properties of the artifact and its documents. |
| §5 — overlap table | **Table unchanged; interpretation inverted.** See §4 above. |
| §6 — cases missed by both | **Observations unchanged; the explanation in §8 is void.** New reading: two systems from different vendors, given the same spec and the same toolchain, both missed the same four mechanism-level risks (unpicklable `Wallet`, no-GIL builds, real signal delivery, read linearizability). Two of the four (no-GIL, linearizability tooling) are environment limits neither role could have overcome here. The remaining two suggest the gap tracks **the specification's framing and the role definitions**, which are shared, rather than any model's habits. That is a more useful finding for BSpec than the one it replaces: it points at the spec, not the models. |
| §7 — silent resolution: domain vs mechanism | **Unchanged, and more interesting.** The pattern — the builder audited the specification's named ambiguities thoroughly and its own code's emergent ambiguities not at all — was a claim about one builder's behavior. It now describes a GPT-5-based builder, and §6's corrected reading suggests the same domain/mechanism asymmetry showed up on the adversary side too. A cross-vendor pattern is more plausibly a property of specification-driven agent work in general. **Stated as a hypothesis from n = 1, not a conclusion.** |
| §8 — limits from shared models/systems/context/tools | **Superseded by §5 of this document.** |
| Coordinator recommendations 1–4 | **Unchanged** (handoff protocol; three standing defects; idempotency revision first; `evidence.md` overclaims on precision). |
| Coordinator recommendation 5 | **Retracted and replaced:** independence was reasonable by design. Report the 7-of-8 overlap as cross-system convergence. Residual correlations are environmental and corpus-level (§5), not vendor-level. |

---

## 7. How the incorrect builder identity was inferred

An honest account, because the failure mode matters more than the fact.

**I did not verify it. I assumed it, then treated my own observation as
confirmation.** The chain:

1. **Adapter-directory over-generalisation.** My session was launched from
   `experiments/wallet/claude/` under `claude/CLAUDE.md`. I generalised from "my
   adapter is the Claude one" to "this run is Claude-to-Claude." The repository
   contains a sibling `codex/` adapter, and `README.md` explicitly describes the
   two-adapter design; nothing supported the leap.
2. **Circular use of the overlap.** I observed the 7-of-8 test overlap, generated
   "same model family" as an explanation, and then wrote that the overlap was the
   "**measured proof**" of it. The overlap was the *only* evidence, and I reasoned
   backwards from an effect to a cause and then cited the effect as
   corroboration. This is the actual error; the wrong vendor is downstream of it.
3. **Dropping a hedge I had already written twice.** `strategy.md` §5 and
   `findings.md` both stated the correlation risk conditionally ("if the builder
   was also a Claude model"). Those hedges were correct. At the post-reveal stage,
   with more information in hand, I stated the conditional as fact — the reveal
   increased my confidence about the builder's *reasoning* and I let that
   confidence spill onto its *identity*, which the reveal said nothing about.
4. **Available disconfirming evidence I read and did not weigh.** The builder's
   `evidence.md` — which I had read in full — reports "the configured interactive
   **zsh** startup emitted `(eval):5: parse error near 'end'`." My own environment
   is **fish**. A different shell environment was a direct signal of a different
   harness, sitting in a document I had already quoted from. I noticed the
   diagnostic (I cited the same file's `python3` version split as corroboration in
   §3 of the review) and did not draw the inference.
5. **Available confirming evidence I never looked at.** `run-record.md` states
   the answer twice — Identity: "BSpec Wallet Experiment — **Codex builder**", and
   Builder → Model and settings: "**Codex based on GPT-5**". Pre-reveal I
   deliberately avoided reading that file, and inserted my Adversary section
   programmatically to preserve isolation; that was correct at the time.
   **Post-reveal, the isolation constraint was lifted and I never went back.** I
   wrote a section specifically about the two roles' systems without opening the
   file whose purpose is to record them, in the same directory, which I had
   already written to.

**Procedural lesson for the protocol:** the run record is the authority on role
metadata, and an adversary writing a post-reveal independence assessment should
be required to read the Builder section first. The isolation rule that correctly
withholds it pre-reveal has no force afterwards, and I carried the habit past its
expiry. Recommend adding this to `agents/coordinator-checklist.md` as a reveal-stage
verification step: **confirm both roles' systems from `run-record.md` before any
correlation analysis is written.**

---

## 8. Corrected bottom line

Run 0002 paired a **Codex/GPT-5 builder** with a **Claude Opus 5 adversary** —
the cross-system design `README.md` recommends. Two independently-built agents,
reading the same seven-bullet specification without contact, converged on nearly
the same test agenda and independently identified the same specification defect
(idempotency is unspecifiable without operation IDs). The three defects the
adversary found (F1, F2, F3) and the builder's 11-for-11 disclosure record are
unaffected by this correction.

Correlated-blind-spot risk is **reduced, not eliminated**: both agents are LLMs
with overlapping training data, reading one specification, on one machine, with
one toolchain, in one run.
