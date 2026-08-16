# Post-Reveal Review — Run 0001 (Wallet)

**Role:** adversary · **Run ID:** 0001 · **Date:** 2026-08-16
**Stage:** post-reveal. Written after reading `builder/assumptions.md`, `builder/evidence.md`, `builder/tests/wallet.test.ts`, `builder/tests/construction-notes.md`, `builder/tests/test-output.txt`.

**Pre-reveal artifacts are unmodified.** `strategy.md` and `findings.md` are exactly as written before this material was revealed. Every correction below is recorded here and only here, so the anchoring-free record stays intact.

**Artifact still under test:** `wallet.ts` sha256 `3e063eb15ee43e2fa4be35ecb1a2b131868619bb5758959bbeca2c9e4e0ac431` — unchanged. All 80 adversary tests still pass; builder reports 15/15.

---

## Headline correction

**My finding A-8 was materially wrong, and the error was consequential.**

Pre-reveal I judged that of the seven deliberately-unresolved questions, "three are declared and four are resolved by silence," and I rated this a **high-severity specification gap**. I scoped that judgment explicitly to the implementation directory, because `assumptions.md` was withheld — which was procedurally correct but produced a conclusion that does not survive contact with the withheld file.

`assumptions.md` discloses **all ten** ambiguities, tagged `[SPEC-SILENT]` or `[SPEC-VAGUE]`, each with a rationale, a named consequence or risk, and in several cases an explicit "alternative not taken." Currency, authorization, idempotency, and persistence — the four I called silent — are A1, A8, A5, and A7 respectively. None was silent.

The honest verdict on question 7 is therefore: **on the domain, the builder did not silently resolve ambiguity anywhere.** This is close to a model result against the failure mode `RUN.md` § "Current scope" was designed to detect. I over-claimed, and the over-claim was structural: I inferred silence from an absence I had been instructed not to look into.

**What survives.** The silent resolutions are real but confined to a different layer — the **configuration and host-language boundary**, which `assumptions.md` never reaches. See § 7.

---

## 1. Findings confirmed, weakened, or contradicted

| ID | Pre-reveal claim | Post-reveal status |
|----|------------------|--------------------|
| A-1 | Prototype-chain option lookup mints balance | **Confirmed, strengthened** |
| A-2 | Concurrency clause unaddressed | **Weakened (partially anticipated)** |
| A-3 | Wallet cannot cross a thread boundary | **Weakened substantially** |
| A-4 | Result object cannot be JSON-serialized | **Confirmed** |
| A-5 | `new Wallet(null)` throws `TypeError`, not documented `RangeError` | **Confirmed, strengthened** |
| A-6 | Malformed configuration silently accepted | **Confirmed, strengthened** |
| A-7 | Repetition resolved to compounding, "undeclared" | **Contradicted on disclosure; confirmed on substance** |
| A-8 | Four of seven questions resolved by silence | **Contradicted** |
| A-9 | No defect found in S1–S4, S6 | **Unchanged** |

### Confirmed and strengthened — A-1, A-5, A-6

Nothing in `assumptions.md`, `evidence.md`, or the builder tests addresses the constructor's options object. The evidence map's C1 row cites `initialBalance < 0` throwing as evidence for S1, but **no builder test exercises any constructor rejection path** — there is no test for `new Wallet({initialBalance: -1n})`, none for `maxBalance < 0n`, none for `initial > max`. The one constructor test is "new wallet starts at zero by default."

So the constructor guards are cited as evidence for the balance-never-negative claim while being entirely untested by the builder. The adversary suite is the only thing testing them. That elevates A-1/A-5/A-6 from "hardening nits" to "the one region of the artifact with cited-but-unverified evidence," and it is exactly where the three defects live. A-5 is further strengthened: the implementation README's `RangeError` promise is now visible as the *only* statement about constructor behavior anywhere in the artifact, and it is broader than what the code delivers.

### Weakened — A-3

Assumption A6 states: *"If the spec intended true parallel access (multiple processes, shared storage), this implementation does not address it and the adversary should treat that as an open gap."* That is a direct, prior disclosure of the limit I reported. My contribution reduces to the specific mechanism — `structuredClone` drops the class and its private fields, so the barrier is concrete rather than merely conventional. **Downgrade A-3 from a specification gap to a mechanism note on a builder-disclosed limitation.**

### Weakened — A-2

