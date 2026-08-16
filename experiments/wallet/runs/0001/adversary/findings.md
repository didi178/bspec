# Adversary Findings — Run 0001 (Wallet)

**Role:** adversary · **Run ID:** 0001 · **Date:** 2026-08-16
**Strategy authored before inspecting the implementation:** yes — `strategy.md`, saved first.
**Builder material read:** `implementation/wallet.ts`, `implementation/README.md`, `implementation/package.json` only.
**Builder material NOT read at the time of writing:** `assumptions.md`, `evidence.md`, `tests/wallet.test.ts`, `tests/construction-notes.md`, `tests/test-output.txt`. These remain unopened pending explicit reveal.

**Artifact under test:** `wallet.ts`, sha256 `3e063eb15ee43e2fa4be35ecb1a2b131868619bb5758959bbeca2c9e4e0ac431`
**Toolchain:** Node.js v25.5.0 (native TypeScript type stripping, no build step, no dependencies).
**Adversary tests:** 80 assertions across 4 files in `adversary/tests/`. Full output in `adversary/evidence/test-output.txt`; ambiguity probe output in `adversary/evidence/probe-output.txt`.

**Reproduce:**
```bash
cd runs/0001/adversary
node --test "tests/*.test.ts"     # 80 tests
node tests/probe-ambiguity.ts     # ambiguity + misuse probe
```

---

## Headline

I could not falsify any of the six specification bullets. S1–S4 and S6 survived every attack I brought, including a 60,000-operation seeded model-based fuzz that compared the wallet against exact bigint arithmetic after every single operation. The `bigint` minor-unit representation makes the precision bullet structurally rather than accidentally true, and the reject-before-mutate ordering makes the no-state-change bullet hold by construction.

The defects I did find are all in the **configuration boundary**, not the ledger arithmetic — the constructor's options object is read without validation, without an own-property check, and without a defined contract for a malformed argument. None of them can drive the balance negative.

The larger result is against the **specification**, not the implementation. Of the seven questions `README.md` deliberately leaves open, the artifact resolves all seven, and declares only three. That is the outcome `RUN.md` § "Current scope" asks this run to measure.

Per the role prompt: **finding no defect in S1–S4/S6 is evidence from this run, not proof of correctness.**

---

## Summary table

| ID | Claim challenged | Classification | Severity |
|----|------------------|----------------|----------|
| A-1 | S1 / configuration integrity | Implementation defect | Medium |
| A-2 | S5 "concurrent operations have explicit outcomes" | Specification gap | Medium |
| A-3 | S5 concurrency scope | Specification gap | Low |
| A-4 | S5 "explicit outcomes" / persistence | Specification gap | Medium |
| A-5 | Stated vs. observable constructor contract | Implementation defect | Low |
| A-6 | Configuration validation | Implementation defect | Low |
| A-7 | S5 "repeated operations" / idempotency | Specification gap | Medium |
| A-8 | Currency, authorization, ceiling | Specification gap | High (spec) |
| A-9 | S1, S2, S3, S4, S6 | **No defect found** | — |

---

## A-1 — Constructor options are read through the prototype chain, minting balance

**Classification:** implementation defect. **Severity:** medium.
**Claim challenged:** S1 (balance never negative) at its provenance boundary, and configuration integrity generally.

**Reproduction**
```js
import { Wallet } from "./builder/implementation/wallet.ts";
Object.prototype.initialBalance = 1000n;
new Wallet().balance();   // no arguments at all
```

**Expected:** a wallet constructed with no arguments starts at the documented default of `0n`.
**Observed:** `1000n`. Balance is created from nothing.

**Minimal counterexample:** the three lines above.

**Mechanism.** `wallet.ts:68-69` reads the options with a plain property get:
```ts
const max = options.maxBalance ?? DEFAULT_MAX_BALANCE;
const initial = options.initialBalance ?? 0n;
```
A plain get walks the prototype chain, so an inherited property is indistinguishable from a supplied one. There is no `Object.hasOwn` check and no null-prototype normalisation.

**Variant A-1b.** `Object.prototype.maxBalance = 0n` makes every default-constructed wallet reject all deposits with `BALANCE_LIMIT_EXCEEDED` — a silent denial of service on the deposit path.
```
new Wallet().deposit(1n) -> {ok: false, error: "BALANCE_LIMIT_EXCEEDED", balance: 0n}
```

