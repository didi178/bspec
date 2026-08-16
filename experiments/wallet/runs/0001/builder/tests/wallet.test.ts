/**
 * Builder tests for the wallet (run 0001).
 *
 * These exercise the behavior the builder implemented. They are NOT a proof of
 * correctness (per the builder prompt); they document the intended behavior and
 * the edge outcomes the builder committed to. Run with: `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "../implementation/wallet.ts";

test("new wallet starts at zero by default", () => {
  const w = new Wallet();
  assert.equal(w.balance(), 0n);
});

test("deposit increases balance by exactly the amount", () => {
  const w = new Wallet();
  const r = w.deposit(100n);
  assert.deepEqual(r, { ok: true, balance: 100n });
  assert.equal(w.balance(), 100n);
});

test("withdraw decreases balance by exactly the amount", () => {
  const w = new Wallet({ initialBalance: 100n });
  const r = w.withdraw(40n);
  assert.deepEqual(r, { ok: true, balance: 60n });
  assert.equal(w.balance(), 60n);
});

test("balance never becomes negative; overdraw is rejected and state unchanged", () => {
  const w = new Wallet({ initialBalance: 50n });
  const r = w.withdraw(51n);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.error, "INSUFFICIENT_FUNDS");
  assert.equal(w.balance(), 50n);
});

test("withdrawing the exact balance is allowed and lands on zero", () => {
  const w = new Wallet({ initialBalance: 50n });
  const r = w.withdraw(50n);
  assert.deepEqual(r, { ok: true, balance: 0n });
  assert.equal(w.balance(), 0n);
});

test("zero amount is rejected as NON_POSITIVE_AMOUNT (deposit and withdraw)", () => {
  const w = new Wallet({ initialBalance: 10n });
  assert.equal((w.deposit(0n) as { error: string }).error, "NON_POSITIVE_AMOUNT");
  assert.equal((w.withdraw(0n) as { error: string }).error, "NON_POSITIVE_AMOUNT");
  assert.equal(w.balance(), 10n);
});

test("negative amount is rejected as NON_POSITIVE_AMOUNT", () => {
  const w = new Wallet({ initialBalance: 10n });
  assert.equal((w.deposit(-5n) as { error: string }).error, "NON_POSITIVE_AMOUNT");
  assert.equal((w.withdraw(-5n) as { error: string }).error, "NON_POSITIVE_AMOUNT");
  assert.equal(w.balance(), 10n);
});

test("invalid numeric amounts are rejected as INVALID_AMOUNT without mutation", () => {
  const w = new Wallet();
  for (const bad of [NaN, Infinity, -Infinity, 1.5, 2 ** 53]) {
    const r = w.deposit(bad as number);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.error, "INVALID_AMOUNT");
  }
  assert.equal(w.balance(), 0n);
});

test("non-numeric amounts are rejected as INVALID_AMOUNT", () => {
  const w = new Wallet();
  for (const bad of ["10", null, undefined, {}, []]) {
    const r = w.deposit(bad as unknown as bigint);
    assert.equal(r.ok === false && r.error, "INVALID_AMOUNT");
  }
  assert.equal(w.balance(), 0n);
});

test("safe-integer number amounts are accepted and exact", () => {
  const w = new Wallet();
  const r = w.deposit(1234);
  assert.deepEqual(r, { ok: true, balance: 1234n });
});

test("extremely large deposit that would exceed maxBalance is rejected", () => {
  const w = new Wallet({ maxBalance: 100n, initialBalance: 90n });
  const r = w.deposit(11n);
  assert.equal(r.ok === false && r.error, "BALANCE_LIMIT_EXCEEDED");
  assert.equal(w.balance(), 90n);
  // Depositing exactly to the limit is allowed.
  assert.deepEqual(w.deposit(10n), { ok: true, balance: 100n });
});

test("no silent overflow: huge bigint near the default ceiling is bounded", () => {
  const w = new Wallet();
  const huge = 1n << 200n; // vastly larger than the default max
  const r = w.deposit(huge);
  assert.equal(r.ok === false && r.error, "BALANCE_LIMIT_EXCEEDED");
  assert.equal(w.balance(), 0n);
});

test("repeated deposits each apply independently (no idempotency)", () => {
  const w = new Wallet();
  w.deposit(10n);
  w.deposit(10n);
  w.deposit(10n);
  assert.equal(w.balance(), 30n);
});

test("rejected operation returns the current (unchanged) balance", () => {
  const w = new Wallet({ initialBalance: 5n });
  const r = w.withdraw(9n);
  assert.equal(r.balance, 5n);
});

test("sequential interleaving of mixed operations keeps the invariant", () => {
  const w = new Wallet();
  const ops: Array<[("d" | "w"), bigint]> = [
    ["d", 100n], ["w", 30n], ["w", 80n], ["d", 5n], ["w", 75n],
  ];
  for (const [kind, amt] of ops) {
    kind === "d" ? w.deposit(amt) : w.withdraw(amt);
    assert.ok(w.balance() >= 0n, "balance must never be negative");
  }
  assert.equal(w.balance(), 0n); // 100 -30 (-80 rejected) +5 -75
});