A6 discloses the model honestly: single-threaded, synchronous, atomic per operation, *"sidesteps rather than solves real concurrency,"* with no locking and no transaction. `evidence.md` goes further and names C5f **"the weakest mapping"** in its own coverage caveats. The builder flagged this before I ever ran a test.

**What survives, and I hold to it:** the disclosure lives in `assumptions.md`, not in the shipped implementation README, and the specific failure shape — compound check-then-act racing across an `await` — is demonstrated nowhere by the builder. Builder test 15 is named "sequential interleaving," and `evidence.md` correctly annotates it *"models sequencing, not true parallelism."* A consumer reading only `implementation/README.md` still has no statement of the atomicity guarantee. **Downgrade from medium to low-medium; the residue is a documentation-placement issue plus a demonstrated failure shape.**

### Contradicted on disclosure, confirmed on substance — A-7

I wrote that compounding was chosen and "the artifact does not state which one it implements." Wrong: A5 states it explicitly *and* names my exact concern — *"if the intended domain needed at-most-once semantics (e.g. retried network requests), this is wrong. Flagged for the adversary."*

The builder and I independently identified the same repeated-vs-retried ambiguity. The substance of the finding stands as a **specification gap** — the spec genuinely fails to distinguish the two readings — but my characterization of it as undeclared by the builder is withdrawn.

### Contradicted — A-8

See the headline correction. **Severity drops from high to low**, and what remains is not "the builder was silent" but "the specification forced ten judgment calls, and the disclosure lives in a file separate from the shipped artifact." The second is a real but much smaller point: a consumer who receives `implementation/` alone gets three of ten disclosures, not ten.

### Unchanged — A-9

Reading the builder tests does not move the no-defect-found verdict in either direction. The builder's 15 tests are a strict subset of the adversary's coverage on every claim (§ 5), so they add no evidence I did not already have. The verdict rests on the adversary suite, and its limits are as stated in `findings.md`.

---

## 2. Builder assumptions that were properly disclosed

All ten, and the disclosure quality is high. Rated on whether the choice, the rationale, the risk, and the alternative are each present:

| # | Assumption | Choice | Rationale | Risk/consequence | Alternative named | Verdict |
|---|-----------|:--:|:--:|:--:|:--:|---|
| A1 | Integer minor units as `bigint`; unit/currency left undefined | ✓ | ✓ | ✓ | ✓ | **Exemplary** — names that `100n` could be $1.00 or ¥100 |
| A2 | `number` accepted only if `Number.isSafeInteger` | ✓ | ✓ | — | ✓ | **Strong** — rejects float coercion as "silent precision handling" |
| A3 | Inclusive `maxBalance`, default `2^63-1` | ✓ | ✓ | ✓ | ✓ | **Exemplary** — calls reject-vs-accept "a live disagreement, not a settled fact" |
| A4 | Zero and negative rejected | ✓ | ✓ | ✓ | ✓ | **Strong** — names the no-op alternative as equally defensible |
| A5 | No idempotency; repeats compound | ✓ | ✓ | ✓ | ✓ | **Exemplary** — names retried network requests as the failure domain |
| A6 | Single-threaded, synchronous, atomic | ✓ | ✓ | ✓ | — | **Strong** — "sidesteps rather than solves"; instructs the adversary to treat it as open |
| A7 | In-memory only | ✓ | ✓ | — | — | Adequate |
| A8 | No authorization or identity | ✓ | ✓ | — | — | Adequate |
| A9 | Tagged results for domain errors, `RangeError` for config | ✓ | ✓ | ✓ | ✓ | **Strong** — "another builder could justifiably throw typed errors" |
| A10 | No transfers, statements, fees, multi-currency | ✓ | ✓ | — | — | Adequate — cites the prompt's "do not add requirements merely because they are customary" |

`evidence.md` adds a **self-critical coverage-caveats section** naming C5f as its own weakest mapping, C5d and C5b as encoding contested choices, and the undefined currency unit. `construction-notes.md` reports a toolchain failure (`node --test <dir>` raising `MODULE_NOT_FOUND` on Node v25.5.0, fixed with an explicit glob) and correctly classifies it as toolchain, not implementation.

**Not disclosed anywhere** — the complement, which becomes § 7: the options-object contract, prototype-chain lookup, `bigint`/JSON interoperability, the `===` hazard, the `maxBalance` public getter, and subclass-override behavior.

---

## 3. Gaps found independently by both roles

