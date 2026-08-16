# Mutation Testing Comparison — Run 0001 (post-reveal)

**Stage:** post-reveal analysis. **Original findings are not retroactively changed.** `strategy.md`, `findings.md`, and `post-reveal-review.md` are unmodified; everything here is new evidence recorded alongside them.

**Tool:** Stryker Mutator `@stryker-mutator/core` **10.0.0**, `command` runner, Node.js v25.5.0.
**Method, config, commands, timeouts, exclusions:** [`README.md`](README.md).
**System under test:** unchanged `builder/implementation/wallet.ts`, sha256 `3e063eb15ee43e2fa4be35ecb1a2b131868619bb5758959bbeca2c9e4e0ac431`.
**Mutation set:** 88 mutants, **verified programmatically identical** across both runs (`analyze.mjs`: `mutation sets identical: true`).

---

## 1. Mutation scores

| Suite | Tests | Killed | Survived | Timed out | Invalid | Suspected equivalent | **Raw score** | **Adjusted score** |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| **Builder** (`builder/tests/`) | 15 | 66 | 22 | 0 | 0 | 1 | **75.00 %** | **75.86 %** |
| **Adversary** (`adversary/tests/`) | 80 | 83 | 5 | 0 | 0 | 1 | **94.32 %** | **95.40 %** |

- **Raw score** = killed / 88, as reported by Stryker.
- **Adjusted score** = killed / 87, excluding the one suspected equivalent mutant. Per the analysis requirements, invalid and equivalent mutants are **not** counted as evidence of test weakness. There were **0 invalid mutants** (all 88 parse and import cleanly — `validity-audit.json`), so the only adjustment is the single equivalent.
- **0 timeouts** in both runs; **0 mutants without coverage** (`coverageAnalysis: "off"` means every mutant ran the full suite).

Both suites were green on the unmutated baseline (builder 15/15, adversary 80/80).

---

## 2. Cross-classification — who killed what

| Bucket | Count | Share of 88 |
|---|--:|--:|
| Killed by **both** suites | 66 | 75.0 % |
| Killed by **builder only** | **0** | 0.0 % |
| Killed by **adversary only** | 17 | 19.3 % |
| Killed by **neither** | 5 | 5.7 % |

**The headline is the zero.** Not a single mutant was detected by the builder suite that the adversary suite missed. In fault-detection terms the builder suite is a **strict subset** of the adversary suite.

This empirically confirms the claim made in `post-reveal-review.md` § 5 — that all 15 builder tests have an adversary counterpart and 11 are strict supersets — by a method that does not depend on my reading of either suite. That section was written by inspection; this is the same conclusion reached mechanically.

**This is not a neutral comparison, and should not be read as one.** The adversary suite has 80 tests to the builder's 15, was written after inspecting the implementation, and was written by the same agent authoring this report. A higher score was the expected outcome. What is informative is not *that* the adversary scored higher but **where** the difference falls (§ 3) and **what neither suite caught** (§ 5).

---

## 3. Where the difference lives — kills by code region

| Region | Mutants | Builder killed | Adversary killed | Adv-only | Survived both |
|---|--:|--:|--:|--:|--:|
| `DEFAULT_MAX_BALANCE` constant | 1 | 0 (0 %) | 1 (100 %) | 1 | 0 |
| `toIntAmount()` — amount normalization | 13 | 12 (92 %) | 12 (92 %) | 0 | 1 |
| **`constructor` + option validation** | **31** | **14 (45 %)** | **27 (87 %)** | **13** | 4 |
| `balance()` reader | 1 | 1 (100 %) | 1 (100 %) | 0 | 0 |
| `maxBalance` getter | 1 | 0 (0 %) | 1 (100 %) | 1 | 0 |
| `deposit()` | 20 | 20 (100 %) | 20 (100 %) | 0 | 0 |
| `withdraw()` | 18 | 16 (89 %) | 18 (100 %) | 2 | 0 |
| `#reject()` | 3 | 3 (100 %) | 3 (100 %) | 0 | 0 |

**The builder suite is excellent on the operations and absent on the constructor.** It kills 100 % of `deposit()` mutants, 100 % of `#reject()`, 100 % of `balance()`, 89 % of `withdraw()`, 92 % of `toIntAmount()` — and 45 % of the constructor, which holds 31 of the 88 mutants (35 % of the whole mutation set).

