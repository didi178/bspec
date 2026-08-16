# Adversary Test Strategy — Run 0001 (Wallet)

**Role:** adversary
**Run ID:** 0001
**Authored:** 2026-08-16
**Derived exclusively from:** `experiments/wallet/README.md` (§ "Candidate behavior")
**Builder material inspected at time of writing:** none. No implementation file, builder rationale, builder test, or run-record field has been read. Only the run directory *names* (`builder/`, `adversary/`, `run-record.md`) were observed via `ls` on the run root.

---

## 1. Restatement of the specification under test

The specification is the six bullets in `README.md`, verbatim:

| ID | Claim as written |
|----|------------------|
| S1 | the balance never becomes negative |
| S2 | successful deposits increase the balance by exactly the deposited amount |
| S3 | successful withdrawals decrease it by exactly the withdrawn amount |
| S4 | rejected operations do not change state |
| S5 | invalid, zero, negative, extremely large, repeated, and concurrent operations have explicit outcomes |
| S6 | arithmetic cannot silently overflow or lose precision |

The README states plainly that these "are prompts, not a complete specification," and that **currency, numeric representation, authorization, idempotency, concurrency, persistence, and error semantics are deliberately unresolved.**

This is decisive for how I evaluate. Two distinct verdicts are available and I must not conflate them:

- **Implementation defect** — the artifact violates something the six bullets *do* constrain.
- **Specification gap** — the artifact makes a behavior choice the bullets do not constrain, and that choice is neither wrong nor right; the *specification* failed to decide. A gap is a finding against the specification, not against the builder.

A third verdict I will actively look for, because RUN.md § "Current scope" names it as the thing this run measures:

- **Silent resolution** — the artifact resolves an unresolved question without marking it as resolved anywhere the reader can see. This is worse for the experiment than an arbitrary-but-declared choice, and I will grade it separately from the choice itself. The README's own success criterion is "exposes where behavior is ambiguous"; an artifact that quietly invents a complete wallet product defeats it.

## 2. What would falsify each claim

Written before seeing any code, so the tests are not shaped to the artifact's structure.

### S1 — balance never negative

- Withdraw from a zero balance.
- Withdraw exactly the balance (boundary: result 0 must be permitted; 0 is not negative).
- Withdraw balance + smallest representable unit.
- Sequence of small withdrawals summing to more than the balance; the crossing withdrawal must be the one rejected.
- Deposit a *negative* amount — if negative deposits are accepted as an alias for withdrawal, S1 must still hold on that path.
- Search for a path where a rejected op still moved balance below zero (interaction of S1 and S4).
- **Invariant harness:** after every operation in a randomized sequence, assert `balance >= 0`. This is the one property I can assert without resolving any of the deliberately-open questions.

### S2/S3 — exactness

- `deposit(x)` then read: delta must equal `x` exactly, not "approximately."
- Amounts chosen to break binary floating point if floats are used: `0.1 + 0.2`, `0.07` deposited 100 times, `1e16 + 1`, `0.1` deposited 3 times vs `0.3` once.
- Amounts with more precision than the implied currency minor unit (e.g. `0.005`, `1.234567`): the outcome is *unconstrained* by the spec — accept, reject, or round are all permissible — so this is a gap probe, and I record which was chosen and whether it was declared. If it silently rounds, S6's "lose precision" clause is implicated and it becomes a defect.
- Deposit/withdraw round-trip: `deposit(x); withdraw(x)` must return to the exact starting balance, for many x.
- **Property:** for any accepted sequence, `balance == sum(accepted deposits) - sum(accepted withdrawals)` computed in exact arithmetic. This is the strongest S2/S3/S6 oracle and it is independent of representation.

### S4 — rejected operations do not change state

- After every rejection, the balance must be byte-identical to the pre-call value.
- Rejections must not change *any* observable state, not just balance: transaction history/count, sequence numbers, idempotency records, "last error," any persisted file. I will enumerate whatever observable surface the artifact exposes and check all of it, because "state" is not limited to the balance.
- Rejection followed by a valid operation must behave as if the rejection never happened (no poisoned state, no partial mutation left behind).
- Rejection *during* a multi-step operation (if any exist) — check for a partial write.
- If failures are signalled by exception, confirm no mutation happened before the throw.

### S5 — explicit outcomes for the named classes

