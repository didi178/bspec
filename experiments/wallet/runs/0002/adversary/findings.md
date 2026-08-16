# Adversary Findings — Wallet, Run 0002

**Authored after** `strategy.md` was saved and after inspecting only
`handoff/implementation/`. Builder rationale, builder tests, and the
builder-filled sections of `run-record.md` were **not** consulted.

## Artifact under evaluation

| | |
|---|---|
| `handoff/implementation/wallet.py` | sha256 `454cedad31f76d868d9645a71ad58dd235fb22a7255ca59c96600f04a6a0f4d5` (64 lines) |
| `handoff/implementation/README.md` | sha256 `d0f0656599cc16cb3d7dbb5c4dd9dc27a6d539a4ed7803a3996f6ad9149a5ead` (23 lines) |
| Adversary model | Claude Opus 5 (1M context), `claude-opus-5[1m]`, Claude Code CLI |
| Toolchains | CPython 3.14.5 (arm64, GIL enabled) and CPython 3.9.6 (`/usr/bin/python3`) |
| Dependencies | none (stdlib only) |

**Build/run:** no build step. Evaluated with

```sh
cd runs/0002
PYTHONPATH=handoff/implementation python3 -B -m unittest discover -s adversary/tests -p 'test_*.py' -v
PYTHONPATH=handoff/implementation python3 -B adversary/tests/probe_exotic.py
PYTHONPATH=handoff/implementation python3 -B adversary/tests/probe_interrupt.py
```

The implementation was not modified. All adversary artifacts live under
`adversary/`; raw output is in `adversary/evidence/`.

## Headline

The seven specification bullets **hold under every ordinary input and under
heavy concurrency**: 33/33 conformance tests pass on both toolchains, including
2,000 randomised model-checked sequences, a 50,000-operation drift check, and
~240,000 contended concurrent operations with zero invariant or conservation
violations. This is a genuinely solid implementation of the stated claims.

The findings below are therefore of two kinds: three narrow **implementation
defects** reachable only through non-obvious call patterns, and seven
**specification gaps** where a question the README explicitly names as unresolved
was resolved silently. For this experiment the gaps are the more important
result — per `RUN.md`, this run exists to measure whether ambiguity is preserved
or quietly invented away.

---

# Part A — Implementation defects

## F1 — `balance` can be driven negative by an `int` subclass with a lying `__gt__`

- **Behavioral claim challenged:** C1, "the balance never becomes negative."
  Also C2, "successful deposits increase the balance by exactly the deposited
  amount."
- **Reproduction** (`adversary/tests/probe_exotic.py`, probe P1):

  ```python
  from wallet import Wallet

  class Sneaky(int):
      def __gt__(self, other):
          return other == 0        # True for the validity check, False for the cap check

  w = Wallet()
  w.deposit(Sneaky(-100))
  ```

- **Expected:** rejection with `Outcome.INVALID_AMOUNT`, balance stays `0`.
- **Observed:** `outcome=accepted`, `wallet.balance() == -100`.
- **Minimal counterexample:** `Wallet().deposit(Sneaky(-100))` — one call, one
  four-line class.
- **Mechanism:** `_valid_amount` (wallet.py:62-64) establishes validity with
  `isinstance(amount, int) and not isinstance(amount, bool) and amount > 0`. For
  an `int` subclass, `amount > 0` dispatches to the *subclass's* `__gt__`, so the
  guard is attacker-controlled. `isinstance` is then satisfied by inheritance
  while the comparison result is a lie. The subsequent overflow guard
  (`amount > MAX_BALANCE - self._balance`, wallet.py:46) is defeated by the same
  override, and `self._balance += amount` (wallet.py:48) uses the real numeric
  value. The `assert isinstance(amount, int)` on wallet.py:45 does not help — it
  is already true.
  A symmetric attack inflates the balance on the withdrawal path: `withdraw(Sneaky(-1000))`
  against a balance of 50 was **accepted** and produced a balance of **1050**,
  falsifying C3 as well.