This is a **direct, mechanical confirmation of `post-reveal-review.md` § 1**, which observed that `evidence.md` row C1 cites the constructor guards as evidence for the balance-never-negative claim while no builder test exercises any constructor rejection path. Mutation testing puts a number on it: **13 of the 17 adversary-only kills are in the constructor.** The one region the builder suite cites as evidence and does not test is exactly the region where it fails to detect injected faults.

By mutator, the gap concentrates in the operators used for guard conditions:

| Mutator | Mutants | Builder killed | Adversary killed |
|---|--:|--:|--:|
| `ConditionalExpression` | 28 | 19 | 26 |
| `EqualityOperator` | 20 | 18 | 20 |
| `StringLiteral` | 13 | 9 | 10 |
| `BlockStatement` | 12 | 8 | 12 |
| `BooleanLiteral` | 4 | 4 | 4 |
| `LogicalOperator` | 4 | 2 | 4 |
| `ObjectLiteral` | 3 | 3 | 3 |
| `ArithmeticOperator` | 2 | 1 | 2 |
| `AssignmentOperator` | 2 | 2 | 2 |

---

## 4. The 17 mutants killed only by adversary tests

All survived the builder suite; all were caught by the adversary suite.

### Constructor validation — 13 mutants

Every guard in the constructor can be deleted, inverted, or short-circuited without any builder test noticing.

| Line | Mutator | Mutation | Consequence if shipped |
|---|---|---|---|
| 70 | `ConditionalExpression` → `false` | `if (typeof max !== "bigint" \|\| max < 0n)` never fires | **All `maxBalance` validation removed** |
| 70 | `ConditionalExpression` → `false` (2nd) | same guard, other operand | ditto |
| 70 | `BlockStatement` → `{}` | throw body emptied | `maxBalance` validation silently no-ops |
| 70 | `EqualityOperator` → `max <= 0n` | boundary shifted | `maxBalance: 0n` wrongly rejected |
| 70 | `LogicalOperator` → `&&` | `\|\|` becomes `&&` | guard fires almost never |
| 73 | `ConditionalExpression` → `false` | `initialBalance` type/sign guard never fires | **A negative opening balance becomes constructible — S1 defeated at the provenance boundary** |
| 73 | `ConditionalExpression` → `false` (2nd) | same guard, other operand | ditto |
| 73 | `ConditionalExpression` → `false` (3rd) | `initial < 0n` sub-expression | ditto |
| 73 | `BlockStatement` → `{}` | throw body emptied | ditto |
| 73 | `LogicalOperator` → `&&` | `\|\|` becomes `&&` | ditto |
| 76 | `ConditionalExpression` → `false` | `if (initial > max)` never fires | Wallet constructible **above** its own ceiling |
| 76 | `BlockStatement` → `{}` | throw body emptied | ditto |
| 76 | `EqualityOperator` → `>=` | boundary shifted | `initialBalance === maxBalance` wrongly rejected |

The line-73 mutants are the most serious in the entire set: with `if (false)`, `new Wallet({ initialBalance: -1n })` succeeds and the wallet opens at a **negative balance** — a direct violation of specification bullet S1, the single strongest claim in the spec. The builder suite does not detect it. The adversary suite kills it via `spec-bullets.test.ts` ("constructor cannot open a wallet at a negative balance", "a number-typed negative initial balance is also refused") and `constructor-contract.test.ts` ("documented cases do throw RangeError").

### `withdraw()` invalid-amount path — 2 mutants

| Line | Mutator | Mutation |
|---|---|---|
| 115 | `ConditionalExpression` → `false` | `if (value === null) return this.#reject("INVALID_AMOUNT")` never fires |
| 115 | `StringLiteral` → `""` | the `"INVALID_AMOUNT"` code becomes empty |

**Root cause, and a genuinely new finding.** Builder tests 8 and 9 iterate over invalid inputs but call **only `w.deposit(bad)`** — never `w.withdraw(bad)`. Builder tests 6 and 7 do call `withdraw`, but with `0n` and `-5n`, which take the `NON_POSITIVE_AMOUNT` branch, not the `INVALID_AMOUNT` branch. So `withdraw`'s invalid-amount guard is never executed by the builder suite at all.