**Variant A-1c — the invariant still holds.** Injecting `initialBalance = -1n` throws `RangeError` rather than producing a negative wallet. **S1 is not defeated by this defect.** The type and sign guards run on the value after it is read, so they catch a poisoned value; what they cannot catch is a poisoned value that is *valid but unauthorised*.

**Caveat, stated honestly.** This requires prototype pollution, which is itself a prior compromise. I am not claiming it is remotely exploitable on its own. I report it because it is reproducible, because the fix is one word per line (`Object.hasOwn`), and because "a wallet constructed with no arguments does not have a zero balance" is exactly the class of surprise a ledger should not contain.

**Evidence:** `tests/spec-bullets.test.ts` A-1/A-1b/A-1c; `evidence/probe-output.txt` § "Prototype-chain option lookup".

---

## A-2 — "Concurrent operations have explicit outcomes" is unaddressed

**Classification:** specification gap. **Severity:** medium.
**Claim challenged:** S5, concurrency clause.

Individual operations *are* atomic, and I verified this rather than assuming it: 200 concurrent async agents performing 200 operations each, yielding to the event loop between every operation, produced no lost update and no negative balance. Because `deposit`/`withdraw` are synchronous with no `await` inside them, the event loop cannot interleave a partial update. This is a genuine structural property.

**But the artifact never says so**, and the property does not extend to compound operations. The ordinary consumer pattern is racy:

```js
const w = new Wallet({ initialBalance: 100n });
const spendIfAffordable = async () => {
  if (w.balance() >= 100n) {      // both callers observe an affordable balance
    await Promise.resolve();       // any real async work: I/O, DB, fetch
    return w.withdraw(100n);       // only one of them can actually spend
  }
};
await Promise.all([spendIfAffordable(), spendIfAffordable()]);
// -> one "spent", one "failed:INSUFFICIENT_FUNDS"
```

**Expected:** the specification tells us what a concurrent withdrawal *should* do.
**Observed:** the specification does not say, and the artifact does not either.

The wallet's own behavior here is defensible — it rejects, S1 holds, no money is lost. I classify this as a specification gap and not a defect, because there is no stated claim to violate. But S5 explicitly names concurrency as needing an explicit outcome, and no atomic compound operation, lock, transaction, or documented atomicity guarantee exists.

**Limit of this evidence (from `strategy.md` §3):** a passing concurrency test proves very little. Schedules are not exhaustively explored, and single-isolate async concurrency is the weakest possible form of the test.

**Evidence:** `tests/concurrency.test.ts`.

---

## A-3 — A Wallet cannot cross a thread boundary, and this is undeclared

**Classification:** specification gap. **Severity:** low.

`structuredClone(wallet)` yields a bare `{}` — the class, its methods, and its private fields are all dropped. A `Wallet` therefore cannot be shared with a `worker_threads` worker, so "concurrent" can only ever mean single-isolate async concurrency for this artifact. Nothing states that limit.

**Evidence:** `tests/concurrency.test.ts` A-3; `evidence/probe-output.txt`.

---

## A-4 — The "explicit outcome" object cannot be serialized

**Classification:** specification gap with an implementation consequence. **Severity:** medium.

**Reproduction**
```js
JSON.stringify(new Wallet().deposit(100n));
// TypeError: Do not know how to serialize a BigInt
```

The tagged result object is the mechanism by which S5's "explicit outcomes" are made observable — and it throws on the most common way to transport, log, or persist an outcome. `JSON.stringify({ balance: w.balance() })` throws for the same reason.

Persistence is listed as deliberately unresolved, so this is a gap rather than a defect. It is a concrete, reproducible consequence of an undeclared representation choice: the artifact chose `bigint` and did not surface the interoperability cost.

**Related sharp edge (A-4b).** `w.balance() === 100` is always `false` while `w.balance() == 100` is `true`, and `w.balance() * 1.5` throws `TypeError: Cannot mix BigInt and other types`. Any consumer that forgets the representation gets a silent wrong answer from `===` and a crash from arithmetic.

**Evidence:** `tests/concurrency.test.ts` A-4/A-4b; `evidence/probe-output.txt` § "Misuse / robustness probes".

