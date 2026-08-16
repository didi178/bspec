# Post-Reveal Review — Wallet, Run 0002

**Written after** the coordinator authorised reading `builder/assumptions.md`,
`builder/evidence.md`, and `builder/tests/`. Everything here is **post-reveal
evidence**. The pre-reveal `strategy.md` and `findings.md` are unmodified and
should be read as the record of what was derivable from the specification and
the handoff alone.

**Materials revealed:** `builder/assumptions.md` (28 lines), `builder/evidence.md`
(38 lines), `builder/tests/test_wallet.py` (82 lines, 8 tests).

---

## 0. The headline result of the reveal

**Most of my Part B "silent resolution" findings are contradicted.** The builder
disclosed nearly every ambiguity I accused it of resolving silently — clearly,
in `assumptions.md`, and in several cases better than I would have. What I could
observe was not what the builder produced: **the handoff boundary destroyed the
disclosure.**

`RUN.md` step 4 copies only `builder/implementation/` into
`handoff/implementation/`. `assumptions.md` sits one level up and never crosses.
So the adversary is shown an artifact stripped of exactly the document that
answers the question the run is designed to measure — and then asked whether
ambiguity was preserved. I answered "largely not." The correct answer is
**"yes, thoroughly — but the protocol hid it from me."**

This is the most important finding of the reveal stage, and it is a finding about
the **experiment protocol**, not about either agent. I flag it prominently
because a coordinator reading only `findings.md` would draw a materially wrong
conclusion about the builder.

---

## 1. Findings confirmed, weakened, or contradicted

| ID | Pre-reveal classification | Post-reveal status |
|----|---------------------------|--------------------|
| F1 | Hostile `int` subclass → negative balance — implementation defect | **CONFIRMED, strengthened** |
| F2 | Re-entrant validation deadlock — implementation defect | **CONFIRMED** |
| F3 | Applied-but-unreported op under async exception — gap→defect | **CONFIRMED, strengthened to a stated/observable mismatch** |
| F4 | Currency silently absent — spec gap | **CONTRADICTED** (disclosed) |
| F5 | Numeric representation declared in docstring only — spec gap | **CONTRADICTED** (disclosed) |
| F6 | Authorization silently absent — spec gap | **CONTRADICTED** (disclosed) |
| F7 | Persistence silently absent — spec gap | **CONTRADICTED** (disclosed) |
| F8 | Idempotency silently resolved — spec gap | **CONTRADICTED as "silent"; the underlying spec tension is CONFIRMED and was independently found by both roles** |
| F9 | Concurrency claim upheld — no defect found | **CONFIRMED**, and the builder's stated guarantee is more precise than the one I tested against |
| F11 | `MAX_BALANCE` an invented, undocumented cap | **CONTRADICTED as "undocumented"; confirmed as "invented", which the builder itself says** |
| F12 | Zero and type errors share one outcome — inconclusive | **Still inconclusive; the builder anticipated the challenge explicitly** |
| F14 | Toolchain claim (Python 3.9+) verified | **CONFIRMED, and independently corroborated** |
| C1–C7 | No defect found for ordinary inputs | **CONFIRMED** |

### F1 — confirmed and strengthened

`assumptions.md` enumerates invalid inputs as "`bool`, floats, strings, `None`,
zero, and negative integers." `int` **subclasses** appear nowhere in the
assumptions, and the builder's test vector is `(0, -1, 1.5, "1", None, True)` —
six values, none of them a subclass. Neither the design nor the test suite
contemplates that `amount > 0` dispatches to caller-controlled code.

The finding is strengthened rather than merely confirmed, because the builder's
final assumption *invites* it:

> The meaning of "invalid" and "extremely large" is not defined by the source;
> this implementation's exact classifications are assumptions suitable for
> adversarial challenge.

F1 is precisely that challenge landing. The builder correctly identified the
class of weakness and did not close it.