This list is the most important output of the reveal, and it is uncomfortably long.

| Gap | Builder | Adversary | Notes |
|---|---|---|---|
| Currency/unit undefined; `100n` has no scale | A1 consequence | A-8 table, strategy §4 | Same example reached independently |
| Repeated vs. retried; no idempotency key | A5 + risk | A-7, strategy §2 | Both named retry semantics as the danger |
| Concurrency sidestepped, not solved | A6 + `evidence.md` C5f "weakest mapping" | A-2, strategy §3 | Both independently rated it the weakest bullet |
| Persistence absent | A7 | A-8 table, strategy §4 | — |
| Authorization absent; any holder may withdraw | A8 | A-8 table, strategy §4 | Near-identical phrasing |
| Error mechanism unfixed by the spec | A9 | A-8 table, strategy §4 | Both noted thrown-vs-returned is a free choice |
| Zero: reject vs. successful no-op | A4 | strategy §2 ("both defensible; *undefined* is the failure") | Both refused to call either wrong |
| "Extremely large": reject vs. accept | A3 "live disagreement" | A-8 (ceiling "invented, not requested") | **Live disagreement, preserved in §9** |
| Precision demands exact representation | A1/A2 | strategy §2/§7 P4 | Both independently chose integer-minor-units as the correct family |
| Builder tests are not a correctness proof | `evidence.md` preamble | role prompt / `findings.md` headline | Both stated it unprompted |

**Ten independent convergences.** Both roles partitioned the problem the same way, reached the same verdicts, and in several cases picked the same illustrative example. This is the central evidence for § 8.

---

## 4. Gaps found only by the adversary

Every one of these sits at the **host-language or API boundary**, not in the wallet domain. That pattern is itself a finding.

1. **A-1 — prototype-chain option lookup.** `Object.prototype.initialBalance = 1000n` makes a no-argument `new Wallet()` start at `1000n`. Variant A-1b: an inherited `maxBalance = 0n` silently freezes deposits. Untouched by any builder material.
2. **A-5 — `new Wallet(null)` throws `TypeError`, not the documented `RangeError`.** The guard is never reached; the message leaks a private option name.
3. **A-6 — every non-null primitive is accepted as configuration**, and a misspelled key is silently dropped. Under Node type stripping there is no compile-time check to catch it.
4. **A-4 — `JSON.stringify` throws on the documented result object.** The mechanism that makes outcomes "explicit" cannot be logged, transported, or persisted.
5. **A-4b — `balance() === 100` is always false** while `== 100` is true, and `balance() * 1.5` throws.
6. **No coercion re-entrancy.** I verified with a call counter that a hostile `valueOf`/`Symbol.toPrimitive` attempting to re-enter `withdraw` mid-operation is **never invoked**. The implementation is safe here by design, but the builder neither tested nor claimed it.
7. **No TOCTOU on construction.** A re-reading options getter cannot defeat the guards, because each option is read once into a local. Again safe by construction, untested by the builder.
8. **Encapsulation surface.** `Object.keys`, `getOwnPropertyNames`, `getOwnPropertySymbols`, `Reflect.ownKeys`, `JSON.stringify`, `structuredClone`, detached methods, borrowed methods, `Object.create(Wallet.prototype)`, and `maxBalance` assignment — all probed, none breached.
9. **Subclass override.** A subclass can make `balance()` lie while real state still governs operations.
10. **Full boundary sweeps.** Every `withdraw(k)` for `k ∈ [-2, B+2]` and every `deposit(k)` for `k ∈ [1, MAX+2]`, verifying monotonic, correctly-coded behavior with no off-by-one. The builder tested single points.
11. **Model-based fuzz.** 60,000 seeded operations across six seeds, comparing against exact bigint arithmetic **after every operation**, with vacuity guards requiring >500 accepted and >500 rejected ops per run.
12. **Determinism.** The same 2,000-op sequence produces an identical trace twice.
13. **Drift.** 100,000 deposits of `7n` land on exactly `700,000n`; 200,000 incrementing deposits match exact arithmetic.
14. **`2^53+1` stays exact**, with the float trap itself verified to fire — the builder tested that `2**53` as a `number` is *rejected*, which is a different claim.
15. **Broader invalid-input set** — `true`, `false`, `Symbol`, functions, `Date`, `new Number(5)`, `Object(5n)`, `{valueOf}`, `" 10 "`, `1e21`, `1e30`, `Number.MIN_VALUE`, `-0`.