---

## A-5 — `new Wallet(null)` throws `TypeError`, not the documented `RangeError`

**Classification:** implementation defect (stated vs. observable behavior). **Severity:** low.

The implementation README states: *"The constructor **does** throw `RangeError` for structurally invalid configuration."*

**Reproduction:** `new Wallet(null)`
**Expected:** `RangeError` per the documented contract, or a documented alternative.
**Observed:** `TypeError: Cannot read properties of null (reading 'maxBalance')`

The guard at `wallet.ts:70-78` is never reached, because the property read at line 68 throws first. The message also leaks an internal option name from a failed read. `null` is structurally invalid configuration by any reading, so the documented contract does not cover the observed behavior.

**Evidence:** `tests/constructor-contract.test.ts` A-5.

---

## A-6 — Malformed configuration is silently accepted

**Classification:** implementation defect. **Severity:** low.

Every non-null primitive is accepted as an options object. Property reads on a primitive yield `undefined`, both defaults apply, and construction succeeds silently:

```js
new Wallet("nope").balance();              // 0n   — no error
new Wallet(5).balance();                   // 0n   — no error
new Wallet(true).balance();                // 0n   — no error
new Wallet({ intialBalance: 500n });       // 0n   — typo silently dropped
```

**Variant A-6b.** A misspelled key is silently ignored, producing a default wallet. In a ledger, `new Wallet({ intialBalance: 500n })` silently giving you an empty wallet is a live hazard — TypeScript catches it at compile time, but the artifact runs under Node type stripping, where **no type checking occurs at all**. The runtime guards the builder wrote are the only defense, and they do not cover this.

**The finding is the inconsistency.** Three malformed arguments produce three different behaviors:

| Argument | Outcome |
|---|---|
| `null` | throws `TypeError` (A-5) |
| `"nope"` | silently succeeds, balance `0n` |
| `undefined` | succeeds, balance `0n` (correct — it is the documented default) |

**Evidence:** `tests/constructor-contract.test.ts` A-6/A-6b; `evidence/probe-output.txt`.

---

## A-7 — "Repeated operations" resolved to compounding, undeclared

**Classification:** specification gap. **Severity:** medium.

S5 requires repeated operations to have an explicit outcome. The observed semantics: repeats compound (`deposit(100n)` five times yields `500n`). There is no request identifier, transaction id, nonce, or dedup surface anywhere in the public API — I verified this by enumerating `Wallet.prototype` and instance properties.

Compounding is a perfectly reasonable choice. But "repeated" in S5 most plausibly means *retried*, and a retried deposit that double-credits is the canonical wallet bug. The specification does not distinguish the two readings, and the artifact does not state which one it implements. Neither party is wrong; the specification failed to decide.

**Evidence:** `tests/spec-bullets.test.ts` § S5.

---

## A-8 — Seven unresolved questions, seven resolutions, three declarations

**Classification:** specification gap. **Severity:** high (against the specification).

`README.md` names currency, numeric representation, authorization, idempotency, concurrency, persistence, and error semantics as deliberately unresolved. Every one is resolved by the artifact. Declared/undeclared is judged against the **implementation directory alone** (`wallet.ts` + its README), since `assumptions.md` and `evidence.md` remain unread by protocol.

| Question | Resolution observed | Declared in the implementation? |
|---|---|---|
| Numeric representation | `bigint` integer minor units | **Yes** — prominently, with rationale |
| Error semantics | tagged results for domain errors; `RangeError` for config | **Yes** — with a code table |
| Balance ceiling | `2^63 - 1`, invented, not requested by the spec | **Yes** — with rationale |
| Currency | absent entirely; no field, code, or unit | No |
| Authorization | absent entirely; any holder of the object may withdraw | No |
| Idempotency | absent; repeats compound | No |
| Persistence | absent; in-memory only | No |
| Concurrency | atomic per-operation by construction | No |
| History / audit trail | absent | No |
| Transfer between wallets | absent | No |

Three of the seven are declared well — the numeric-representation rationale is genuinely good, and inventing an explicit ceiling so that "extremely large" has a concrete boundary is a defensible reading of S6. The remaining four are resolved by omission, which is the hardest kind of resolution to notice: nothing in the artifact tells a reader that authorization was considered and dropped rather than forgotten.

