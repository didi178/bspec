# Adversary Test Strategy — Wallet, Run 0002

**Status:** authored *before* inspecting `handoff/implementation/`, builder rationale,
builder tests, or the builder-filled sections of `run-record.md`.

**Derived solely from:** `experiments/wallet/README.md` (candidate behavior section)
and `agents/adversary.system.md`.

**Adversary model:** Claude Opus 5 (1M context), `claude-opus-5[1m]`, Claude Code CLI.

---

## 1. The specification as written

The README supplies seven bullets and then explicitly disclaims completeness:

> These bullets are prompts, not a complete specification. Questions such as currency,
> numeric representation, authorization, idempotency, concurrency, persistence, and
> error semantics are deliberately unresolved.

I therefore treat the run as having two distinct falsification targets:

- **T1 — Claim conformance.** Does the artifact violate one of the seven bullets under
  its *own* chosen interpretation? Any violation here is an **implementation defect**,
  because the bullet is unconditional.
- **T2 — Ambiguity handling.** Where the README leaves a question open, did the builder
  (a) resolve it silently, (b) resolve it and declare it, or (c) preserve it? Silent
  resolution of a question the README names as unresolved is a **specification gap**
  finding, and per `RUN.md` §"Current scope" it is the primary thing this run measures.

A defect and a gap are reported separately. I will not upgrade a gap to a defect just
because I dislike the choice, and I will not downgrade a defect to a gap just because
the README is thin — the seven bullets are unconditional and admit no interpretation
that permits violating them.

### 1.1 Restating the bullets as falsifiable claims

| ID | Claim (verbatim intent) | Falsified by |
|----|--------------------------|--------------|
| C1 | The balance never becomes negative. | Any reachable state with balance < 0. |
| C2 | Successful deposits increase the balance by *exactly* the deposited amount. | `post − pre ≠ amount` after a deposit reported successful. |
| C3 | Successful withdrawals decrease it by *exactly* the withdrawn amount. | `pre − post ≠ amount` after a withdrawal reported successful. |
| C4 | Rejected operations do not change state. | Any observable state delta across an operation reported rejected. |
| C5 | Invalid, zero, negative, extremely large, repeated, and concurrent operations have *explicit* outcomes. | An input class in that list with no defined/reachable outcome: crash, hang, silent no-op, undocumented behavior, or an outcome indistinguishable from a different one. |
| C6 | Arithmetic cannot silently overflow. | A value change that wraps, saturates, or truncates without an explicit rejection. |
| C7 | Arithmetic cannot silently lose precision. | A stored/reported amount that differs from the requested amount by rounding, or a sum whose associativity/order changes the balance. |

C5 is the load-bearing bullet: it converts *"the spec is silent"* into *"the spec
requires an explicit answer"* for seven named input classes. An implementation that is
silent about, say, zero-amount deposits fails C5 even though the README never says what
the outcome of a zero deposit should be. This is the sharpest lever I have and I will
lean on it hard.

### 1.2 Explicitly unresolved by the README (test as ambiguity, not as defect)

currency · numeric representation · authorization · idempotency · concurrency ·
persistence · error semantics

Note the tension I will probe throughout: **C5 and C6/C7 partially re-resolve what the
README says is unresolved.** "Extremely large" and "concurrent" operations must have
explicit outcomes (C5) and arithmetic must not silently overflow (C6) — yet numeric
representation and concurrency are listed as open. So the builder cannot legitimately
answer "concurrency is out of scope"; the spec demands *an explicit outcome*, even if
that outcome is a documented refusal to support concurrent use. Same for numeric
representation: any choice is permitted, but the choice must not lose precision or wrap.
An implementation that resolves the open question *by ignoring it* fails C5/C6/C7.

---

## 2. Falsification plan

### 2.1 Invariant / property testing (targets C1, C2, C3, C4)

Randomized operation sequences against a reference model, checking after every step:

- **P1 (non-negativity):** `balance >= 0` after every operation, accepted or rejected.
- **P2 (deposit exactness):** for each accepted deposit, `post = pre + amount` exactly —
  compared in a representation that cannot itself lose precision (decimal/integer, never
  float).
- **P3 (withdrawal exactness):** for each accepted withdrawal, `post = pre − amount`.
- **P4 (rejection purity):** for each rejected operation, the *entire* observable state
  is byte-identical before and after — not just the balance. Hidden state counts:
  transaction logs, sequence numbers, idempotency caches, error counters, persisted
  files. "Does not change state" is stated without qualification, so I read it strictly
  and will report any hidden mutation, classifying it as a defect only if the mutation
  is observable through the artifact's own public surface, and as a gap otherwise.
