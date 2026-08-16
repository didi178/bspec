# Mutation Testing — Method, Tooling, and Reproduction (run 0001, post-reveal)

**Stage:** post-reveal analysis. This does **not** amend `strategy.md`, `findings.md`, or `post-reveal-review.md`; all three are unmodified. Results are reported in [`comparison.md`](comparison.md).

**Question asked:** both suites pass, which tells us nothing until we know they *can* fail. Mutation testing measures whether each suite detects deliberately injected faults in the unchanged builder implementation.

---

## Tool

| Item | Value |
|---|---|
| Mutation tool | **Stryker Mutator** (`@stryker-mutator/core`) |
| Exact version | **10.0.0** (`npx stryker --version` → `10.0.0`) |
| Installed dependency tree | `@stryker-mutator/core@10.0.0` only — see `logs/environment.txt` |
| Test runner plugin | `command` (built into core) — runs the suite as a subprocess; **non-zero exit = mutant killed** |
| Node.js | v25.5.0 (native TypeScript type stripping; no build step) |
| npm | 11.8.0 |
| Platform | Darwin 25.5.0 arm64, 10 CPUs |

Stryker was chosen deliberately over a hand-written mutator. The adversary authored one of the two suites under test, so an **independently-authored mutation set removes the bias** of grading one's own tests against self-chosen faults. Neither the mutation operators nor the mutant selection were influenced by either suite.

## System under test

Unchanged builder implementation:

```
builder/implementation/wallet.ts   sha256 3e063eb15ee43e2fa4be35ecb1a2b131868619bb5758959bbeca2c9e4e0ac431
```

## Non-modification guarantee

Nothing under `builder/` or `adversary/tests/` was edited. The harness is a **byte-identical copy** of the implementation and both suites into a scratch workspace that preserves the exact relative directory layout, so every `import` path resolves unmodified and no test file needed rewriting. Verified by sha256 before the run:

| File | sha256 |
|---|---|
| `builder/implementation/wallet.ts` | `3e063eb15ee43e2fa4be35ecb1a2b131868619bb5758959bbeca2c9e4e0ac431` |
| `builder/tests/wallet.test.ts` | `315db1cc463d43f8b6f70499e269b04159d339689980b8fe4be679ce955c92ac` |
| `adversary/tests/concurrency.test.ts` | `f1bc6910f0cf74f75576373d0ee367493bd1e9c63f6746721546f3bbfdf75141` |
| `adversary/tests/constructor-contract.test.ts` | `ab3115e7a63f833da79f9a64becbd55b5ed7df961502eb654fd728b29615d1e5` |
| `adversary/tests/properties.test.ts` | `96f913fcf177ca9ee11f63e980138ef589c53ac70f49c378544a6cd2c616822b` |
| `adversary/tests/spec-bullets.test.ts` | `672e2ab3517a7579cc03b974ea27fe0e656ed6d8c024df76c5e95b4aba8246d5` |

Stryker further isolates each mutant in its own sandbox (`.stryker-tmp-*`), so the source on disk is never mutated in place.

## Identical mutation set for both suites

`harness/stryker.builder.json` and `harness/stryker.adversary.json` are identical except for four fields:

| Field | Builder run | Adversary run |
|---|---|---|
| `commandRunner.command` | `node --test "builder/tests/*.test.ts"` | `node --test "adversary/tests/*.test.ts"` |
| `jsonReporter.fileName` | `reports/builder/mutation-report.json` | `reports/adversary/mutation-report.json` |
| `tempDirName` | `.stryker-tmp-builder` | `.stryker-tmp-adversary` |
| `_comment` | descriptive only | descriptive only |

`mutate`, mutator selection, `timeoutMS`, `timeoutFactor`, `coverageAnalysis`, and `disableTypeChecks` are byte-identical. **Set identity was verified programmatically, not assumed:** `harness/analyze.mjs` joins the two JSON reports on `(mutatorName, start line:col, end line:col, replacement)` and asserts the key sets match. Result: `mutation sets identical: true (builder=88, adversary=88)`.

## Configuration

```json
{
  "packageManager": "npm",
  "testRunner": "command",
  "commandRunner": { "command": "node --test \"<suite>/tests/*.test.ts\"" },
  "mutate": ["builder/implementation/wallet.ts"],
  "ignorePatterns": ["reports/**", "logs/**", ".stryker-tmp-*/**"],
  "coverageAnalysis": "off",
  "timeoutMS": 30000,
  "timeoutFactor": 4,
  "concurrency": 8,
  "disableTypeChecks": false,
  "reporters": ["json", "clear-text", "progress"],
  "cleanTempDir": true
}
```

### Timeouts

`timeoutMS: 30000`, `timeoutFactor: 4`. Measured baselines were 0.315 s (builder) and 0.220 s (adversary) wall-clock, so the timeout is roughly **100× the baseline** — deliberately generous, to ensure a slow machine or a scheduling stall can never be misreported as a killed mutant. Observed timeouts: **0 in both runs**. The implementation contains no loops, so non-terminating mutants were not expected.

### Mutators enabled

**All Stryker default mutators**, with **no exclusions and no `// Stryker disable` annotations**. Nine mutator types produced mutants: `ConditionalExpression` (28), `EqualityOperator` (20), `StringLiteral` (13), `BlockStatement` (12), `BooleanLiteral` (4), `LogicalOperator` (4), `ObjectLiteral` (3), `ArithmeticOperator` (2), `AssignmentOperator` (2) — **88 mutants total**.

Note that `StringLiteral` mutants are commonly excluded by teams as low-value. **They were kept.** This matters for the result: 4 of the 5 surviving mutants are string-literal or message-path mutants, so excluding them would have inflated both scores. Keeping them is the more conservative choice and is reported transparently below.