---

## 5. Builder tests that overlap with adversary tests

**All 15 builder tests have an adversary counterpart. In 11 of 15 the adversary version is a strict superset.** No builder test covers anything the adversary suite missed.

| # | Builder test | Adversary counterpart | Relation |
|---|---|---|---|
| 1 | new wallet starts at zero by default | `A-6`, `A-1` cleanup assertion | Covered incidentally |
| 2 | deposit increases by exactly the amount | S2 exact deltas (8 magnitudes to `2^62`) | **Superset** |
| 3 | withdraw decreases by exactly the amount | S3 exact deltas (6 magnitudes) | **Superset** |
| 4 | overdraw rejected, state unchanged | S1 balance+1 boundary + S4 snapshot | **Superset** |
| 5 | withdrawing exact balance lands on zero | S1 "withdraw exactly the balance" | Near-identical |
| 6 | zero rejected `NON_POSITIVE_AMOUNT` | S5 zero (adds `0`, `-0`) | **Superset** |
| 7 | negative rejected `NON_POSITIVE_AMOUNT` | S5 negative + "never inverts the operation" | **Superset** |
| 8 | invalid numerics (5 values) | S5 invalid (24 values) | **Superset** |
| 9 | non-numerics (5 values) | S5 invalid + POISON set | **Superset** |
| 10 | safe-integer `number` accepted, exact | S2 number-typed amounts | Near-identical |
| 11 | large deposit exceeds `maxBalance` | Ceiling sweep `k ∈ [1, MAX+2]` | **Superset** |
| 12 | huge bigint `1n<<200n` bounded | S5 large (`2^63`…`10^100`, both operations) | **Superset** |
| 13 | repeated deposits apply independently | S5 repeated + API surface scan for dedup keys | **Superset** |
| 14 | rejected op returns current balance | S4 "reports the CURRENT balance" | Near-identical |
| 15 | sequential interleaving keeps invariant | 60k model-based fuzz + async concurrency suite | **Superset** |

Both suites are honest about their status: the builder's header says the tests "are NOT a proof of correctness," and `evidence.md` repeats it. That is correct and worth crediting — the tests are presented as a map of *where* each claim is realized, which is what they are.

**The structural weakness is what neither suite's design reaches:** the builder's 15 tests are all single-point positive/negative checks on the two operations. There are no properties, no sweeps, no randomization, and — most notably — **no constructor-validation tests at all**, despite `evidence.md` C1 citing constructor guards as evidence for the balance-never-negative claim.

---

## 6. Important cases missed by both roles

Verified during this review where cheap; the first two were run.

1. **`Object.freeze` gives false assurance.** `Object.freeze(wallet)` reports `isFrozen === true`, yet `deposit(5n)` still succeeds and mutates the balance — private fields are unaffected by freezing. Standard JS semantics and not a defect, but a plausible consumer mistake that neither suite tests. *(Verified: frozen wallet at `10n`, `deposit(5n)` → `ok`, balance `15n`.)*
2. **Cross-instance isolation is untested by both.** Two wallets must not share state. *(Verified: independent — no leak.)* Neither suite asserts it, and a `static` slip would have gone unnoticed by both.
3. **The implementation README example is never executed.** Its four documented outputs (`100n`, `60n`, `INSUFFICIENT_FUNDS`, `60n`) are a doctest nobody runs. *(Verified: matches exactly.)*
4. **No `tsc` type-check.** Neither role ran the TypeScript compiler. The artifact executes under Node type stripping, where annotations are erased and **no** type checking occurs, so the declared types are unverified by both roles and by the runtime.
5. **No true parallelism.** Neither tested `worker_threads` or `SharedArrayBuffer`. Both concluded concurrency is fine within one isolate; neither established anything beyond it.
6. **No soak, memory, or cost characterisation.** Neither measured behavior under sustained load, nor the cost of an astronomically large `bigint` amount.
7. **No shrinking property-based testing.** The adversary hand-rolled a PRNG; the builder had none. Neither used a library that minimises a failing case automatically.
8. **Result-object aliasing across calls** — that each call returns a fresh object rather than a shared mutable one. *(Verified: fresh per call.)* Untested by both.
9. **No mutation testing.** Neither checked whether the tests would actually catch an injected fault — e.g. flipping `>` to `>=` in the withdrawal guard. This is the sharpest available measure of whether either suite has teeth, and neither role ran it.