**My severity assessment does not change:** still low, still requires a
deliberately hostile subclass, still not reachable by accident (`IntEnum`,
`IntFlag`, `bool`, and `__index__` objects all behave correctly). I am not
inflating it now that I know it went unanticipated.

### F2 — confirmed

`assumptions.md` states "Every method call is one atomic operation." Reentrancy
is not discussed; `Lock` versus `RLock` is not discussed. No builder test
exercises re-entry. Confirmed, severity unchanged (low, shares F1's precondition).

### F3 — confirmed and upgraded

Pre-reveal I classified F3 as "spec gap → implementation defect, I lean toward
gap," because the only claim I could hold it against was the handoff README's
"every mutation returns a `Result`."

`assumptions.md` makes a stronger and more specific claim:

> Every method call is one atomic operation.
> Results report a symbolic outcome plus the balance immediately after that
> atomic operation.

F3 exhibits a method call that mutates state and reports **no** outcome at all.
That is now a **mismatch between stated and observable behavior** — the category
my role prompt names explicitly — rather than an under-specified corner. I am
revising the classification **upward** post-reveal, and recording that the
revision was only possible because the assumptions were revealed.

**Preserved disagreement:** a reasonable reader may hold that "atomic operation"
means *atomic with respect to other threads* (which it is — the lock is released
correctly and no other thread can observe a torn state) rather than *atomic with
respect to the calling thread's control flow* (which it is not). Under the
narrower reading F3 is not a mismatch at all. I do not think the builder's
sentence disambiguates this, and I am not going to resolve it by fiat. Both
readings should survive into the coordinator report.

### F4–F7, F11 — contradicted

Direct quotations from `assumptions.md`:

- **Currency / numeric representation (F4, F5):** "Amounts are positive Python
  integers representing indivisible, currency-neutral units. Currency,
  fractional units, rounding, and exchange are unresolved."
- **Authorization, persistence, identity (F6, F7):** "State is in memory only.
  Persistence, durability, multi-process coordination, authentication,
  authorization, account identity, audit history, and transfers are outside what
  the supplied behavior states."
- **`MAX_BALANCE` (F11):** "The maximum balance is `2^63 - 1`… **This bound is an
  implementation assumption, not a requirement inferred from the source.**"

All five were declared, and the `MAX_BALANCE` disclosure is better than my
finding demanded — the builder not only documented the cap but flagged it as an
*unforced* choice, which is exactly the discipline the experiment is trying to
elicit.

**What survives, restated as a narrower finding (new, post-reveal):** the
delivered `implementation/` package is not self-describing. A consumer who
receives only `wallet.py` and `implementation/README.md` — which is what
`prepare-handoff` produces, and plausibly what a downstream integrator would
receive — cannot recover any of it. The disclosure lives in a sibling file
outside the shipped unit. Whether that is a defect depends on whether
`assumptions.md` is considered part of the deliverable; the experiment's own
handoff step says it is not. **Classification: protocol/packaging gap, not a
builder defect.**

### F8 — contradicted as "silent"; the tension is confirmed by both roles

The builder wrote:

> Repeated calls are distinct operations and are not deduplicated. **Idempotency
> cannot be expressed because the supplied behavior has no operation IDs.**

That is not silence — it is a reasoned answer that reaches the same conclusion I
did from the opposite direction. My `findings.md` argued the specification
contains an internal contradiction (bullet C5 demands explicit outcomes for
repeated operations while the prose lists idempotency as deliberately
unresolved); the builder independently hit the same wall and resolved it by
observing that the spec supplies no operation identity to key on. **Two
independent roles converging on the same specification defect is the strongest
evidence this run produced** — see §3.

---

## 2. Builder assumptions that were properly disclosed

Assessed against the seven questions the README names as deliberately
unresolved, plus choices the builder made beyond them.

| Question | Disclosed? | Quality of disclosure |
|---|---|---|
| Currency | ✅ | Named as unresolved, with the specific sub-questions (fractional units, rounding, exchange) |
| Numeric representation | ✅ | Explicit: positive Python integers, indivisible units |
| Authorization | ✅ | Named as outside the supplied behavior |
| Idempotency | ✅ | Resolved **with a reason** — no operation IDs exist to key on |
| Concurrency | ✅ | Precise: per-call atomicity, lock-acquisition order, and an explicit *refusal* to guarantee fairness or ordering |
| Persistence | ✅ | Named, alongside durability and multi-process coordination |
| Error semantics | ✅ | Result/Outcome, no exceptions; exception types and serialization named as still unresolved |
| Initial balance (not on the README's list) | ✅ | "A wallet starts at zero. Initial balance was not specified." |
| `MAX_BALANCE = 2^63−1` | ✅ | Flagged as an implementation assumption, *not* inferred from the source |
| Why huge withdrawals return `INSUFFICIENT_FUNDS` not `OVERFLOW` | ✅ | Reasoned: "no arithmetic is attempted" |
| Limits of its own classifications | ✅ | "assumptions suitable for adversarial challenge" |

**This is a strong disclosure record — 11 for 11**, including two questions the
README did not ask (initial balance; the overflow/insufficient-funds boundary).
The builder also volunteered the limits of its own choices, which is the
behaviour `RUN.md` is trying to measure and which I could not see.

**Not disclosed:** the trust model for the `amount` argument (F1's precondition);
reentrancy (F2); caller-side atomicity under async exceptions (F3). These are the
three real defects, and the correlation is not a coincidence — the builder
disclosed every ambiguity it *recognised*, and the defects live exactly where it
recognised none.

**One tension inside the disclosure:** `assumptions.md` says "invalid input does
not raise an exception," but arity errors do — `w.deposit()` raises `TypeError`
(post-reveal probe, `evidence/post_reveal_probe.log`). I regard this as a stretch
rather than a violation: a missing argument is not an "amount," so the sentence
plausibly does not reach it. Recorded, not asserted as a finding.

---

## 3. Gaps found independently by both roles

These are the highest-confidence results of the run, because two isolated roles
reached them by different routes.

1. **Idempotency is unspecifiable as written.** Adversary: C5 demands an explicit
   outcome for "repeated" operations while the prose declares idempotency
   unresolved — an internal contradiction (`findings.md` F8, and proposed
   revision 1). Builder: "Idempotency cannot be expressed because the supplied
   behavior has no operation IDs." Same defect, opposite directions of approach.
   **This should be the first specification revision.**
2. **"Invalid" and "extremely large" are undefined terms.** Builder: "The meaning
   of 'invalid' and 'extremely large' is not defined by the source." Adversary:
   `strategy.md` §1.1 flagged C5 as "the load-bearing bullet" precisely because
   it names input classes the spec never defines, and `findings.md` F12 raised
   whether distinct rejection reasons must be distinguishable.
3. **`MAX_BALANCE` is an unforced invention.** Builder disclosed it as "an
   implementation assumption, not a requirement inferred from the source."
   Adversary reached the same judgement independently (F11: "Python integers are
   unbounded, so no overflow is technically possible and C6 would be satisfied
   trivially").
4. **The `OVERFLOW` vs `INSUFFICIENT_FUNDS` boundary is a choice, not a
   derivation.** Builder reasoned it out explicitly; adversary tested that the
   two outcomes stay distinguishable (`test_outcomes_are_distinguishable`).
5. **Toolchain ambiguity in the run environment.** Builder's `evidence.md`: "The
   adapter directory resolved `python3` to 3.14.5, while the prepared run
   directory resolved it to 3.9.6." Adversary independently ran the suite on
   **both** interpreters (33/33 on each). Neither role was told about the other's
   observation. Genuine independent corroboration, and a reason the run's
   toolchain field should name an absolute interpreter path.

---

## 4. Gaps and defects found only by the adversary

**Defects (all three real findings are adversary-only):**

- **F1** — negative balance via an `int` subclass with a lying `__gt__`. Not in
  the assumptions, not in the tests.
- **F2** — permanent deadlock via re-entrant validation inside a non-reentrant
  `Lock`.
- **F3** — state advances while the caller receives an exception; now a
  stated/observable mismatch against "every method call is one atomic operation."

**Properties the builder asserted but did not test:**

- **Precision (C7).** `evidence.md` maps "arithmetic cannot silently overflow or
  lose precision" to "`test_maximum_balance_and_overflow`; invalid non-integer
  cases." Overflow is tested; **precision is not tested at all** — the mapped
  evidence covers only rejection of `1.5`. Adversary-only:
  `test_2_53_plus_1_survives_exactly` (exact storage of `9007199254740993`),
  `test_no_float_accumulation_error`, `test_order_independence` (60 permutations),
  `test_fractional_amounts_are_not_silently_rounded` across six float values.
  The property does hold — but the builder's evidence map claims coverage it does
  not have. **This is the one place I would push back on `evidence.md` as a
  document.**
- **Conservation over long runs.** 50,000-operation drift check against a
  reference model; 2,000 randomised sequences with delta-debugging shrinkage. No
  builder equivalent.

**Input classes tested only by the adversary:** `Decimal`, `Fraction`, `bytes`,
`complex`, `object()`, `[]`, `{}`, `()`, `False`, `-0.0`, `NaN`, `±Inf`, `""`,
`"abc"`, `10**400`, `10**1_000_000`, `2**31/2**53/2**53+1/2**63/2**64`,
`IntEnum`, `IntFlag`, objects exposing only `__index__`. Builder tested six.

**Structural properties tested only by the adversary:** `Result` immutability;
`balance()` purity over 100 reads; wallet isolation across 2 and 50 instances;
overflow-by-accumulation (individually-valid deposits summing past the cap);
boundary deposit landing exactly on `MAX_BALANCE`; direct `_balance` write;
module-global `MAX_BALANCE` rebinding; resource cost of absurd integers;
execution on two interpreters.

**Concurrency depth.** Both roles tested the same two properties, but the
adversary's harness applies more pressure — `threading.Barrier` to force
simultaneous arrival at the critical section, 40 repeated rounds, and a mixed-op
conservation check across ~240,000 operations. The builder's tests have no
barrier and run once each. Same conclusion, different confidence.

---

## 5. Builder tests that overlap with adversary tests

| Builder test | Adversary counterpart | Relative depth |
|---|---|---|
| `test_initial_balance` | *(none explicit — see §6)* | **builder only** |
| `test_deposit_and_withdraw_exact_amount` | `C2C3Exactness.test_deposit_exact` / `test_withdraw_exact` | adversary broader (6 magnitudes up to 10¹⁸, checks `r.balance == balance()`) |
| `test_invalid_amounts_are_rejected_without_state_change` | `C4RejectionPurity.test_rejected_deposits/withdrawals_leave_state_untouched` | adversary broader (22 values vs 6; superset) |
| `test_insufficient_funds_does_not_change_state` | `test_overdraw_by_one_unit`, `test_insufficient_funds_leaves_state_untouched` | comparable; adversary adds the exact-balance→0 boundary |
| `test_maximum_balance_and_overflow` | `test_overflow_is_explicit_not_wrapped`, `test_boundary_deposit_exactly_to_cap`, `test_overflow_by_accumulation` | adversary adds accumulation and the exact-cap landing |
| `test_repeated_operations_are_each_applied` | `test_repeated_identical_operations_accumulate` | adversary deeper (100 iterations, per-step balance assertion) |
| `test_concurrent_deposits_are_not_lost` | `test_concurrent_deposits_lose_no_updates`, probe P12 | adversary deeper (32 threads + barrier vs 4 threads) |
| `test_concurrent_withdrawals_never_make_balance_negative` | `test_concurrent_withdrawals_never_overdraw`, probe P11 | adversary deeper (barrier-synchronised, 40 rounds) |

**Overlap: 7 of 8 builder tests have an adversary counterpart, and in every case
the adversary version is a superset or strictly more stressful.** This is a
notable independence result — despite deriving tests from the same seven bullets
with no contact, the two suites cover nearly the same ground, differing in depth
rather than direction. See §8.

Only `test_initial_balance` has no direct adversary equivalent; I asserted
`balance() == 0` incidentally inside other tests but never as a named property.

---

## 6. Important cases missed by both roles

Verified post-reveal (`evidence/post_reveal_probe.log`) unless marked untested.

1. **Arity and keyword abuse.** Neither suite calls `deposit()` with no
   argument, two arguments, or `amount=` as a keyword. All behave sanely —
   `TypeError` for wrong arity, keyword accepted — but this brushes against the
   builder's "invalid input does not raise an exception" (see §2).
2. **`Wallet` is not picklable or deep-copyable.** `pickle.dumps(Wallet())` and
   `copy.deepcopy(Wallet())` both raise `TypeError: cannot pickle
   '_thread.lock' object`. Neither role tested this, and it matters: the
   concurrency resolution (a `Lock` as an instance attribute) **forecloses the
   simplest persistence route**, and persistence was disclosed as out of scope
   independently. Two separately-reasoned decisions interact in a way neither
   document notes. `Result`, by contrast, pickles cleanly.
3. **Subclassing `Wallet`.** A subclass that omits `super().__init__()` fails
   with `AttributeError: 'Sub' object has no attribute '_lock'` rather than
   anything diagnostic. Minor; noted for completeness.
4. **Free-threaded (no-GIL) CPython.** Both roles tested only GIL-enabled
   builds (`sys._is_gil_enabled()` → `True`). The `Lock` should suffice, but
   neither of us has evidence. **Untested — the single largest residual risk.**
5. **Real signal delivery.** F3 was demonstrated via `sys.settrace`; neither role
   attempted an actual `SIGINT`/`signal.alarm` landing in the window.
   **Untested.**
6. **Read linearizability under concurrent writes.** Both concurrency tests read
   the balance only after `join()`. Neither checks that a `balance()` call
   *interleaved* with writers returns a value corresponding to some real
   linearization point. **Untested.**
7. **Memory/liveness over very long runs.** Adversary reached 50,000 sequential
   and ~240,000 concurrent operations; neither role ran an endurance test or
   watched for lock starvation, which the builder's own "no fairness guarantee"
   disclosure makes a live question. **Untested.**
8. **Serialization boundaries.** No JSON/JSONL round-trip — the classic place a
   `2^53` precision bug appears, and `MAX_BALANCE` exceeds JavaScript's safe
   integer range. Outside the artifact, but the builder chose `2^63−1` and no one
   tested what happens at that boundary in a realistic consumer.

---

## 7. Evidence that the builder silently resolved ambiguity

**Very little — and much less than `findings.md` alleges.** Corrected assessment:

**Not silent (contradicting my pre-reveal claims):** currency, numeric
representation, authorization, persistence, idempotency, concurrency semantics,
error semantics, initial balance, the `MAX_BALANCE` cap, and the
overflow/insufficient-funds boundary. All disclosed in `assumptions.md`, several
with reasoning and one with an explicit "this is an assumption, not a
requirement."

**Genuinely undisclosed resolutions (all implicit, none of them declared):**

1. **The `amount` argument's trust model.** Validation by `isinstance` +
   caller-controlled `>` silently assumes cooperative callers. Undeclared, and
   F1 is its consequence.
2. **Reentrancy.** Choosing `Lock` over `RLock` and validating inside the
   critical section resolves re-entry as "deadlock." Undeclared; F2.
3. **Caller-side atomicity.** "Every method call is one atomic operation" is
   stated, but the mutation-then-report window means the guarantee holds between
   *threads*, not against the calling thread's own control flow. The narrowing is
   silent; F3.
4. **`Outcome` as a `str`-subclassing enum** makes `result.outcome ==
   "accepted"` true, quietly widening the public contract to bare strings.
   Undeclared. Benign, but it is a compatibility commitment nobody chose out loud.
5. **`MAX_BALANCE` as a mutable module global.** The *value* is disclosed; that
   it is rebindable process-wide and shared across all wallets is not.

**Pattern:** every silent resolution is a *mechanism*-level consequence of an
implementation choice, while every disclosed resolution is a *domain*-level
question the README named. The builder audited the specification for ambiguity
thoroughly and its own code for emergent ambiguity not at all. That distinction
is, I think, the most transferable lesson of this run for BSpec: **a disclosure
discipline aimed at the spec's open questions does not catch the open questions
the implementation creates.**

---

## 8. Limits caused by shared models, systems, context, or tools

- **Same model family, and it shows.** Both roles were Claude (adversary: Claude
  Opus 5, 1M context, `claude-opus-5[1m]`). `RUN.md` recommends different systems
  for the two roles; this run did not do that. The consequence is visible and
  measurable: **7 of 8 builder tests have a direct adversary counterpart**, and
  the two suites differ in depth, not direction. Independently derived test
  suites should not align that closely. Every "no defect found" result in
  `findings.md` should be discounted accordingly — we plausibly share the blind
  spot rather than having jointly excluded a defect.
  **Supporting evidence for the shared-blind-spot reading:** the four
  most significant cases missed by *both* roles (§6.2, §6.4, §6.5, §6.6) are
  cases where the artifact's *mechanism* creates the risk, matching exactly the
  category the builder failed to self-audit in §7. Both roles reasoned about the
  domain well and about the runtime poorly, in the same way.
- **The handoff protocol distorted the primary measurement.** Because
  `prepare-handoff` copies only `implementation/`, the adversary was structurally
  unable to distinguish "resolved silently" from "resolved and disclosed
  elsewhere," yet `RUN.md` §"Current scope" makes that exact distinction the
  run's purpose. Five of my findings are artifacts of the protocol. **Recommended
  revision:** either copy `assumptions.md` into the handoff (it is the builder's
  *declaration*, not its rationale or tests), or state in the adversary prompt
  that undisclosed-in-handoff must not be reported as undisclosed-by-builder.
  I lean toward the former — an artifact's declared assumptions are part of its
  observable behavior contract.
- **Shared toolchain and machine.** Same macOS host, same CPython builds, same
  GIL-enabled configuration, same `unittest` runner, no third-party fuzzer or
  property-testing library (no Hypothesis; I hand-rolled generation and
  shrinking). Concurrency results in particular come from one scheduler on one
  machine.
- **Shared filesystem context.** Both roles ran under the same `CLAUDE.md` and
  the same repository, so any framing effect in those files applies to both.
- **Adversary self-limits carried over:** absence of a counterexample remains
  evidence from one run, not proof; my readings of C4, C5, and "atomic" are
  interpretations, and §1's preserved disagreement about F3 shows one of them is
  genuinely contestable.

---

## Recommended additions to the coordinator report

1. **Do not read `findings.md` Part B as a builder result.** F4–F8 and F11 are
   contradicted; the builder's disclosure record is 11 for 11. The gap they
   describe is in the handoff protocol.
2. **Three defects stand:** F1, F2 (both low severity, exotic preconditions) and
   F3 (upgraded post-reveal to a stated/observable mismatch, with a preserved
   disagreement about what "atomic" means).
3. **The strongest joint result** is that both roles independently found
   idempotency unspecifiable as written. Revise the specification first.
4. **`evidence.md` overclaims on precision** — the C7 row maps to tests that only
   cover overflow and non-integer rejection. The property holds (adversary
   verified it); the evidence map should not claim it was tested when it was not.
5. **Independence was weak** and the near-identical test coverage is the measured
   proof. Re-run with different systems per role before treating any "no defect
   found" as meaningful.