- **Classification:** **implementation defect** (low severity — exotic
  precondition), **compounded by a specification gap**.
- **Severity and honest caveats:** this requires the caller to deliberately pass
  a hostile `int` subclass; a caller who can do that is already running code in
  the process. I checked whether any *naturally occurring* subclass triggers it:
  `IntEnum`, `IntFlag`, and plain `bool` do **not** — they coerce cleanly or are
  rejected (`deposit(Coin.FIVE)` → accepted, balance 5, stored as plain `int`),
  and objects exposing only `__index__` are rejected. So this is not reachable by
  accident. It is nonetheless a real falsification of an **unconditional** claim,
  and the fix is one line: validate against the primitive value
  (`type(amount) is int`, or `int(amount)` after the isinstance check) rather
  than trusting `__gt__`.
- **The associated gap:** the README never states the trust model for the
  `amount` argument. If callers are trusted, F1 is uninteresting; if they are
  not, it is a live overdraft. The specification does not let a reader decide,
  and the implementation does not declare an answer.

## F2 — Re-entrant validation deadlocks the wallet permanently

- **Behavioral claim challenged:** C5, "invalid … operations have explicit
  outcomes." A permanent hang is not an outcome.
- **Reproduction** (probe P2):

  ```python
  class Reentrant(int):
      def __gt__(self, other):
          w.balance()              # re-acquires the same non-reentrant Lock
          return int(self) > other

  w.deposit(Reentrant(5))          # never returns
  ```

- **Expected:** some explicit `Result`, or a raised exception.
- **Observed:** `DEADLOCK: deposit() hung for >2s holding a non-reentrant Lock`.
  The wallet is then unusable process-wide: every subsequent `balance()`,
  `deposit()`, and `withdraw()` on that instance blocks forever.
- **Minimal counterexample:** as above.
- **Mechanism:** `threading.Lock` (wallet.py:35) is non-reentrant, and
  `_valid_amount` is invoked *inside* the critical section (wallet.py:43), so any
  caller-controlled code reached during validation can re-enter and self-deadlock.
  Validating before acquiring the lock, or using `RLock`, removes this.
