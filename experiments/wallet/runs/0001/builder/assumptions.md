# Assumptions & Unresolved Ambiguities — run 0001, builder

The specification (`../../../README.md`, "Candidate behavior") is explicitly
incomplete and names several questions as "deliberately unresolved." Per the
builder prompt I did **not** silently resolve them; each choice below is the
*smallest* one that makes the stated behavior implementable, and each is flagged
so the adversary and coordinator can attack or revise it.

Notation: **[SPEC-SILENT]** = the spec says nothing; I chose a minimal default.
**[SPEC-VAGUE]** = the spec gestures at behavior ("explicit outcomes") without
fixing it; I made it concrete.

## Numeric representation

- **A1 [SPEC-VAGUE].** Amounts and balances are **non-negative integer minor
  units** stored as `bigint`. Rationale: the spec demands "arithmetic cannot
  silently overflow or lose precision." `bigint` is exact and unbounded, so
  precision loss is impossible and there is no silent wraparound.
  - *Consequence / risk:* there are **no fractional minor units**. If the domain
    needed sub-cent amounts or a decimal currency with >2 places, this is wrong.
    The spec never fixes a currency or a scale, so the unit is undefined — a
    deposit of `100n` could mean $1.00 or ¥100. I preserved this ambiguity
    rather than inventing a currency.

- **A2 [SPEC-SILENT].** A `number` argument is accepted **only** if it is a safe
  integer (`Number.isSafeInteger`); otherwise it is `INVALID_AMOUNT`. Rationale:
  a non-safe-integer `number` may already have lost precision before reaching
  the wallet, so accepting it would violate the precision requirement. `bigint`
  is the precise path.
  - *Alternative not taken:* coercing/rounding floats. Rejected — that would be
    silent precision handling.

## "Extremely large" / overflow

- **A3 [SPEC-VAGUE].** There is an inclusive **`maxBalance`** ceiling; a deposit
  that would exceed it is rejected as `BALANCE_LIMIT_EXCEEDED` with no mutation.
  The default is `2^63 - 1`, chosen only to give "extremely large" a concrete
  boundary reminiscent of a signed-64-bit ledger column.
  - *Ambiguity preserved:* the spec does not say whether "extremely large"
    should be rejected, saturated, or accepted (bigint could just hold it). I
    chose **reject** and made the bound configurable. A reviewer may argue the
    correct behavior is "accept, since bigint never overflows" — that is a live
    disagreement, not a settled fact.
  - The overflow check is written as `value > maxBalance - balance` so the
    intermediate sum is never formed near a boundary (defensive, though bigint
    could not overflow anyway).

## Zero and negative amounts

- **A4 [SPEC-SILENT].** Zero and negative amounts are **rejected**
  (`NON_POSITIVE_AMOUNT`), for both deposit and withdraw, with no mutation.
  - *Ambiguity preserved:* a zero deposit could equally be defined as a
    successful no-op. I chose rejection so that "successful deposits increase the
    balance by exactly the amount" stays literally true (a zero deposit would
    increase by zero, arguably a degenerate success). This is a judgment call.

## Idempotency / repetition

- **A5 [SPEC-SILENT].** **No idempotency.** Operations carry no client id / no
  dedup key; repeated identical deposits each apply. The spec lists "repeated"
  operations as needing an explicit outcome — the explicit outcome I chose is
  "each repetition is an independent, fully-applied operation."
  - *Risk:* if the intended domain needed at-most-once semantics (e.g. retried
    network requests), this is wrong. Flagged for the adversary.

## Concurrency

- **A6 [SPEC-VAGUE].** The model is **single-threaded and synchronous**; each
  `deposit`/`withdraw` is a complete, atomic mutation with no `await` inside, so
  no interleaving is observable within the JS event loop. "Concurrent
  operations" therefore reduce to a **sequential order** the caller picks.
  - *Ambiguity preserved:* this sidesteps rather than solves real concurrency.
    There is no locking, no transaction, no async API. If the spec intended true
    parallel access (multiple processes, shared storage), this implementation
    does not address it and the adversary should treat that as an open gap.

## Persistence

- **A7 [SPEC-SILENT].** **In-memory only.** State lives in a `Wallet` instance
  and is lost when it is dropped. No file/db/durability. Smallest choice that
  satisfies the stated behavior, which never mentions persistence.

## Authorization / identity

- **A8 [SPEC-SILENT].** **None.** No accounts, owners, or auth. Any caller with a
  reference to the instance may operate on it. The spec never mentions authz.

## Error semantics

- **A9 [SPEC-VAGUE].** Domain rejections are returned as a **tagged result**
  `{ ok: false, error, balance }` rather than thrown. Rationale: makes "rejected
  operations do not change state" directly observable (the returned `balance`
  equals the pre-op balance). Only *structural misconfiguration* of the
  constructor throws (`RangeError`).
  - *Ambiguity preserved:* the spec says outcomes must be "explicit" but not
    whether via exceptions, error codes, or result types. Another builder could
    justifiably throw typed errors instead.

## Multi-currency, transfers, statements, fees

- **A10 [SPEC-SILENT].** Out of scope. The spec mentions only deposit, withdraw,
  and balance query. I deliberately did **not** add these customary features
  (builder prompt: "Do not add requirements merely because they are customary").