### Exclusions

| Exclusion | Rationale |
|---|---|
| `mutate` limited to `builder/implementation/wallet.ts` | Test files must not be mutated; this is the entire implementation |
| `ignorePatterns`: `reports/**`, `logs/**`, `.stryker-tmp-*/**` | Harness output only; contains no source |
| `adversary/tests/probe-ambiguity.ts` | Not matched by `*.test.ts` — it is a recording script with no assertions, and was excluded from the adversary suite in the original run too. It cannot kill mutants and is not counted as part of the suite. |
| `coverageAnalysis: "off"` | Required by the `command` runner; means every mutant runs the **full** suite. Conservative — no mutant is skipped as "not covered" (`# no cov` = 0 in both runs). |

No mutants were ignored, filtered, or excluded post hoc from the raw Stryker scores.

## Commands (exact)

```bash
# workspace: byte-identical copies preserving relative layout
cp builder/implementation/wallet.ts   <ws>/builder/implementation/
cp builder/tests/wallet.test.ts       <ws>/builder/tests/
cp adversary/tests/*.test.ts          <ws>/adversary/tests/

npm install --no-audit --no-fund @stryker-mutator/core@10.0.0

# baselines (both must be green before mutating)
node --test "builder/tests/*.test.ts"      # 15 pass / 0 fail
node --test "adversary/tests/*.test.ts"    # 80 pass / 0 fail

# the two mutation runs — same mutation set, different suite
npx stryker run stryker.builder.json    > logs/builder-stryker.log   2>&1
npx stryker run stryker.adversary.json  > logs/adversary-stryker.log 2>&1

# post-processing
node analyze.mjs            # set-identity check + cross-classification
node audit-validity.mjs     # invalid-mutant audit
node audit-equivalence.mjs  # differential equivalence audit of survivors
node region-breakdown.mjs   # kills by code region and by mutator
```

## Validity and equivalence audits

Raw mutation scores are not taken at face value. Two audits run before any survivor is called test weakness.

### Invalid-mutant audit (`harness/audit-validity.mjs`)

With the `command` runner, a mutant that fails to parse or throws at import time makes the suite exit non-zero and is reported as **Killed** — a spurious kill. To detect this, every one of the 88 mutants was reconstructed from `(source, location, replacement)`, written to disk, and dynamically imported, asserting the `Wallet` export exists.

Reconstruction fidelity was spot-checked by confirming that replaced spans are exactly the expected source tokens (e.g. line 71 replaced `"maxBalance must be a non-negative bigint"`), which also confirms Stryker's columns are 1-based.

**Result: 88/88 load cleanly. 0 invalid mutants.** No kill in either run is spurious.

### Equivalence audit (`harness/audit-equivalence.mjs`)

A surviving mutant is only evidence of test weakness if it is actually *killable*. Each survivor was differentially executed against the original over a corpus of **18 constructor configurations × 33 amount values × 2 operations**, comparing every observable: thrown type, **thrown message**, `balance()`, `maxBalance`, and the full result object of each call.

Verdicts: `SUSPECTED_EQUIVALENT` (zero observable differences), `GENUINE_message-text-only` (differs solely in error message text), `GENUINE_behavioral`.

**Result: 1 suspected equivalent, 4 genuine (all message-text-only), 0 genuine behavioral.**

Per the analysis requirements, the equivalent mutant is **excluded from the denominator** when computing adjusted scores, and invalid mutants (there are none) would be too.

## Output map

| Path | Contents |
|---|---|
| `comparison.md` | **Final comparison and conclusions** |
| `harness/stryker.{builder,adversary}.json` | The two configs, byte-identical but for four fields |
| `harness/package.json` | Harness manifest |
| `harness/analyze.mjs` | Set-identity verification + cross-classification |
| `harness/audit-validity.mjs` | Invalid-mutant audit |
| `harness/audit-equivalence.mjs` | Differential equivalence audit |
| `harness/region-breakdown.mjs` | Kills by code region and mutator |
| `reports/builder/mutation-report.json` | Raw Stryker JSON, builder suite |
| `reports/adversary/mutation-report.json` | Raw Stryker JSON, adversary suite |
| `reports/mutants-joined.json` | All 88 mutants with per-suite status and cross-classification bucket |
| `reports/validity-audit.json` | Per-mutant load/parse results |
| `reports/equivalence-audit.json` | Per-survivor differential diffs and verdicts |
| `reports/region-breakdown.json` | Aggregates by region and mutator |
| `logs/{builder,adversary}-stryker.log` | Full Stryker console output |
| `logs/environment.txt` | Node/npm/Stryker versions, platform, dependency tree |

`node_modules/` is **not** archived (165 transitive packages). The harness files here are byte-identical to those executed; `npm install @stryker-mutator/core@10.0.0` reproduces the environment.

## Known limits of this analysis

1. **Mutation score measures fault detection, not specification conformance.** A suite can score highly while testing the wrong behavior. It is a lower bound on suite strength, not a correctness claim.
2. **Only the implementation was mutated.** Neither suite's own correctness was mutation-tested.
3. **Stryker's default operator set is not exhaustive.** It does not inject concurrency faults, resource leaks, or type-level errors — precisely the areas both roles already flagged as weakly covered.
4. **Equivalence is "suspected", not proven.** The audit is empirical over a finite corpus, backed by reasoning in `comparison.md` § 5; it is not a formal proof.
5. **`coverageAnalysis: "off"`** makes the run slower but strictly more conservative — no mutant is skipped for lack of coverage.