Item 9 is the one I would prioritise for a follow-up run: both suites pass, which tells us little until we know they can fail.

---

## 7. Evidence that the builder silently resolved ambiguity

**On the wallet domain: essentially none.** This is the corrected verdict, and it reverses my pre-reveal position. All ten domain-level choices are disclosed, tagged by ambiguity type, and several are marked as contested with the alternative named. Two disclosures actively invite attack — A3's *"that is a live disagreement, not a settled fact"* and A6's *"the adversary should treat that as an open gap."* The builder also declined to add customary features (A10), so the artifact is not an invented wallet product.

**Where silent resolution did occur — the configuration and host-language boundary.** `assumptions.md` reasons entirely about the *domain* (money, precision, concurrency, authorization) and never about the *API contract*. These were resolved without being flagged:

| Silently resolved | Where it surfaces |
|---|---|
| Options are honoured from the prototype chain, not just own properties | A-1 |
| A malformed `options` argument has no defined contract — `null` throws `TypeError`, `"nope"` silently succeeds | A-5, A-6 |
| An unrecognised or misspelled key is silently dropped rather than rejected | A-6b |
| `bigint` cannot round-trip through JSON, so the outcome object is untransportable | A-4 |
| `balance()` is not `===`-comparable to a `number` and cannot be mixed in arithmetic | A-4b |
| `maxBalance` was added as public API — a surface the specification never asked for | not in `assumptions.md` |
| A subclass may override `balance()` and misreport | not in `assumptions.md` |

**One documentation overreach.** `implementation/README.md` states the constructor *"does throw `RangeError` for structurally invalid configuration."* The parenthetical narrows it to "negative/oversized initial balance," but the sentence reads as a general contract and `new Wallet(null)` — structurally invalid by any reading — throws `TypeError` instead. Stated broader than delivered.

**A disclosure-placement issue, distinct from silence.** Ten of ten domain assumptions live in `assumptions.md`; only three reach `implementation/README.md`. A consumer who receives the implementation directory alone — the natural unit of delivery — gets the numeric representation, the error table, and the ceiling, but no statement about authorization, idempotency, persistence, concurrency, or currency. The builder was not silent; the *artifact* is quieter than the *submission*. That is worth a specification revision requiring the declaration block to ship with the code.

---

## 8. Limits caused by using Claude for both roles

**This is the most significant limitation on the run, and the reveal made it worse, not better.**