- **P5 (conservation):** `final balance = Σ accepted deposits − Σ accepted withdrawals`,
  starting from the initial balance. Catches drift that per-step checks miss.
- **P6 (no unreported partial application):** every operation is total — it either fully
  applies and reports success, or does not apply and reports failure. A third outcome
  (throw *and* mutate, or mutate *and* report failure) falsifies C4.

Shrinking to a minimal counterexample is required for any property failure; I will report
the shrunk sequence, not the raw random one.

### 2.2 Boundary and adversarial input catalogue (targets C5, C6, C7)

Run against both deposit and withdrawal, and against balance query where meaningful.

**Zero and sign**
- amount = 0 — accepted-as-no-op, or rejected? Either is defensible; *no explicit
  outcome* falsifies C5. If accepted as a no-op, cross-check C4 does not apply and that
  the operation is reported as success rather than silently swallowed.
- amount < 0 — a negative deposit is a disguised withdrawal and vice versa. If a negative
  deposit is accepted, C1 falls immediately (deposit −100 into an empty wallet). This is
  my highest-value single probe.
- negative zero, where the numeric type admits it.

**Withdrawal against balance**
- withdraw exactly the balance → 0 (allowed by C1: zero is not negative).
- withdraw balance + smallest representable unit → must reject (C1).
- withdraw from an empty/zero wallet.
- withdraw from a wallet whose balance was never explicitly initialized.

**Magnitude / "extremely large" (C5, C6)**
- amounts at and beyond the boundaries of the plausible underlying types:
  2^31−1, 2^31, 2^53−1, 2^53, 2^53+1, 2^63−1, 2^64, and far beyond.
- **Overflow by accumulation**, which is the interesting case and the one a single-value
  test misses: repeated large deposits that individually validate but whose *sum* exceeds
  the representable range. C6 says overflow cannot be *silent*; if there is a maximum
  balance it must be an explicit, reachable, documented outcome. If the type is unbounded
  (bignum/decimal), I instead probe for resource exhaustion — a 10^10000-digit amount that
  hangs or OOMs is C5's "extremely large … explicit outcome" failing as a liveness bug.
- `2^53 + 1` specifically: if the artifact round-trips amounts through IEEE-754 double
  anywhere (including JSON serialization), this value is not representable and C7 falls.

**Precision (C7)**
- fractional amounts: `0.1 + 0.2` must not yield `0.30000000000000004`. Deposit 0.1 ten
  times and assert the balance is exactly 1, not 0.9999999999999999.
- amounts with more decimal places than the implied currency scale (`0.005`, `1.005`,
  `0.000001`) — silently rounded (falsifies C7), rejected (satisfies C5), or accepted at
  full precision (satisfies C7 but raises a currency-scale gap)?
- half-way rounding cases if any rounding exists at all: `2.5`, `−2.5`, `0.125`.
- ordering/associativity: the same multiset of amounts applied in different orders must
  reach the same balance.

