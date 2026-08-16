# Experiment Run Record

Copy this file for each run. Do not overwrite earlier runs when the specification, prompts, models, tools, or implementation change.

## Identity

- **Run ID:** 0001
- **Date:** 2026-08-16
- **Experiment:** Wallet (experiments/wallet)
- **Coordinator:** Dmitry Stepanov
- **Status:** completed — set by the coordinator 2026-08-16, after the builder stage, the adversary pre-reveal stage, the reveal, and post-reveal mutation testing. The reverse pairing recorded under Human decisions (3) is a **follow-up run**, not outstanding work in this one; this run's conclusions stand with the limits stated under Outcome.

## Source

- **Behavior specification:** `experiments/wallet/README.md` — "Candidate behavior" section.
- **Specification version or content hash:** sha256 `0b93a471b9a3b726e2bd255646c4ab0d3b8f406f91b6c1aa26d55b0ca09ccef6` (README.md at run start)
- **Known ambiguities at start:** currency, numeric representation, authorization, idempotency, concurrency, persistence, error semantics (all named "deliberately unresolved" by the spec). See `builder/assumptions.md` for how each was minimally handled.

## Builder

- **System prompt version or content hash:** `agents/builder.system.md`, sha256 `49c28d29db30da9f9ec34facab3c90d6e4ea230899b51e0c382089df4ae10dbb`
- **Model and settings:** Claude Opus 4.8 (1M context), model id `claude-opus-4-8[1m]`, via Claude Code CLI. Default settings.
- **Tools and dependencies:** Claude Code (Read/Write/Edit/Bash). Runtime: Node.js v25.5.0 (native TypeScript type stripping). **No third-party dependencies.** Test runner: built-in `node:test`.
- **Execution environment:** macOS (Darwin 25.5.0), arm64. Node v25.5.0, npm 11.8.0.
- **Inputs provided:** Run ID `0001`; behavior spec (`experiments/wallet/README.md`); protocol (`RUN.md`); builder system prompt. No adversary material inspected.
- **Implementation identifier or content hash:** `builder/implementation/wallet.ts`, sha256 `3e063eb15ee43e2fa4be35ecb1a2b131868619bb5758959bbeca2c9e4e0ac431`
- **Executable artifact identifier or content hash:** No compiled artifact — `wallet.ts` is executed directly by Node's type stripping. Tests: `builder/tests/wallet.test.ts`, sha256 `315db1cc463d43f8b6f70499e269b04159d339689980b8fe4be679ce955c92ac`. Test result at build time: 15 pass / 0 fail (`builder/tests/test-output.txt`).
- **Assumptions reported:** 10 assumptions (A1–A10) documented in `builder/assumptions.md`, covering numeric representation, large-amount/overflow policy, zero/negative handling, idempotency, concurrency, persistence, authorization, error semantics, and out-of-scope features. Evidence map in `builder/evidence.md`.

## Adversary

- **System prompt version or content hash:** `agents/adversary.system.md`, sha256 `06e729d2556ed3bccfcd4ab49f791db18a0c531328c80e20c6e61140b1ac892e`
- **Model and settings:** Claude Opus 5 (1M context), model id `claude-opus-5[1m]`, via Claude Code CLI. Default settings; no plan mode; no subagents, workflows, or web access used.
- **Tools and dependencies:** *Pre-reveal and reveal stages:* Read, Write, Edit, Bash only. Node.js v25.5.0 built-ins (`node:test`, `node:assert/strict`) with native TypeScript type stripping. No third-party libraries. Hand-rolled seeded mulberry32 PRNG for fuzzing (no `fast-check`). *Post-reveal mutation-testing stage (added 2026-08-16, coordinator-approved):* **Stryker Mutator `@stryker-mutator/core` 10.0.0** with the built-in `command` test runner, npm 11.8.0, executed in an isolated scratch workspace. Full dependency tree in `adversary/post-reveal/mutation-testing/logs/environment.txt`.
- **Execution environment:** macOS (Darwin 25.5.0), arm64. Node v25.5.0. Working dir `experiments/wallet/runs/0001/adversary`.
- **Inputs provided:** run ID `0001`; behavior specification `experiments/wallet/README.md` (sha256 `0b93a471b9a3b726e2bd255646c4ab0d3b8f406f91b6c1aa26d55b0ca09ccef6`); protocol `experiments/wallet/RUN.md`; setup `experiments/wallet/claude/CLAUDE.md`; artifact path `runs/0001/builder`.
- **Initial test strategy created before builder rationale was revealed:** **yes** — `adversary/strategy.md` was written and saved before any builder file was opened. Only the run-root directory listing (`ls`, names only) preceded it.
- **Builder material revealed later, and when:** **Revealed 2026-08-16, after `strategy.md` and `findings.md` were complete and saved.** Sequence, preserved as evidence of isolation:
  1. *Pre-reveal.* `adversary/strategy.md` written first, from `README.md` alone. Then `builder/implementation/{wallet.ts, README.md, package.json}` only; `adversary/findings.md` produced from that. `builder/assumptions.md`, `builder/evidence.md`, and all three files under `builder/tests/` remained unopened, as did the `## Builder` section of this file.
  2. *Reveal.* Coordinator approved. All five withheld builder files read; `adversary/post-reveal-review.md` produced. `strategy.md` and `findings.md` left unmodified.
  3. *Post-reveal mutation testing.* Coordinator approved. `adversary/post-reveal/mutation-testing/` produced. `strategy.md`, `findings.md`, and `post-reveal-review.md` all left unmodified.

