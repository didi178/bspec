/**
 * Minimal wallet / ledger implementation for the BSpec wallet experiment (run 0001).
 *
 * Design choices are deliberately the *smallest* that satisfy the stated behavior
 * in ../../../../README.md. Every choice that resolves an ambiguity the spec left
 * open is documented in ../assumptions.md and mapped in ../evidence.md.
 *
 * Numeric representation: non-negative integer *minor units* stored as `bigint`.
 * This makes "arithmetic cannot silently overflow or lose precision" structurally
 * true: bigint is exact and unbounded, so precision is never lost, and the only
 * bound is the explicit `maxBalance` we enforce ourselves (never a silent wrap).
 */

/** Discriminated error codes for every rejected operation. */
export type WalletErrorCode =
  | "INVALID_AMOUNT" // wrong type, non-finite, or a number that is not a safe integer
  | "NON_POSITIVE_AMOUNT" // amount is zero or negative
  | "INSUFFICIENT_FUNDS" // withdrawal would drive the balance below zero
  | "BALANCE_LIMIT_EXCEEDED"; // deposit would drive the balance above maxBalance

/**
 * Result of a deposit or withdrawal. Operations never throw for *domain*
 * outcomes; they return an explicit tagged result so that "rejected operations
 * do not change state" is observable and testable. `balance` is always the
 * balance *after* the call (unchanged on rejection).
 */
export type WalletResult =
  | { ok: true; balance: bigint }
  | { ok: false; error: WalletErrorCode; balance: bigint };

/**
 * An amount may be supplied as a `bigint` (preferred, always exact) or as a
 * `number`. A `number` is only accepted when it is a *safe* integer, because
 * any other number may already have lost precision before it reached us; such
 * inputs are rejected as INVALID_AMOUNT rather than silently coerced.
 */
export type Amount = bigint | number;

export interface WalletOptions {
  /** Starting balance in minor units. Must be >= 0 and <= maxBalance. Default 0. */
  initialBalance?: bigint;
  /**
   * Inclusive upper bound on the balance in minor units. Deposits that would
   * exceed it are rejected. Default 2^63 - 1 (a conventional signed-64-bit
   * ceiling) purely to give "extremely large" a concrete, explicit boundary.
   */
  maxBalance?: bigint;
}

const DEFAULT_MAX_BALANCE = (1n << 63n) - 1n; // 9223372036854775807

/** Normalize an Amount to a bigint, or return null if it is not a valid integer amount. */
function toIntAmount(amount: Amount): bigint | null {
  if (typeof amount === "bigint") return amount;
  if (typeof amount === "number") {
    // Rejects NaN, Infinity, and any non-integer or precision-losing magnitude.
    if (!Number.isSafeInteger(amount)) return null;
    return BigInt(amount);
  }
  return null;
}

export class Wallet {
  #balance: bigint;
  readonly #maxBalance: bigint;

  constructor(options: WalletOptions = {}) {
    const max = options.maxBalance ?? DEFAULT_MAX_BALANCE;
    const initial = options.initialBalance ?? 0n;
    if (typeof max !== "bigint" || max < 0n) {
      throw new RangeError("maxBalance must be a non-negative bigint");
    }
    if (typeof initial !== "bigint" || initial < 0n) {
      throw new RangeError("initialBalance must be a non-negative bigint");
    }
    if (initial > max) {
      throw new RangeError("initialBalance must not exceed maxBalance");
    }
    this.#balance = initial;
    this.#maxBalance = max;
  }

  /** Current balance in minor units. Reads never mutate state. */
  balance(): bigint {
    return this.#balance;
  }

  /** Inclusive maximum balance this wallet permits. */
  get maxBalance(): bigint {
    return this.#maxBalance;
  }

  /**
   * Increase the balance by `amount`. Rejects (without mutating) invalid,
   * non-positive, or limit-exceeding amounts.
   */
  deposit(amount: Amount): WalletResult {
    const value = toIntAmount(amount);
    if (value === null) return this.#reject("INVALID_AMOUNT");
    if (value <= 0n) return this.#reject("NON_POSITIVE_AMOUNT");
    if (value > this.#maxBalance - this.#balance) {
      return this.#reject("BALANCE_LIMIT_EXCEEDED");
    }
    this.#balance += value;
    return { ok: true, balance: this.#balance };
  }

  /**
   * Decrease the balance by `amount`. Rejects (without mutating) invalid,
   * non-positive, or insufficient-funds amounts. The balance can never become
   * negative.
   */
  withdraw(amount: Amount): WalletResult {
    const value = toIntAmount(amount);
    if (value === null) return this.#reject("INVALID_AMOUNT");
    if (value <= 0n) return this.#reject("NON_POSITIVE_AMOUNT");
    if (value > this.#balance) return this.#reject("INSUFFICIENT_FUNDS");
    this.#balance -= value;
    return { ok: true, balance: this.#balance };
  }

  #reject(error: WalletErrorCode): WalletResult {
    // State is intentionally left untouched here.
    return { ok: false, error, balance: this.#balance };
  }
}