With the line-115 conditional removed, `withdraw(NaN)` falls through to `value <= 0n` where `value` is `null`; `null <= 0n` is `true`, so the call returns `NON_POSITIVE_AMOUNT` instead of `INVALID_AMOUNT` — a silently wrong error code on every malformed withdrawal. Neither role identified this asymmetry before mutation testing. It is caught by the adversary suite's S4 rejection table and the S5 invalid-input sweep, both of which exercise **both** operations for every input.

### Constant and getter — 2 mutants

| Line | Mutator | Mutation | Consequence |
|---|---|---|---|
| 50 | `ArithmeticOperator` → `(1n << 63n) + 1n` | Default ceiling off by two | Documented `2^63-1` default is wrong |
| 89 | `BlockStatement` → `{}` | `get maxBalance()` returns `undefined` | Public getter broken |

Both are killed by adversary assertions on the documented default (`maxBalance` read-only test, ceiling sweep, `MAX` constant checks). No builder test reads `maxBalance` or asserts the default ceiling value.

---

## 5. The 5 mutants killed by neither suite

Each was differentially executed against the original over **18 constructor configurations × 33 amount values × 2 operations**, comparing thrown type, thrown **message**, `balance()`, `maxBalance`, and every returned result object (`equivalence-audit.json`).

### 5.1 Suspected equivalent — 1 mutant (excluded from test-weakness evidence)

**Mutant 6 — line 55, `ConditionalExpression`: `typeof amount === "number"` → `true`**

```ts
function toIntAmount(amount: Amount): bigint | null {
  if (typeof amount === "bigint") return amount;
  if (typeof amount === "number") {          // → if (true)
    if (!Number.isSafeInteger(amount)) return null;
    return BigInt(amount);
  }
  return null;
}
```

**Observable differences: 0 of 1,188 probes.**

Reasoning that supports the empirical result: `bigint` values return at the preceding line, so line 55 is reached only by non-bigints. `Number.isSafeInteger` performs **no coercion** — it returns `false` for every value that is not a number primitive. So for any non-number reaching the mutated `if (true)`, the inner guard returns `null`, which is exactly what the unmutated `return null` at the end would have produced. `BigInt(amount)` is unreachable for non-numbers. The `typeof amount === "number"` check is genuinely **redundant** given the `Number.isSafeInteger` guard that follows it.

**Classified as a suspected equivalent mutant. It is not evidence of weakness in either suite** — no test could kill it, because no observable behavior differs. It is also mildly interesting as a code observation: the guard is defensive but logically dead.

*Caveat:* "suspected", not proven. The audit is empirical over a finite corpus plus the reasoning above, not a formal proof.

### 5.2 Genuine survivors — 4 mutants, all message-text-only

All four are in the constructor's error-reporting path and are killable **only by asserting error message text**. Every one preserves the thrown *type* (`RangeError`), so both suites' `assert.throws(..., RangeError)` assertions pass.

| Mutant | Line | Mutation | Observable difference |
|---|---|---|---|
| 23 | 70 | `max < 0n` → `false` | 3 configs throw `RangeError` with a *different message* — see below |
| 28 | 71 | `"maxBalance must be a non-negative bigint"` → `""` | 5 configs throw `RangeError: ` (empty) |
| 40 | 74 | `"initialBalance must be a non-negative bigint"` → `""` | 3 configs throw `RangeError: ` (empty) |
| 47 | 77 | `"initialBalance must not exceed maxBalance"` → `""` | 1 config throws `RangeError: ` (empty) |

**Mutant 23 deserves a note** — it is the most interesting survivor and is *not* simply a string mutant. Removing the `max < 0n` check does not stop `new Wallet({ maxBalance: -1n })` from throwing: control falls through to `if (initial > max)`, and since a valid `initial` is `>= 0n` while `max < 0n`, that guard always fires instead. The wallet still throws `RangeError` for every input the original rejected — only the *message* changes:

```
original: RangeError: maxBalance must be a non-negative bigint
mutant  : RangeError: initialBalance must not exceed maxBalance
```

So the negative-`maxBalance` guard is **partially redundant**: a second guard already covers every case it rejects. It is killable — the message differs — but only by a message assertion. This is a real, if minor, gap in **both** suites: neither asserts *which* constructor error was raised, only that some `RangeError` was.

**These four count as genuine test weakness, shared by both suites.** They were not excluded from the scores.

---

## 6. What this confirms, and what it adds

### Confirms (mechanically, by a method independent of my reading)