## Findings

Full detail, reproduction steps, and evidence: [`adversary/findings.md`](adversary/findings.md).
Adversary suite: 80 tests, 80 passing (`adversary/evidence/test-output.txt`). Ambiguity/misuse probe: `adversary/evidence/probe-output.txt`.

| ID | Claim challenged | Classification | Severity |
|----|------------------|----------------|----------|
| A-1 | S1 / configuration integrity — constructor options are read through the prototype chain, so an inherited `initialBalance` configures a **no-argument** `new Wallet()` and mints balance. Variant A-1b: an inherited `maxBalance` of `0n` silently freezes deposits. Variant A-1c: S1 itself is **not** defeated — an injected negative value still throws `RangeError`. | implementation defect | medium |
| A-2 | S5 "concurrent operations have explicit outcomes" — per-operation atomicity holds (verified: 200 async agents × 200 ops, no lost update, no negative balance) but is **undeclared**, and compound check-then-act across an `await` is racy. Demonstrated, not asserted. | specification gap | medium |
| A-3 | S5 concurrency scope — `structuredClone(wallet)` yields `{}`, so a Wallet cannot cross a `worker_threads` boundary. Limit undeclared. | specification gap | low |
| A-4 | S5 "explicit outcomes" / persistence — `JSON.stringify(w.deposit(100n))` throws `TypeError: Do not know how to serialize a BigInt`. The documented result object cannot be transported, logged, or persisted. A-4b: `balance() === 100` is always false; `balance() * 1.5` throws. | specification gap | medium |
| A-5 | Stated vs. observable behavior — the implementation README promises `RangeError` for structurally invalid configuration; `new Wallet(null)` throws a raw `TypeError` from the property read at `wallet.ts:68`, before the guard is reached, and leaks an internal option name. | implementation defect | low |
| A-6 | Configuration validation — every non-null primitive (`"nope"`, `5`, `true`, `7n`, `[]`, functions) is silently accepted as an options object and yields a default wallet. A-6b: a misspelled key (`intialBalance`) is silently dropped. Under Node type stripping there is **no** compile-time check to catch this. Three malformed arguments produce three different behaviors. | implementation defect | low |
| A-7 | S5 "repeated operations" — resolved to compounding; no request id, nonce, or dedup surface anywhere in the public API. "Repeated" vs. "retried" is left undecided by the specification. | specification gap | medium |
| A-8 | All seven deliberately-unresolved questions are resolved by the artifact; **three are declared** (numeric representation, error semantics, the invented `2^63-1` ceiling — each with rationale) and **four are resolved by silence** (currency, authorization, idempotency, persistence). Notably, the artifact did **not** invent a complete wallet product, which is the failure mode `RUN.md` § Current scope was designed to detect. | specification gap | high (against the spec) |
| A-9 | S1, S2, S3, S4, S6 — **no defect found.** Survived 60,000 seeded model-based fuzz operations compared against exact bigint arithmetic after every operation; full boundary sweeps of `withdraw(k)` and `deposit(k)`; 18 rejection paths snapshot-checked against all observable state; 100k-deposit drift test; `2^53+1` exactness; encapsulation, aliasing, subclass-override, TOCTOU-getter, and coercion-re-entrancy probes. `bigint` minor units make S6 structurally rather than accidentally true; validate-then-mutate ordering makes S4 hold by construction; `typeof` dispatch with no coercion closes the hostile-`valueOf` re-entrancy class entirely. | no defect found | — |

## Post-reveal analysis

Added after the coordinator-approved reveal. **No pre-reveal artifact was altered** — `adversary/strategy.md`, `adversary/findings.md`, and `adversary/post-reveal-review.md` are unmodified, and no original finding was retroactively changed.

