# Wallet Implementation — Build & Run (run 0001, builder)

## What this is

A minimal in-memory wallet in TypeScript. Public surface is one class:

```ts
import { Wallet } from "./wallet.ts";

const w = new Wallet();          // balance 0, default max = 2^63 - 1
w.deposit(100n);                 // { ok: true, balance: 100n }
w.withdraw(40n);                 // { ok: true, balance: 60n }
w.withdraw(1000n);               // { ok: false, error: "INSUFFICIENT_FUNDS", balance: 60n }
w.balance();                     // 60n
```

Amounts are integer **minor units** (e.g. cents) passed as `bigint` (preferred)
or as a safe-integer `number`. Balances are `bigint`, so arithmetic is exact.

## Toolchain

- **Node.js >= 23** (developed and tested on v25.5.0). Node runs the `.ts`
  files directly via native type stripping — there is no build/transpile step
  and there are **no third-party dependencies**.

## Run the tests

From this `implementation/` directory:

```bash
npm test
```

or directly, from the `builder/` directory:

```bash
node --test "tests/*.test.ts"
```

## Files

- `wallet.ts` — the implementation.
- `package.json` — metadata + `test` script (no dependencies).
- `../tests/wallet.test.ts` — builder tests (not a correctness proof).

## Error outcomes (explicit)

| Code                     | Cause                                                   |
| ------------------------ | ------------------------------------------------------- |
| `INVALID_AMOUNT`         | wrong type, non-finite, or a `number` that is not a safe integer |
| `NON_POSITIVE_AMOUNT`    | amount is zero or negative                              |
| `INSUFFICIENT_FUNDS`     | withdrawal would make the balance negative              |
| `BALANCE_LIMIT_EXCEEDED` | deposit would push the balance above `maxBalance`       |

Deposits/withdrawals never throw for these; they return a tagged result and
leave state unchanged on rejection. The constructor **does** throw `RangeError`
for structurally invalid configuration (negative/oversized initial balance).