1. **`post-reveal-review.md` § 5 — the builder suite is a strict subset.** Predicted by inspection; confirmed by `builder-only = 0`.
2. **`post-reveal-review.md` § 1 — the constructor is cited as evidence but untested.** Confirmed and quantified: builder kills 45 % of constructor mutants against 87 % for the adversary, and 13 of 17 adversary-only kills are there.
3. **`findings.md` A-9 — `deposit`/`withdraw`/`#reject` are solidly built.** 100 %, 89–100 %, and 100 % builder kill rates respectively; 100 % adversary across all three. The core ledger logic is well covered by *both* suites.

### Adds — new information neither role had

4. **The `withdraw` invalid-amount asymmetry** (§ 4). Builder tests exercise invalid inputs only through `deposit`. Neither `findings.md` nor `post-reveal-review.md` identified this; it took mutation testing to surface it. This is the clearest demonstration in the run that mutation testing finds things careful reading does not.
5. **The line-73 mutants defeat S1 undetected by the builder suite.** A one-token change makes negative opening balances constructible, and 15 passing builder tests stay green. This sharpens `findings.md` A-1/A-5/A-6 — the configuration boundary is not merely undertested, it is the place where the spec's strongest invariant can be silently broken.
6. **Two redundancies in the implementation:** the `typeof amount === "number"` guard is logically dead (§ 5.1), and the negative-`maxBalance` guard is covered by a downstream guard (§ 5.2, mutant 23). Neither is a defect; both are observations mutation testing produced for free.
7. **Neither suite asserts constructor error messages** — the shared gap behind all four genuine survivors.

### Does not change

Nothing here amends the original findings. In particular, **A-8 remains corrected** as recorded in `post-reveal-review.md`: the builder's disclosure discipline was strong, and mutation testing says nothing about disclosure. Mutation testing measures **fault detection by tests**, not specification conformance, not disclosure quality, and not implementation correctness.

---

## 7. Honest limits

1. **Mutation score is not a correctness measure.** A suite can score 95 % while asserting the wrong behavior. It is a lower bound on fault-detection strength.
2. **The comparison is not apples-to-apples.** 80 adversary tests versus 15 builder tests, written after implementation inspection, by the agent writing this report. The builder's stated goal was to *map* where each claim is realized (`evidence.md`: "these tests do **not** prove correctness; they show *where* each claim is realized") — not to maximize fault detection. **Against its own stated goal, the builder suite is not failing.** A 75 % score from 15 illustrative tests is respectable.
3. **Stryker's default operators are not exhaustive.** They inject no concurrency faults, no resource leaks, no type-level errors — exactly the areas both roles independently flagged as weakly covered. A high adversary score therefore says nothing about A-2/A-3 concurrency risk.
4. **Only the implementation was mutated.** Neither suite's own correctness was tested; a test asserting something false would not show up here.
5. **Equivalence is suspected, not proven** (§ 5.1).
6. **Single tool, single run.** No cross-check against a second mutation engine, and no repeat runs to check stability (though with 0 timeouts and a deterministic implementation, run-to-run variance should be nil).
7. **The `probe-ambiguity.ts` script is excluded** from the adversary suite — it has no assertions and cannot kill mutants. The adversary score reflects the 4 assertion-bearing test files only.

---

## 8. Conclusion

Against the same 88-mutant set on the same unchanged implementation, the **builder suite scores 75.86 %** and the **adversary suite 95.40 %** (adjusted; raw 75.00 % / 94.32 %). Zero mutants were caught by the builder suite alone.

The difference is not spread evenly — it is almost entirely one region. Both suites cover the ledger operations essentially completely; **the builder suite does not test the constructor**, which holds 35 % of the mutation set and is precisely where `evidence.md` cites guards as evidence for the specification's strongest invariant. A single-token mutation there makes negative-balance wallets constructible while all 15 builder tests stay green.

The four faults **neither** suite detects are all constructor error-message assertions — a shared gap, and a minor one. The single unkillable mutant is a redundant type guard, excluded from both scores.

Most usefully, mutation testing found something neither the builder's construction process nor the adversary's pre-reveal attack nor the post-reveal review had noticed: **`withdraw`'s invalid-amount path is never exercised by the builder suite**, because its invalid-input tests call `deposit` only. That is the strongest argument in this run for adding mutation testing to the standard protocol — it produces evidence that careful reading by two independent roles did not.