Pre-reveal I flagged correlated blind spots as a live threat on two weak signals. The reveal supplies much stronger evidence: **ten independent convergences** (§ 3), including cases where both roles picked the same illustrative example (currency scale: the builder's *"$1.00 or ¥100"* against my "amounts with more precision than the implied currency minor unit"), the same risk framing for idempotency (retried network requests), and the same verdict that concurrency is the weakest bullet — which the builder wrote into `evidence.md` as "the weakest mapping" and I wrote into `strategy.md` §7 as prediction P2, independently.

My pre-reveal strategy predicted the representation would be "int minor units or `Decimal`." The builder chose exactly that, with the same rationale I would have written. Convergent good practice and a shared prior are indistinguishable from inside this run.

**The diagnostic pattern.** Every finding unique to the adversary (§ 4) sits at the **JavaScript/TypeScript language boundary** — prototype chains, primitive property access, `bigint`/JSON interop, private-field semantics, `Object.freeze`. Every gap found by both (§ 3) sits in the **wallet domain**. The adversary added essentially no independent value on the domain model; it added all of its independent value by attacking the host language.

The most plausible reading is that both roles inherited the same domain model from the same README, and the adversary's real contribution was operating at a different *layer*, not from a different *perspective*. A different model family would likely have partitioned the domain differently — and a genuinely different partition is what would test whether these seven "unresolved questions" are the right seven, or merely the seven that this README's phrasing suggests to a Claude model.

**Concrete consequences.**
1. **"No defect found in S1–S4/S6" is weaker than the test count suggests.** 80 passing tests from an adversary that shares the builder's domain model is not 80 independent checks.
2. **The seven unresolved questions may be an artifact of shared priors.** Both roles enumerated nearly the same list. Neither questioned whether the *list itself* is complete — e.g. neither treated rounding policy, statement/audit requirements, or reversal/refund semantics as first-class open questions.
3. **`RUN.md` step 4's recommendation to use different systems per role was not followed here.** Both roles are Claude Opus 5. The protocol anticipated exactly this.
4. **Shared toolchain blind spot.** Both roles ran Node v25.5.0 with type stripping and neither ran `tsc`. A different builder might have shipped a compiled artifact, which would have changed the entire A-5/A-6 finding class.

**Recommendation, unchanged and now better supported:** run the reverse pairing (Codex builder / Claude adversary, then Claude builder / Codex adversary) before treating this run's negative result as meaningful. Additionally, run mutation testing (§ 6 item 9) — it measures suite strength without needing a second model family, and it is the cheapest available check on whether either suite can fail at all.

---

## 9. Disagreements preserved, not resolved

Recorded as live disagreements. I am not adopting the builder's position on any of these, and I am not asserting mine is correct.

**D-1 — The `maxBalance` ceiling: reject or accept?**
The builder (A3) chose reject and explicitly labels this *"a live disagreement, not a settled fact."* I hold the opposing view. S6 forbids *silent* overflow; `bigint` already makes silent overflow impossible, so the ceiling is not required to satisfy the bullet. Its cost is a **new failure mode the specification never requested** — `BALANCE_LIMIT_EXCEEDED` can reject a deposit that the spec's own text would have accepted, which arguably works against S2. Counter-argument, which I acknowledge has force: a real ledger has a column width, `2^63-1` is that width, and "extremely large operations have explicit outcomes" reads more naturally as *bounded* than as *unbounded*. **Unresolved. The specification must decide, not the builder or the adversary.**

**D-2 — Are A-1/A-5/A-6 defects at all?**
Anticipated builder position: the specification governs deposits, withdrawals, and balance queries; the constructor is outside its scope, and prototype pollution presupposes a prior compromise. My position: `evidence.md` C1 cites the constructor guards as evidence for the balance-never-negative claim, so the builder brought the constructor inside the evidence boundary; and once cited as evidence, it should be tested — it is not. I also note none of the three can drive the balance negative, so if these are defects they are minor ones. **Preserved as a scope disagreement about what the specification governs.**

**D-3 — Is a zero deposit a rejection or a successful no-op?**
The builder (A4) chose rejection so that "successful deposits increase the balance by exactly the amount" stays literally true. I find this reasoning sound and would have accepted either. But `strategy.md` §2 records that a zero deposit trivially satisfies S2 with a zero delta, which makes the no-op reading equally literal. **Both defensible; the specification decides nothing. Genuinely open.**

**D-4 — Does disclosure in `assumptions.md` discharge the obligation?**
The builder's position is implicit: assumptions belong in the assumptions file. Mine is that a consumer receives `implementation/`, and an assumption that does not ship with the code is not available at the point of use. This is not a defect in the builder's work — it followed the prompt exactly — but it is a real question about what "flagging an assumption" should mean, and it is a specification-process question rather than a wallet question. **Preserved.**

---

## Revised finding severities

| ID | Pre-reveal | Post-reveal | Reason |
|----|-----------|-------------|--------|
| A-1 | medium | **medium** | Strengthened: constructor guards are cited as evidence but untested by the builder |
| A-2 | medium | **low-medium** | Builder disclosed the model in A6 and self-flagged C5f; residue is placement + failure shape |
| A-3 | low | **informational** | Builder disclosed the limit in A6; only the mechanism is new |
| A-4 | medium | **medium** | Unchanged — undisclosed anywhere |
| A-5 | low | **low-medium** | Strengthened: the only constructor statement in the artifact is broader than delivered |
| A-6 | low | **low-medium** | Strengthened: zero builder constructor tests |
| A-7 | medium | **medium (spec), withdrawn (disclosure)** | Builder disclosed it and named the same risk |
| A-8 | high | **low** | Contradicted — all ten assumptions were disclosed |
| A-9 | no defect found | **no defect found** | Unchanged |

**Net:** the case against the implementation is modestly stronger and now concentrated in one place (the untested configuration boundary). The case against the *builder* is substantially weaker — its disclosure discipline was the strongest part of the run. The case against the *specification* stands, but for a corrected reason: not that the builder hid its choices, but that the specification forced ten judgment calls and provides no mechanism requiring them to travel with the code.

**The most durable result of this run is § 8.** Ten independent convergences between two Claude instances, with all adversary-unique findings confined to the host-language layer, is the finding a future experimenter should act on first.