**Type and encoding abuse (C5's "invalid")**
- non-numeric input: `null`, `undefined`/`None`, `""`, `"abc"`, `"12abc"`, `[]`, `{}`,
  booleans, objects with a coercing `toString`/`valueOf`/`__str__`.
- numeric strings: `"100"` — accepted by coercion (a gap, since it widens the contract
  silently) or rejected?
- `NaN`, `+Infinity`, `−Infinity` — `NaN` is the sharpest: if a `NaN` amount is accepted,
  the balance becomes `NaN`, after which *every* comparison including `balance >= 0` is
  false, and C1's guard is permanently disabled. This is a single-input total invariant
  kill and I will try it early.
- string amounts in exotic formats: `"1e3"`, `"0x10"`, `" 1 "`, `"1_000"`, `"１"`
  (fullwidth), `"١٢٣"` (Arabic-Indic digits), `"+1"`, `"1."`, `".1"`.
- missing arguments entirely; extra arguments; wrong arity.

**Repeated operations (C5)**
- the same logical operation submitted twice: applied twice (no idempotency) or once
  (idempotency)? Either is permitted by the README, but the outcome must be *explicit*.
  If there is an idempotency key, I will probe key reuse with a *different* amount —
  the classic ambiguity — and key collision across distinct wallets.
- long runs (10^5 operations) to surface accumulation, leaks, or drift.

**Concurrency (C5)**
- concurrent withdrawals racing the balance check: N parallel withdrawals of the full
  balance must not overdraw. The canonical check-then-act TOCTOU. If the artifact is
  single-threaded by construction (e.g. a synchronous library in a single-threaded
  runtime), I will say so plainly and instead probe *interleaving through asynchrony* —
  `await` points, callbacks, or generators between the check and the write — which
  reintroduces the race without threads.
- concurrent deposits: lost-update check, `Σ` must be exact.
- reentrancy: an operation triggered from within a callback/hook the artifact invokes
  mid-operation, if any such extension point exists.
- if concurrency is genuinely unsupported, C5 demands that be an *explicit* outcome
  (documented refusal, lock, or error) rather than undefined corruption.

**State and lifecycle**
- balance query as a pure observation: querying must never mutate; querying between
  operations must never change results.
- multiple wallets: cross-wallet interference, shared mutable state, static/global
  accumulators.
- if any state is exposed by reference, mutating the returned object must not corrupt the
  wallet (aliasing / defensive-copy check).
- persistence, if present: crash mid-write, reload, and re-check C5 conservation.

### 2.3 Ambiguity audit (the run's primary measurement)

For each of the seven README-declared open questions plus each additional open question I
find, I will record: the builder's resolution, whether it was **declared or silent**, and
whether the artifact's behavior actually matches its own declaration. A declared
assumption contradicted by observed behavior is an implementation defect, not a gap —
that is the "mismatch between stated and observable behavior" my role prompt names, and
it is a distinct and more serious finding than either category alone.

I will also look for **unforced resolutions**: places the builder invented product
behavior (accounts, users, fees, currencies, transaction history, audit logs) that the
README neither requested nor implied. Per `RUN.md`, silently inventing a complete wallet
product is the failure mode this run exists to detect.

### 2.4 Toolchain and reproducibility

Build and run per the handoff's own instructions, unmodified. If the artifact does not
build, or the documented commands do not work, that is a **toolchain issue** reported as
such — not an implementation defect — and I will still evaluate by inspection and report
the reduced confidence. I will not edit the implementation to make anything pass; any
harness or shim I need lives under `adversary/tests/`.

---

## 3. Execution order

1. Read `handoff/implementation/` — public surface and build instructions only, to learn
   how to invoke it. (No builder rationale, no builder tests.)
2. Get it building and running; record exact commands and versions.
3. Fire the single-input invariant kills first: negative deposit, `NaN`, `null`,
   overdraw-by-one. These are cheap and each one alone falsifies a claim.
4. Boundary catalogue (§2.2), then property/model testing (§2.1) with shrinking.
5. Concurrency and repetition probes.
6. Ambiguity audit (§2.3).
7. Write `findings.md` with claim, repro, expected, observed, minimal counterexample,
   classification, evidence; plus untested risks and limits.

---

## 4. Predicted defect classes (recorded now, to be scored later)

Stated in advance so that hindsight cannot inflate the result. Ranked by my prior
probability of finding something:

1. **Precision** — a float representation somewhere in the path (storage, parsing, or
   serialization), falsifying C7 on `0.1 + 0.2` or `2^53 + 1`.
2. **Zero / negative amounts** — either accepted where they should be rejected, or
   rejected with an outcome that is undocumented rather than explicit (C1, C5).
3. **Concurrency** — no interleaving control, so a TOCTOU overdraw is reachable, or the
   question is silently declared out of scope (C1, C5).
4. **Extremely large values** — an upper bound that either wraps, or is unbounded and
   exhausts resources, with no explicit outcome either way (C5, C6).
5. **Idempotency** — resolved silently in whichever direction, with repeated operations
   having no *explicit* documented outcome (C5).
6. **Non-numeric input** — coerced rather than rejected, widening the contract (C5).

## 5. Known limits of this evaluation, stated up front

- Absence of a counterexample is evidence from one run under one toolchain, not proof of
  correctness. Randomized properties explore a sample of the input space, not all of it.
- I cannot test properties of a surface the artifact does not expose; unobservable
  internal state may violate invariants I cannot reach.
- Concurrency findings are inherently probabilistic; a race I do not reproduce may still
  exist, and a race I do reproduce may be schedule-dependent on this machine. I will
  report attempt counts and note when a result is non-deterministic.
- My reading of the seven bullets is itself an interpretation. Where an interpretation is
  load-bearing for a finding, I will state it explicitly in that finding so a reader can
  disagree with the interpretation without discarding the evidence.
- I share a model family with the builder if the run pairs Claude with Claude, so
  correlated blind spots are likely and this is a threat to independence that the
  coordinator should record regardless of what I find.