- **Classification:** **implementation defect** (liveness, low severity — shares
  F1's exotic precondition).

## F3 — An operation can apply while the caller is told it did not complete

- **Behavioral claim challenged:** C4, "rejected operations do not change state,"
  read together with the handoff README's promise that "every mutation returns a
  `Result`." The failure is that a third outcome exists: *applied, but not
  reported*.
- **Reproduction** (`adversary/tests/probe_interrupt.py`, probe P10). An async
  exception is injected via `sys.settrace` — the implementation is **not**
  modified — at the line between the mutation and the `Result` construction:

  ```
  self._balance += amount                          # wallet.py:48  state advances
  return Result(Outcome.ACCEPTED, self._balance)   # wallet.py:49  caller learns here
  ```

- **Expected:** the operation is atomic from the caller's perspective — either it
  applies and a `Result` is returned, or it does not apply.
- **Observed:**

  ```
  balance before: 1000
  caller observed: KeyboardInterrupt
  balance after:  1500
  ```

  The deposit applied; the caller received an exception and would reasonably
  retry, double-depositing.
- **Minimal counterexample:** any async exception delivered in that one-bytecode
  window — `KeyboardInterrupt` (Ctrl-C), a `signal.alarm`-based timeout, or a
  gevent/eventlet timer.
- **Classification:** **implementation defect** in its consequence, but at root a
  **specification gap** — I lean toward gap. The README's "rejected operations do
  not change state" does not define what a caller may assume when *no* outcome is
  reported at all, and the handoff README's "every mutation returns a `Result`"
  is contradicted only under async interruption. Note the wallet itself is **not
  corrupted**: the `with` statement releases the lock cleanly and the balance
  remains consistent and non-negative. The damage is confined to caller-side
  ambiguity, which is exactly the kind of thing an idempotency answer would
  resolve — and idempotency is unspecified (see F8).
- **Threat to this finding:** `sys.settrace` injection proves the window exists
  at bytecode granularity but is a stronger interruption primitive than a real
  signal. I did not reproduce this with an actual `SIGINT`, which would need to
  land in a window of a few bytecodes; I regard the window as real by inspection
  and the trace result as a demonstration rather than a natural repro.

---

# Part B — Specification gaps (silent resolutions)

The README names seven questions as "deliberately unresolved": currency, numeric
representation, authorization, idempotency, concurrency, persistence, and error
semantics. Here is what the artifact did with each. "Declared" means stated in
the handoff — `implementation/README.md` or a module/class docstring, the only
builder-authored prose I am permitted to read.

| # | Open question | Resolution in the artifact | Declared? |
|---|---|---|---|
| F4 | **Currency** | none — no currency, no scale, no denomination | ✗ silent |
| F5 | **Numeric representation** | `int` "indivisible units", floats/`Decimal`/`Fraction`/strings all rejected | ~ partial (class docstring only) |
| F6 | **Authorization** | none — no owner, no identity, no caller check | ✗ silent |
| F7 | **Persistence** | none — purely in-memory, lost on exit | ✗ silent |
| F8 | **Idempotency** | none — repeated operations accumulate; no key, no dedup | ✗ silent |
| F9 | **Concurrency** | one `Lock` per wallet; per-operation atomicity | ~ partial (module docstring "thread-safe") |
| — | **Error semantics** | `Result` + `Outcome` enum, no exceptions | ✓ **declared** — the one done well |

### F4/F6/F7 — currency, authorization, persistence resolved to "absent", silently

- **Claim challenged:** none directly — this is a specification-preservation
  finding, not a conformance one.
- **Observed** (probe P9): the entire public surface is
  `['balance', 'deposit', 'withdraw']`; the constructor is `Wallet()` with no
  owner, no currency, no identifier, and no initial balance. Nothing in the
  handoff prose mentions currency, authorization, or persistence at all.
- **Classification:** **specification gap.** Choosing "absent" is a perfectly
  defensible minimal answer and I am not calling it wrong. The finding is that
  the choice is **invisible**: a reader of the handoff cannot tell whether these
  were considered and deliberately excluded, or never considered. `RUN.md` asks
  specifically whether agents "expose and preserve ambiguity"; three of the seven
  named questions were closed without a trace in the delivered artifact.
- **Countervailing evidence, stated fairly:** the artifact is admirably free of
  *invented* product features — no accounts, users, fees, transaction history, or
  audit log. On the "did it silently invent a complete wallet product" axis, this
  builder scores well. The gap is under-declaration, not over-building.

### F5 — Numeric representation resolved to integers; fractional amounts rejected

- **Claim challenged:** C7, "arithmetic cannot silently lose precision."
- **Observed:** `deposit(0.1)`, `deposit(0.005)`, `deposit(2.5)`,
  `deposit(Decimal("10"))`, `deposit(Fraction(1,1))`, `deposit("10")` are all
  rejected with `INVALID_AMOUNT`; state unchanged. `deposit(2**53 + 1)` stores
  `9007199254740993` **exactly** — no float ever touches the value.
- **Assessment:** C7 is satisfied by construction, and rejecting rather than
  rounding is the strictly correct choice. **No defect here** — this is the
  strongest part of the implementation.
- **The gap:** the class docstring says "indivisible integer units", but the
  handoff `README.md` — the document a consumer reads — never states that
  fractional amounts are impossible, nor what one unit *means*. A caller
  reasonably passing `19.99` for $19.99 gets `INVALID_AMOUNT` with no guidance
  that they should have passed `1999`. `INVALID_AMOUNT` is also the same outcome
  returned for `None` and `"abc"`, so the caller cannot distinguish "wrong scale"
  from "wrong type." **Classification: specification gap**, plus a documentation
  gap in the handoff.

### F8 — Idempotency resolved to "none", silently, against a C5 requirement

- **Claim challenged:** C5 — "**repeated** … operations have explicit outcomes."
- **Observed** (probe P5): two identical `deposit(100)` calls both return
  `accepted`; the balance is `200`. There is no idempotency key, no request ID,
  and no dedup window.
- **Expected:** apply-twice is the natural and probably correct semantics — but
  C5 does not merely require *an* outcome for repeated operations, it requires an
  **explicit** one. Nothing in the handoff states this.
- **Why it matters here specifically:** F3 shows a caller can be left genuinely
  uncertain whether an operation applied. Without a documented idempotency
  answer, that caller has no safe retry strategy. F3 and F8 compound.
- **Classification:** **specification gap.** The README declares idempotency
  unresolved; C5 simultaneously demands an explicit outcome for repeated
  operations. That internal tension in the specification is itself a finding the
  coordinator should record — the builder cannot satisfy both by staying silent,
  and this is arguably a defect in the *specification*, not the implementation.

### F9 — Concurrency: the claim holds, but is declared only in a docstring

- **Claim challenged:** C1 and C5 under concurrent operations.
- **Testing performed:**
  - 64 threads on a `threading.Barrier` racing `withdraw(1)` against a balance of
    32, repeated 40 times: **0 negative balances, 0 accounting mismatches** — the
    canonical check-then-act TOCTOU is correctly closed by holding the lock
    across both the check and the write.
  - 32 threads × 400 `deposit(1)`: exact total, **no lost updates**.
  - 24 threads × 500 mixed random ops × 20 rounds (~240,000 operations):
    **0 conservation violations**, balance always `initial + Σ deltas`.
- **Observed:** the "thread-safe" claim in the module docstring is **upheld** by
  every test I ran. `Result` is a frozen dataclass, so returned values cannot be
  mutated to corrupt state; wallets share no global state (50-instance isolation
  check passed).
- **Classification:** **no defect found.** Two residual notes: (a) the handoff
  `README.md` does not mention thread-safety, so a consumer would not know it is
  guaranteed; (b) **only per-operation atomicity is provided** — there is no
  transaction, compare-and-swap, or transfer primitive, so a caller doing
  read-then-withdraw still races. That composite gap is undocumented.

---

# Part C — Minor observations (not defects)

- **F10 — `_balance` is directly writable.** `w._balance = -999` yields a
  negative balance (probe P4). This is ordinary Python convention, not a defect;
  I note it only because it means C1 is enforced by discipline, not by the type.
- **F11 — `MAX_BALANCE = 2**63 - 1` is an invented, undocumented cap.** Python
  integers are unbounded, so no overflow is technically possible and C6 would be
  satisfied trivially; the builder nonetheless added an explicit ceiling with a
  dedicated `OVERFLOW` outcome. This is a *good* call for interoperability with
  64-bit consumers and it does behave correctly — overflow-by-accumulation is
  caught, the boundary deposit to exactly `MAX_BALANCE` succeeds, and rejected
  overflows leave state untouched. But the cap's existence and value appear
  nowhere in the handoff prose, and `MAX_BALANCE` is a rebindable module global
  affecting every wallet in the process (probe P3).
- **F12 — zero and type errors share one outcome.** C5 lists "invalid" and "zero"
  as distinct input classes; both return `INVALID_AMOUNT`. Explicit, but not
  discriminating. **Inconclusive** — defensible either way.
- **F13 — huge integers are cheap.** `deposit(10**1_000_000)` returns `OVERFLOW`
  in 0.03 ms; no resource-exhaustion path found via the amount argument.
- **F14 — toolchain claim verified.** The handoff README says "Python 3.9 or
  newer"; all 33 conformance tests pass on both **3.14.5** and **3.9.6**. No
  toolchain issues found.
- **No stated/observable mismatch found.** Every behavioral claim the handoff
  makes in prose — "rejected operations return the unchanged balance", "every
  mutation returns a `Result`", "thread-safe", "Python 3.9+" — was tested and
  held (the sole exception being F3's async-interrupt window).

---

# Summary table

| ID | Claim | Classification | Severity |
|----|-------|----------------|----------|
| F1 | C1/C2/C3 — negative balance via hostile `int` subclass | implementation defect | low (exotic precondition) |
| F2 | C5 — permanent deadlock via re-entrant validation | implementation defect | low (exotic precondition) |
| F3 | C4 — applied-but-unreported operation under async exception | spec gap → implementation defect | medium, narrow window |
| F4 | Currency resolved to "absent" | specification gap | — |
| F5 | Numeric representation: integers only, declared in docstring only | specification gap | — |
| F6 | Authorization resolved to "absent" | specification gap | — |
| F7 | Persistence resolved to "absent" | specification gap | — |
| F8 | Idempotency resolved to "none"; C5 demanded explicit | specification gap | — |
| F9 | Concurrency — claim tested and upheld | no defect found | — |
| C1–C7 | all seven bullets, ordinary inputs | **no defect found** | — |

## Proposed specification revisions

1. Resolve the **C5-vs-"deliberately unresolved" tension**: C5 demands explicit
   outcomes for repeated and concurrent operations while the prose lists
   idempotency and concurrency as open. Pick one; today a builder can satisfy the
   letter of both only by accident.
2. State the **trust model for the `amount` argument** (trusted caller vs.
   hostile input). F1 is either a non-issue or an overdraft depending entirely on
   this, and the specification is silent.
3. Define **atomicity from the caller's perspective** — what may a caller assume
   when an operation neither returns nor rejects? This is the gap F3 sits in.
4. Require that any resolution of a declared-open question be **stated in the
   delivered artifact's own documentation**, not only in code. Five of seven were
   resolved invisibly here.
5. Say whether distinct rejection *reasons* must be distinguishable (F12), or
   whether one "invalid" outcome suffices.

## Remaining untested risks and limits of this evaluation

- **Finding no defect is evidence from this run, not proof of correctness.** The
  randomised suite explored 2,000 sequences of ≤12 operations from a 16-value
  pool plus a 50,000-operation drift run — a sample of the input space, not a
  proof.
- **Concurrency was tested only with the GIL enabled** (`sys._is_gil_enabled()`
  returned `True` on 3.14.5). I did not have a free-threaded build available. The
  `Lock` should hold there too, but that is reasoning, not evidence. Race results
  are also inherently schedule-dependent on this one machine; ~240,000 contended
  operations with zero violations is strong but not exhaustive.
- **F3 was demonstrated via `sys.settrace`, not a real signal.** The window is
  real by inspection; the natural-repro probability is untested.
- **No persistence, no I/O, no serialization boundary exists**, so I could not
  test crash-consistency, reload, or JSON round-tripping — the classic place
  where a `2**53` precision bug would appear. If a caller ever serializes a
  balance through JSON in JavaScript, `MAX_BALANCE` is unrepresentable; that risk
  lives outside the artifact and outside my reach.
- **I could not test multi-process or async/await interleaving**, since the
  artifact exposes no async surface.
- **My reading of the seven bullets is an interpretation.** F8 and F12 in
  particular depend on reading C5's "explicit outcomes" as requiring
  *documentation*, not merely *determinism*. A reader who rejects that reading
  should downgrade both; the underlying observations stand either way.
- **Correlated-blind-spot risk:** if the builder was also a Claude model, we
  likely share assumptions about what "obviously" needs testing, and the absence
  of findings in some area may reflect a shared prior rather than an absence of
  defects. The coordinator should record this as a threat to independence
  regardless of the outcome.
- **Not yet done:** builder rationale and builder tests have not been read. A
  coverage comparison against them is still outstanding and may reveal areas
  neither of us probed.
