# Evidence Map — run 0001, builder

Maps each behavioral claim in `../../../README.md` ("Candidate behavior") to the
implementation evidence in `implementation/wallet.ts` and the builder test that
exercises it in `tests/wallet.test.ts`.

> Per the builder prompt, these tests do **not** prove correctness; they show
> *where* each claim is realized. Independent evaluation is the adversary's job.
> Line numbers refer to `implementation/wallet.ts` as written in this run.

| # | Behavioral claim (spec) | Implementation evidence | Builder test |
|---|-------------------------|-------------------------|--------------|
| C1 | The balance never becomes negative. | `withdraw` rejects when `value > this.#balance` before mutating (`INSUFFICIENT_FUNDS`); balance only ever decreases by an amount `<=` itself. `initialBalance < 0` throws in the constructor. | "balance never becomes negative…", "withdrawing the exact balance…", "sequential interleaving…" |
| C2 | Successful deposits increase the balance by exactly the deposited amount. | `deposit`: `this.#balance += value;` with `value` the exact normalized bigint; returns `{ ok: true, balance }`. | "deposit increases balance by exactly the amount", "safe-integer number amounts are accepted and exact" |
| C3 | Successful withdrawals decrease it by exactly the withdrawn amount. | `withdraw`: `this.#balance -= value;` returns `{ ok: true, balance }`. | "withdraw decreases balance by exactly the amount" |
| C4 | Rejected operations do not change state. | Every rejection path returns via `#reject(...)`, which reads but never assigns `#balance`; the mutation statement is reached only after all guards pass. Returned `balance` equals the pre-op value. | "…rejected and state unchanged", "zero amount is rejected…", "negative amount…", "invalid numeric amounts…without mutation", "extremely large deposit…", "rejected operation returns the current (unchanged) balance" |
| C5a | Invalid operations have explicit outcomes. | `toIntAmount` returns `null` for wrong type / non-finite / non-safe-integer `number`; mapped to `INVALID_AMOUNT`. | "invalid numeric amounts…", "non-numeric amounts are rejected as INVALID_AMOUNT" |
| C5b | Zero operations have explicit outcomes. | `value <= 0n` → `NON_POSITIVE_AMOUNT` in both methods. | "zero amount is rejected as NON_POSITIVE_AMOUNT" |
| C5c | Negative operations have explicit outcomes. | Same `value <= 0n` guard. | "negative amount is rejected as NON_POSITIVE_AMOUNT" |
| C5d | Extremely large operations have explicit outcomes. | `deposit`: `value > this.#maxBalance - this.#balance` → `BALANCE_LIMIT_EXCEEDED`. Default ceiling `2^63 - 1`. | "extremely large deposit…", "no silent overflow: huge bigint…is bounded" |
| C5e | Repeated operations have explicit outcomes. | No dedup state exists; each call independently re-runs the guards and mutation (assumption A5). | "repeated deposits each apply independently (no idempotency)" |
| C5f | Concurrent operations have explicit outcomes. | Operations are synchronous and atomic; no `await`/shared async state (assumption A6). Explicit outcome = the sequential order the caller invokes. | "sequential interleaving of mixed operations keeps the invariant" *(models sequencing, not true parallelism — see A6)* |
| C6 | Arithmetic cannot silently overflow or lose precision. | All values are `bigint` (exact, unbounded); `number` inputs accepted only when `Number.isSafeInteger`, else `INVALID_AMOUNT`; explicit `maxBalance` ceiling instead of any silent wrap. | "safe-integer number amounts are accepted and exact", "invalid numeric amounts…", "no silent overflow: huge bigint…is bounded" |

## Coverage caveats (builder-acknowledged gaps)

- **C5f (concurrency)** is the weakest mapping. The implementation makes true
  concurrency *impossible to express* rather than *handled*; if the spec meant
  multi-process/shared-store access, this is unaddressed. See assumption A6.
- **C5d (extremely large)** encodes a *contested* choice: reject vs. accept
  (bigint could hold arbitrarily large values). See assumption A3.
- **C5b (zero)** encodes reject-vs-no-op, another contested choice. See A4.
- The unit/currency of a "1" is undefined (A1); every amount test is therefore
  in abstract minor units.

## Build / execution evidence

- Toolchain: Node.js v25.5.0, native TypeScript type stripping, **no third-party
  dependencies**. See `implementation/README.md`.
- Command: `node --test "tests/*.test.ts"` (or `npm test` from `implementation/`).
- Result at build time: **15 tests, 15 pass, 0 fail** (see `test-output.txt`).