For each class, the test is *not* "does it do the right thing" (the spec does not say what the right thing is) but **"is there a defined, documented, deterministic, observable outcome?"** An unhandled crash, a silent no-op, a `None`/`null` return with no explanation, or an outcome that differs between runs all fail S5.

- **invalid** — non-numeric input, `null`/`undefined`/`None`, empty string, `NaN`, `Infinity`, `-Infinity`, boolean, list, object, numeric string `"10"`, whitespace `" 10 "`, `Decimal("NaN")`, `Decimal("sNaN")` if decimals are used.
- **zero** — `deposit(0)`, `withdraw(0)`. Accept-as-no-op and reject are both defensible; *undefined* is the failure. Note that accepting zero interacts with S2/S3, which are satisfied trivially by a zero delta.
- **negative** — `deposit(-1)`, `withdraw(-1)`. A negative withdrawal that increases the balance would be a defect (it contradicts S3's "decrease").
- **extremely large** — values near and beyond machine word boundaries: `2**31`, `2**53` (float integer-exactness limit), `2**53 + 1`, `2**63`, `2**64`, `2**256`, `10**100`, and `sys.maxsize`-class values. Deposit a huge amount, then check the balance is exact. Deposit huge twice and check the *sum* is exact — overflow usually appears in accumulation, not in a single value.
- **repeated** — the same operation issued many times; and the *same logical operation* issued twice (idempotency). Idempotency is explicitly unresolved, so: if there is no idempotency key, that is a gap to record, not a defect. If there *is* one, I attack it — replay with the same key and different amount, same key after a rejection, key collision across accounts.
- **concurrent** — see § 3.

### S6 — no silent overflow or precision loss

- The word *silently* is the operative one. An overflow that raises is compliant; an overflow that wraps or saturates is a defect.
- Accumulate many deposits and compare against exact arithmetic.
- If integer minor units are used, probe the boundary where the chosen integer type would wrap; in Python integers are arbitrary-precision so the risk shifts to any place the code passes through `float` — JSON serialization, string formatting, `round()`, division, average/interest calculations, comparison against a float literal.
- If `Decimal` is used, probe context precision (default 28 significant digits) — deposits summing past 28 digits will silently round under the default context. This is a real, commonly-missed silent-precision-loss vector.
- If floats are used anywhere in the value path, S6 is very likely violable and I will produce the minimal witness.
- Persistence round-trip (if any): write and re-read a value; precision loss frequently hides in serialization rather than arithmetic.

## 3. Concurrency approach

Concurrency is named in S5 as needing an explicit outcome, while the README simultaneously lists concurrency as unresolved. So the bar is: **the artifact must state what it does under concurrent access, and that statement must hold.** Three possible artifact positions, each with a different test:

1. **"Not thread-safe / single-threaded only"** — declared. Then concurrency is a *declared* limitation, not a defect; I record it and stop. I will *not* score an honestly-declared limitation as a defect.
2. **"Thread-safe"** — claimed. Then I attack it: N threads × M interleaved deposits/withdrawals against a shared wallet, then assert the S2/S3 conservation property and the S1 invariant. Classic targets are check-then-act on the withdrawal path (`if balance >= amount: balance -= amount`) and non-atomic read-modify-write on the deposit path. I will bias the schedule toward the race — many threads, tight loops, amounts sized so the balance hovers near zero, and where possible a hook or `sys.setswitchinterval` to widen the window.
3. **Silent** — no statement at all. That is the S5 failure I most expect, and I will demonstrate it empirically rather than assert it: if a race can be exhibited, it is simultaneously an S5 gap and evidence of a real defect.

Caveat I will state in the findings rather than hide: a passing concurrency test proves nothing (schedule-dependent, and Python's GIL can mask races that a lock-free implementation would show under real parallelism). Only a failing one is evidence.

## 4. Ambiguity probes — the deliberately unresolved questions

For each, I record the artifact's choice, whether it was declared, and whether any *other* reasonable choice would be equally spec-compliant. Where two defensible choices exist and the spec picks neither, that is a specification gap regardless of how good the implementation is.

| Open question | What I will determine |
|---|---|
| Currency | Single implied currency, or multi-currency? Can you deposit in one currency and withdraw in another? Is currency represented at all? |
| Numeric representation | int minor units / `Decimal` / `Fraction` / float / string? What is the smallest representable unit, and is it stated? |
| Authorization | Is there any notion of an owner or caller? Can any caller withdraw from any wallet? (No auth is spec-compliant here — the spec doesn't require it — but silence about it is a gap.) |
| Idempotency | Is a repeated request deduplicated? Is there a request/transaction id? What happens on replay after a rejection? |
| Concurrency | Per § 3. |
| Persistence | In-memory only, or durable? If durable: crash mid-write, partial file, concurrent writers, and whether a reload reproduces the exact balance. |
| Error semantics | Exceptions vs. return codes vs. result objects? Are error types distinguishable (insufficient funds vs. invalid amount)? Are messages stable? Does an error leak internal state? |
| Balance query | Does reading the balance mutate anything? Does it return a mutable reference the caller could alter to corrupt state? Is the returned type the same as the input type? |
| Overflow ceiling | Is there a stated maximum balance? If not, is "extremely large" actually handled or merely untested? |

## 5. Attack angles beyond the bullet list

- **Aliasing / encapsulation** — if the balance or a history list is returned by reference, an outside caller can mutate state without going through deposit/withdraw, defeating S1–S4 without any arithmetic bug. Probe: mutate whatever the API hands back, then re-read the balance.
- **Constructor bypass** — can a wallet be constructed with a negative opening balance? S1 says the balance never becomes negative; a negative *initial* balance is an obvious hole in that invariant.
- **Type confusion** — `True` is `1` in Python; `deposit(True)` may silently deposit 1. `Decimal` vs `float` vs `int` mixing in comparisons.
- **Argument coercion** — does `deposit("10")` throw, coerce, or corrupt?
- **Ordering** — does `withdraw` check the amount's validity before or after checking sufficiency? The distinction shows up as which error you get for `withdraw(-5)` on a zero balance, and it reveals whether validation is centralized.
- **Reentrancy** — if any callback, hook, or `__eq__`/`__index__` on a custom amount object is invoked mid-operation, can it re-enter and observe or corrupt a half-updated state?
- **Determinism** — run the same sequence twice; any difference is a finding on its own.

## 6. Method and evidence rules

1. Read only the artifact path given by the coordinator: `runs/0001/builder/`. Read implementation and build/run instructions. **Do not** open builder rationale, evidence map, assumption list, or builder-authored tests until explicitly revealed.
2. Adversary tests live only in `runs/0001/adversary/tests/`. The builder's implementation is never edited — if a test needs a shim, the shim goes in the adversary directory.
3. Every finding gets: claim challenged → exact repro → expected → observed → minimal counterexample → classification → evidence.
4. "Expected" must be traceable to a specification bullet. If I cannot trace it, the finding is a specification gap or a mere preference, and I will label it as such rather than dress a preference up as a defect.
5. Prefer a minimal counterexample (single call, smallest value) over a large randomized failure.
6. Property-based/randomized search where it applies, with the failing seed recorded so it replays.
7. Report "no defect found" honestly where that is the result. Per the role prompt, no defect found is evidence from this run, not proof of correctness.

## 7. Predictions recorded in advance

Stated now so that hindsight cannot reshape them, and so a wrong prediction is itself recorded evidence.

- P1 — The artifact resolves at least three of the seven unresolved questions without flagging them, most likely numeric representation, error semantics, and persistence.
- P2 — Concurrency is the least likely bullet to be genuinely satisfied; I expect either an undeclared non-thread-safe implementation or a lock that does not cover check-then-act on withdrawal.
- P3 — Zero-amount operations have an outcome, but an *undocumented* one.
- P4 — If floats appear anywhere in the value path, S6 falls to a two-line counterexample. If `Decimal` or integer minor units are used, S6 likely survives arithmetic but may fall at a serialization or `Decimal`-context boundary.
- P5 — S1 and S4 are the most likely to hold, being the easiest to get right.
- P6 — The specification will end the run with more findings against it than the implementation has, which is the outcome the README's success criteria actually want.

## 8. Known limits of this evaluation

- Passing tests are weak evidence; only counterexamples are strong.
- Concurrency testing is non-deterministic and schedule-dependent; absence of an observed race is not absence of a race.
- I cannot test durability against real power loss, only simulated interruption.
- I am one adversary with one strategy; correlated blind spots between builder and adversary (both being Claude models, both reading the same README) are a live threat to independence and will be recorded in the run record rather than assumed away.
- Any behavior the specification does not constrain cannot be failed — only flagged.