### Stage 1 — reveal and coverage comparison

Full detail: [`adversary/post-reveal-review.md`](adversary/post-reveal-review.md).

- **Headline correction.** Finding **A-8 was materially wrong** and is corrected there, not rewritten in place. Pre-reveal the adversary judged that four of seven deliberately-unresolved questions were "resolved by silence" (severity high). `builder/assumptions.md` in fact discloses **all ten** ambiguities, tagged `[SPEC-SILENT]`/`[SPEC-VAGUE]`, each with rationale, risk, and often the alternative not taken. **Severity high → low.** The error was structural: silence was inferred from an absence the protocol had instructed the adversary not to inspect.
- **Corrected answer on silent resolution:** on the wallet domain the builder resolved **nothing** silently. Two assumptions actively invite attack (A3: *"a live disagreement, not a settled fact"*; A6: *"the adversary should treat that as an open gap"*), and `evidence.md` names its own C5f concurrency mapping as "the weakest mapping." Silent resolution is confined to the **configuration and host-language boundary** (options-object contract, prototype-chain lookup, `bigint`/JSON interoperability, the `===` hazard).
- **Revised severities:** A-1 medium (strengthened); A-2 medium → low-medium; A-3 low → informational; A-4 medium (unchanged); A-5 low → low-medium; A-6 low → low-medium; A-7 disclosure claim withdrawn, spec gap retained; A-8 high → low; A-9 unchanged.
- **Ten independent convergences** between builder and adversary recorded — the central evidence for the independence threat below.
- **Four disagreements preserved unresolved** (D-1 `maxBalance` ceiling reject-vs-accept; D-2 whether the constructor is in the specification's scope; D-3 zero-deposit reject-vs-no-op; D-4 whether disclosure in `assumptions.md` discharges the obligation when only `implementation/` ships).

### Stage 2 — mutation testing

Full detail: [`adversary/post-reveal/mutation-testing/comparison.md`](adversary/post-reveal/mutation-testing/comparison.md); method, configuration, timeouts and exclusions in the sibling [`README.md`](adversary/post-reveal/mutation-testing/README.md).

- **Tool:** Stryker Mutator `@stryker-mutator/core` **10.0.0**, `command` test runner, Node.js v25.5.0, macOS Darwin 25.5.0 arm64. A third-party mutator was used deliberately: the adversary authored one of the two suites under test, so an independently-generated mutation set removes the bias of grading one's own tests against self-chosen faults.
- **System under test:** unchanged `wallet.ts` sha256 `3e063eb15ee43e2fa4be35ecb1a2b131868619bb5758959bbeca2c9e4e0ac431`. Both suites and the implementation were copied byte-identically (sha256-verified) into a scratch workspace preserving the relative layout, so no import path or test file was modified.
- **Mutation set:** 88 mutants, all Stryker default mutators, **no exclusions** (`StringLiteral` mutants deliberately kept — 4 of the 5 survivors are message-path mutants, so excluding them would have inflated both scores). Set identity across the two runs was **verified programmatically**, not assumed: `mutation sets identical: true (88/88)`. Configs differ only in test command, report path, temp dir, and a comment.
- **Timeouts:** `timeoutMS` 30000, `timeoutFactor` 4 — roughly 100× the measured baselines (0.315 s builder, 0.220 s adversary). **0 timeouts** in both runs. `coverageAnalysis: "off"`, so every mutant ran the full suite and no mutant was skipped for lack of coverage.

**Mutation scores, reported separately:**

| Suite | Tests | Killed | Survived | Timed out | Invalid | Suspected equivalent | Raw score | Adjusted score |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| **Builder** (`builder/tests/`) | 15 | 66 | 22 | 0 | 0 | 1 | **75.00 %** | **75.86 %** |
| **Adversary** (`adversary/tests/`) | 80 | 83 | 5 | 0 | 0 | 1 | **94.32 %** | **95.40 %** |

Raw = killed/88. Adjusted = killed/87, excluding the one suspected equivalent mutant. Invalid and equivalent mutants are **not** counted as evidence of test weakness.

**Cross-classification (same 88-mutant set):**

| Bucket | Count |
|---|--:|
| Killed by **both** suites | 66 |
| Killed by **builder tests only** | **0** |
| Killed by **adversary tests only** | 17 |
| Killed by **neither** | 5 (1 suspected equivalent + 4 genuine) |

**Audits performed before any survivor was called test weakness:**

- *Invalid-mutant audit* — all 88 mutants reconstructed from `(source, location, replacement)`, written to disk and dynamically imported. **88/88 load cleanly; 0 invalid.** No kill in either run is spurious. (With the `command` runner a mutant that fails to load would exit non-zero and be misreported as killed, so this check was necessary rather than decorative.)
- *Equivalence audit* — each survivor differentially executed against the original over 18 constructor configurations × 33 amount values × 2 operations, comparing thrown type, thrown **message**, `balance()`, `maxBalance`, and every returned result object. Verdicts: **1 suspected equivalent, 4 genuine (all message-text-only), 0 genuine behavioral.**

**Findings from mutation testing:**

- **The builder suite is a strict subset in fault-detection terms** — `builder-only = 0`. This mechanically confirms `post-reveal-review.md` § 5, which reached the same conclusion by inspection.
- **The gap is one region, not a spread.** Builder kills 100 % of `deposit()` mutants, 100 % of `#reject()`, 100 % of `balance()`, 89 % of `withdraw()`, 92 % of `toIntAmount()` — and **45 % of the constructor**, which holds 31 of 88 mutants. **13 of the 17 adversary-only kills are in the constructor.** This quantifies `post-reveal-review.md` § 1: the one region `evidence.md` row C1 cites as evidence for the balance-never-negative claim is the region no builder test exercises.
- **A one-token mutation defeats S1 undetected by the builder suite.** With the line-73 guard mutated to `if (false)`, `new Wallet({ initialBalance: -1n })` succeeds and the wallet opens at a **negative balance** — violating the specification's strongest claim — while all 15 builder tests stay green. Caught by the adversary suite.
- **New finding neither role had previously identified:** `withdraw()`'s `INVALID_AMOUNT` path is never exercised by the builder suite. Builder tests 8 and 9 iterate malformed inputs but call `deposit` only; tests 6 and 7 call `withdraw` with `0n`/`-5n`, which take the `NON_POSITIVE_AMOUNT` branch. Mutating the line-115 guard makes every malformed withdrawal return the wrong error code, undetected. This surfaced only under mutation testing — not in construction, not in the pre-reveal attack, not in the reveal review.
- **Shared gap in both suites:** all 4 genuine survivors are constructor error-message mutants. Neither suite asserts *which* `RangeError` was raised, only that one was.
- **Two implementation redundancies observed** (neither a defect): the `typeof amount === "number"` guard is logically dead, because `Number.isSafeInteger` never coerces and so returns `false` for every non-number — this is the suspected equivalent mutant; and the negative-`maxBalance` guard is fully covered downstream by `initial > max`, so removing it changes only the error message.
- **Not an apples-to-apples comparison, and not presented as one:** 80 adversary tests against 15 builder tests, written after inspecting the implementation, by the agent authoring the analysis. The builder's stated goal (`evidence.md`) was to *map* where each claim is realized, explicitly **not** to prove correctness. Against that goal, 75 % from 15 illustrative tests is not a failure.

## Outcome

- **Remaining untested risks:** *(updated after both post-reveal stages; items 6 and 7 are now closed and marked as such rather than deleted, so the progression stays visible)* — (1) concurrency tested only as single-isolate async — no true parallelism, worker threads, or adversarial scheduler; absence of an observed race is not absence of a race. **Mutation testing does not reduce this risk**: Stryker's default operators inject no concurrency faults, so the adversary's 95.40 % score says nothing about A-2/A-3. (2) Fuzz depth of 60k ops across 6 seeds is shallow for a value-handling component; a shrinking property-based library would be a stronger instrument. (3) No durability testing — the artifact has no persistence, so every S6 conclusion must be re-derived if persistence is added, especially given A-4. (4) No `tsc` pass; runtime behavior only, and the artifact executes under type stripping where TS annotations are erased. (5) Memory/DoS cost of astronomically large `bigint` amounts not characterised. (6) ~~Builder tests unread, so no coverage comparison is possible yet.~~ **Closed** at reveal (`post-reveal-review.md` § 5) and quantified by mutation testing. (7) ~~Neither suite mutation-tested, so neither is known to be capable of failing.~~ **Closed** — both suites now scored; both demonstrably detect injected faults. (8) *New:* mutation testing measures fault detection, not specification conformance — a suite can score highly while asserting the wrong behavior. (9) *New:* only the implementation was mutated; neither suite's own correctness was tested, so a test asserting something false would not surface. (10) *New:* single mutation tool, single run, no cross-check against a second engine.
- **Correction to `post-reveal-review.md` § 8 (recorded here because that file must not be overwritten):** it states *"Both roles are Claude Opus 5."* **This is wrong.** The `## Builder` section of this record shows the builder ran **Claude Opus 4.8 (1M context)** (`claude-opus-4-8[1m]`); the adversary ran **Claude Opus 5 (1M context)** (`claude-opus-5[1m]`). The adversary asserted this without checking, having deliberately left the `## Builder` section unread during the pre-reveal and reveal stages — a defensible protocol choice that produced an unchecked factual claim. The substance of § 8 is unaffected: both roles are Claude models from the same vendor and family, sharing training lineage and priors, so correlated blind spots remain the dominant threat. The ten convergences are, if anything, **more** notable for having occurred across two different model versions rather than one.
- **Correlated assumptions or threats to independence:** **High and unresolved.** Both roles are Claude models (Opus 4.8 builder, Opus 5 adversary — see correction above) reading the same `README.md`. Two concrete signals: the adversary strategy predicted "integer minor units or Decimal" and the artifact chose exactly that; and the strategy's table of unresolved questions aligns closely with the artifact's set of resolutions. The findings most likely to be genuinely independent are A-1 and A-5/A-6, which emerged from probing rather than from the pre-written plan. The findings least likely to be independent are the S5/ambiguity gaps, which the shared README primed both roles to consider. **The reverse pairing (Codex builder / Claude adversary) should be run before "no defect found in S1–S4/S6" is treated as meaningful.** Note that this run already used two *different Claude versions* and still produced ten convergences, which suggests version diversity within one family is not sufficient mitigation — a different vendor is needed.
- **Human decisions:** (1) Reveal of builder rationale and tests — **approved and executed 2026-08-16**, after `strategy.md` and `findings.md` were complete. (2) Mutation testing as post-reveal analysis — **approved and executed 2026-08-16**, with the constraint that originals not be modified and that invalid/equivalent mutants not count as test weakness; both constraints met. (3) *Still pending:* whether to run the reverse pairing (Codex builder / Claude adversary), which remains the single highest-value next step.
- **Specification revisions proposed:** seven, ordered by ambiguity removed, in `adversary/findings.md` § "Proposed specification revisions". The highest-value four: define "concurrent operation"; distinguish "repeated" from "retried"; require a per-question declaration block so silent omissions become visible decisions; and constrain the configuration/construction boundary, which S1–S4 do not govern at all. **Post-reveal, revision 3 should be narrowed:** the builder *did* produce a full declaration block, so the residual problem is **placement**, not omission — ten of ten assumptions live in `assumptions.md`, only three reach `implementation/README.md`, and `implementation/` is the natural unit of delivery. The revision should require the declaration block to ship **with the code**. **Two protocol revisions added post-reveal:** (a) require mutation testing of every submitted suite, since it produced evidence (the `withdraw` invalid-amount gap) that careful reading by two independent roles did not; (b) require the constructor/configuration boundary to be tested whenever it is cited in an evidence map, which `evidence.md` row C1 does while no builder test exercises it.
- **Evidence made stale by later changes:** the implementation was never modified, so no test evidence is stale — all of it remains bound to `wallet.ts` sha256 `3e063eb15ee43e2fa4be35ecb1a2b131868619bb5758959bbeca2c9e4e0ac431`, and any edit invalidates both suites and the mutation results, which must then be re-run. **Superseded rather than stale:** finding A-8 as written pre-reveal (severity high, "four questions resolved by silence") is corrected in `post-reveal-review.md`; `findings.md` is deliberately left unedited so the pre-reveal reasoning stays inspectable alongside its correction. The adversary-suite mutation score is bound to the four `*.test.ts` files at the sha256 values recorded in the mutation-testing README.
- **Conclusion and its limits:** The six specification bullets could not be falsified. Three implementation defects were found, all at the configuration boundary — which the specification does not govern — and none can drive the balance negative. Mutation testing sharpened this: that same boundary is where a **one-token mutation opens a negative-balance wallet with all 15 builder tests still green**, so it is undertested as well as unspecified. The result against the **specification** stands but for a corrected reason: not that the builder hid its choices — it disclosed all ten, and that discipline was the strongest part of the run — but that the specification forced ten judgment calls and provides no mechanism requiring them to travel with the code, while S5's concurrency and repetition clauses remain untestable as written. This is the outcome `README.md` § Success criteria asks for: the run exposed where behavior is ambiguous and produced reproducible challenges. **Limits:** one adversary, one strategy, one pass, same model family as the builder; ten independent convergences between the two roles make correlated blind spots the dominant threat, and every adversary-unique finding sits at the host-language layer rather than in the wallet domain. Mutation scores measure fault detection, not correctness. Finding no defect is evidence from this run, not proof of correctness. **The reverse pairing should be run before this run's negative result is treated as meaningful.**