**Note on scope discipline (to the builder's credit).** The artifact did *not* invent a complete wallet product. There is no user model, no accounts table, no interest calculation, no transfer API, no persistence layer. `RUN.md` § "Current scope" asks whether agents silently invent a full product; this one did not. The single invented feature is the `maxBalance` ceiling, and it is declared with a rationale. That is a materially better outcome than the failure mode the run was designed to detect, and my prediction P1 (three or more questions resolved *without flagging*) was **too pessimistic on declaration quality** — though correct that four questions are resolved by silence.

---

## A-9 — No defect found: S1, S2, S3, S4, S6

**Classification:** no defect found. This is evidence from this run, not proof of correctness.

Everything below survived. I list what was actually tried, so the strength of the negative result can be judged.

**S1 — balance never negative.** Withdraw from empty; withdraw exactly the balance; withdraw balance+1; a sequence whose crossing withdrawal is correctly the one rejected; negative deposit as a disguised withdrawal; negative initial balance via constructor; negative initial balance as a `number` (type stripping means the TS annotation is not a runtime guard — the builder wrote a real runtime check); a re-reading options getter attempting TOCTOU; prototype-injected negative balance; a full boundary sweep of `withdraw(k)` for every `k` from `-2` to `B+2`; and the invariant asserted after all 60,000 fuzz operations. **Never negative.**

**S2/S3 — exact deltas.** Verified across magnitudes from `1n` to `2^62`, for both operations, with round-trips; 100,000 deposits of `7n` land on exactly `700,000n` with no drift; the model-based oracle compared the wallet to exact bigint arithmetic after every operation of every fuzz run. **Exact throughout.**

**S4 — rejections are inert.** 18 distinct rejection paths, each checked against a snapshot of *all* observable state (balance and maxBalance, the complete observable surface); rejections do not poison a following valid operation; the rejection result reports the current unchanged balance; 100 interleaved rejections leave the balance bit-identical. The ordering in `deposit`/`withdraw` is validate-then-mutate with an early return, so this holds by construction, not by luck. **Nothing moved.**

**S6 — no silent overflow or precision loss.** The word doing the work in S6 is *silently*, and the artifact is well built here. `bigint` is exact and unbounded, so the only bound is the explicitly enforced ceiling, which returns `BALANCE_LIMIT_EXCEEDED` rather than wrapping. `2^53 + 1` stays exact where a float-backed wallet would absorb it — I verified the trap itself fires under `Number`. A `number` amount that has *already* lost precision before arrival (`2^53 + 1`, `1e30`, `1e21`) is rejected as `INVALID_AMOUNT` rather than silently coerced, which is the right call. No fractional minor unit is ever rounded in. A custom `maxBalance` of `10^40` behaves exactly at its boundary. **No overflow, no precision loss, no silent anything.**

**Encapsulation.** `#balance` is a true private field: unreachable via `Object.keys`, `getOwnPropertyNames`, `getOwnPropertySymbols`, `JSON.stringify`, `Reflect.ownKeys`, or `structuredClone`. `maxBalance` is a getter and assignment to it throws. `balance()` returns a primitive, so there is no aliasing vector. Mutating the returned result object cannot corrupt the wallet. A subclass can override `balance()` to misreport, but real state still governs every operation.

**No coercion re-entrancy.** I consider this the strongest single design choice in the artifact. `toIntAmount` dispatches on `typeof` and never coerces, so a hostile `valueOf`/`Symbol.toPrimitive` is **never invoked** — I asserted the call counter stays at zero while the hostile object attempts to re-enter `withdraw` mid-operation. This closes a re-entrancy class that a `Number(amount)` or `+amount` implementation would have opened wide.

**No TOCTOU on construction.** Each option is read exactly once into a local and every subsequent check uses the local, so a getter that changes its answer between reads cannot defeat the guards. This is easy to get wrong and the builder got it right.

---

## Predictions from `strategy.md` §7, scored honestly

| # | Prediction | Outcome |
|---|---|---|
| P1 | ≥3 unresolved questions resolved without flagging | **Partly right.** Four resolved by silence, but three were declared well — better than predicted. |
| P2 | Concurrency least likely to be genuinely satisfied | **Right in substance.** No race exists, but the guarantee is undeclared and compound ops are not atomic (A-2). |
| P3 | Zero has an outcome, but an undocumented one | **Wrong.** `NON_POSITIVE_AMOUNT`, documented in the README code table. |
| P4 | If floats appear, S6 falls to a two-line counterexample | **Not applicable.** No floats in the value path; `bigint` made S6 structurally true. |
| P5 | S1 and S4 most likely to hold | **Right.** Both hold by construction. |
| P6 | The spec ends with more findings than the implementation | **Right.** Five specification gaps to three low/medium implementation defects, and the spec gaps are the more consequential. |

Recording P3 and P4 as wrong is the point of having written them down.

---

## Remaining untested risks and limits of this evaluation

1. **Concurrency is barely tested.** Single-isolate async only. No true parallelism, no worker threads, no adversarial scheduler. Absence of an observed race is not absence of a race.
2. **Fuzz depth.** 60,000 operations across six seeds is shallow for a value-handling component. A longer campaign or a shrinking property-based library (fast-check) would be a stronger instrument than my hand-rolled PRNG.
3. **No durability testing.** The artifact has no persistence, so there was nothing to interrupt. If persistence is ever added, every S6 conclusion here must be re-derived — serialization is where precision usually dies, and A-4 shows the current representation cannot round-trip through JSON at all.
4. **No type-checking pass.** The artifact runs under Node type stripping, so I tested runtime behavior only. I did not run `tsc`. A type error that TypeScript would catch is invisible to both the artifact's own execution and to my tests.
5. **Memory/DoS not characterised.** An astronomically large `bigint` amount is accepted for comparison. I did not characterise the cost, and bigint comparison short-circuits on size, so I doubt it matters — but I did not measure it.
6. **Builder tests unread.** Coverage comparison is impossible until they are revealed. My tests may be redundant with theirs, or may share a blind spot.
7. **One adversary, one strategy.** Everything below is a single pass with a single set of instincts.

## Threats to independence

**This is the most important caveat in the document.** Builder and adversary are both Claude models reading the same `README.md`. Correlated blind spots are likely and are not measurable from inside this run.

Two concrete signals. First, my strategy predicted "int minor units or Decimal" as the likely representation and the artifact chose exactly that — plausibly convergent good practice, plausibly a shared prior. Second, my strategy's §4 table of unresolved questions and the artifact's set of resolutions align closely enough that I may simply have looked where a similar model would have thought to hide things.

The findings I am most confident are *independent* are the ones my strategy did not anticipate: A-1 (prototype-chain lookup) and A-5/A-6 (constructor argument contract) emerged from probing, not from the plan. The findings I am least confident are independent are the S5/ambiguity gaps, which both roles were primed by the same README to think about.

**Recommended:** run the reverse pairing (Codex builder / Claude adversary) before treating "no defect found in S1–S4/S6" as meaningful. A same-family pairing cannot establish it.

---

## Proposed specification revisions

Ordered by how much ambiguity each removes.

1. **Define "concurrent operation."** Name the concurrency model (single-threaded event loop, OS threads, distributed) and state whether compound check-then-act sequences are required to be atomic. Without this, S5's concurrency clause is untestable.
2. **Define "repeated operation."** Distinguish *repeated* (two genuine operations, compound) from *retried* (one operation delivered twice, dedup). Require an explicit position on idempotency keys.
3. **Require a declaration block.** Oblige the builder to state, per unresolved question, either the resolution or an explicit "not addressed." This converts A-8's four silent omissions into visible decisions and costs almost nothing.
4. **Constrain the configuration boundary.** S1–S4 govern operations; nothing governs construction. Require that the initial balance and any limits be validated, that malformed configuration have a single defined outcome, and that only own properties be honoured.
5. **State the representation's external contract.** If a representation cannot round-trip through the project's serialization format (A-4), the specification should require that to be declared.
6. **Say whether an invented limit is permitted.** The `maxBalance` ceiling is a reasonable reading of S6, but the spec neither asks for nor forbids it. Two builders could differ legitimately.
7. **Name the error mechanism.** The artifact uses two (tagged results and thrown `RangeError`). Either is fine; the split should be a stated decision.
