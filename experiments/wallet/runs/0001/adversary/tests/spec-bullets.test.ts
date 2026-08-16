/**
 * Adversary tests — run 0001. Derived from strategy.md, which was written and
 * saved BEFORE any builder material was read.
 *
 * Each test names the specification bullet (S1..S6) it challenges. Tests are
 * grouped so that a failure identifies the violated claim directly.
 *
 * The builder implementation is imported read-only and is never modified.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "../../builder/implementation/wallet.ts";

const MAX = (1n << 63n) - 1n;

/** Every observable piece of state this artifact exposes. */
function snapshot(w: Wallet) {
  return { balance: w.balance(), maxBalance: w.maxBalance };
}

/** Assert no observable state moved across `fn`. Challenges S4. */
function assertNoStateChange(w: Wallet, fn: () => unknown, label: string) {
  const before = snapshot(w);
  fn();
  const after = snapshot(w);
  assert.deepEqual(after, before, `S4 violated: state changed on ${label}`);
}

// ---------------------------------------------------------------------------
// S1 — the balance never becomes negative
// ---------------------------------------------------------------------------
describe("S1 — balance never negative", () => {
  test("withdraw from empty wallet", () => {
    const w = new Wallet();
    const r = w.withdraw(1n);
    assert.equal(r.ok, false);
    assert.equal(w.balance(), 0n);
  });

  test("withdraw exactly the balance is allowed and lands on zero", () => {
    const w = new Wallet({ initialBalance: 100n });
    const r = w.withdraw(100n);
    assert.equal(r.ok, true);
    assert.equal(w.balance(), 0n);
  });

  test("withdraw balance + 1 minor unit is rejected (boundary)", () => {
    const w = new Wallet({ initialBalance: 100n });
    assert.equal(w.withdraw(101n).ok, false);
    assert.equal(w.balance(), 100n);
  });

  test("the crossing withdrawal in a sequence is the one rejected", () => {
    const w = new Wallet({ initialBalance: 10n });
    for (let i = 0; i < 10; i++) assert.equal(w.withdraw(1n).ok, true);
    assert.equal(w.balance(), 0n);
    assert.equal(w.withdraw(1n).ok, false);
    assert.equal(w.balance(), 0n);
  });

  test("negative deposit cannot be used as an unchecked withdrawal", () => {
    const w = new Wallet({ initialBalance: 5n });
    const r = w.deposit(-100n);
    assert.equal(r.ok, false);
    assert.equal(w.balance(), 5n);
  });

  test("constructor cannot open a wallet at a negative balance", () => {
    assert.throws(() => new Wallet({ initialBalance: -1n }), RangeError);
  });

  test("a number-typed negative initial balance is also refused", () => {
    // Type stripping means TS annotations are erased at runtime; the guard must
    // be a real runtime check, not a compile-time one.
    assert.throws(() => new Wallet({ initialBalance: -1 as never }), RangeError);
  });
});

// ---------------------------------------------------------------------------
// S2 / S3 — deposits and withdrawals move the balance by EXACTLY the amount
// ---------------------------------------------------------------------------
describe("S2/S3 — exact deltas", () => {
  test("deposit delta is exact for a spread of magnitudes", () => {
    for (const amt of [1n, 2n, 7n, 99n, 1_000_000n, 2n ** 32n, 2n ** 52n, 2n ** 62n]) {
      const w = new Wallet();
      const before = w.balance();
      assert.equal(w.deposit(amt).ok, true);
      assert.equal(w.balance() - before, amt);
    }
  });

  test("withdraw delta is exact for a spread of magnitudes", () => {
    for (const amt of [1n, 7n, 99n, 1_000_000n, 2n ** 32n, 2n ** 52n]) {
      const w = new Wallet({ initialBalance: 2n ** 62n });
      const before = w.balance();
      assert.equal(w.withdraw(amt).ok, true);
      assert.equal(before - w.balance(), amt);
    }
  });

  test("deposit/withdraw round-trip returns to the exact starting balance", () => {
    const w = new Wallet({ initialBalance: 12345n });
    for (const amt of [1n, 3n, 7n, 999_999_999_999n, 2n ** 50n]) {
      w.deposit(amt);
      w.withdraw(amt);
      assert.equal(w.balance(), 12345n);
    }
  });

  test("the classic float trap: 0.1 + 0.2 has no analogue in minor units", () => {
    // 10 + 20 minor units must be exactly 30, and repeated additions of 7 must
    // not drift. Under IEEE-754 accumulation this is where wallets bleed.
    const w = new Wallet();
    w.deposit(10n);
    w.deposit(20n);
    assert.equal(w.balance(), 30n);

    const w2 = new Wallet();
    for (let i = 0; i < 100_000; i++) w2.deposit(7n);
    assert.equal(w2.balance(), 700_000n);
  });

  test("number-typed amounts move the balance by exactly that number", () => {
    const w = new Wallet();
    assert.equal(w.deposit(100).ok, true);
    assert.equal(w.balance(), 100n);
    assert.equal(w.withdraw(40).ok, true);
    assert.equal(w.balance(), 60n);
  });
});

// ---------------------------------------------------------------------------
// S4 — rejected operations do not change state
// ---------------------------------------------------------------------------
describe("S4 — rejections are inert", () => {
  const rejections: Array<[string, (w: Wallet) => unknown]> = [
    ["withdraw over balance", (w) => w.withdraw(10_000n)],
    ["withdraw zero", (w) => w.withdraw(0n)],
    ["withdraw negative", (w) => w.withdraw(-5n)],
    ["withdraw NaN", (w) => w.withdraw(NaN)],
    ["withdraw Infinity", (w) => w.withdraw(Infinity)],
    ["withdraw non-integer", (w) => w.withdraw(1.5)],
    ["withdraw string", (w) => w.withdraw("10" as never)],
    ["withdraw null", (w) => w.withdraw(null as never)],
    ["withdraw undefined", (w) => w.withdraw(undefined as never)],
    ["withdraw missing arg", (w) => (w.withdraw as () => unknown)()],
    ["deposit zero", (w) => w.deposit(0n)],
    ["deposit negative", (w) => w.deposit(-5n)],
    ["deposit over max", (w) => w.deposit(MAX)],
    ["deposit NaN", (w) => w.deposit(NaN)],
    ["deposit object", (w) => w.deposit({} as never)],
    ["deposit array", (w) => w.deposit([] as never)],
    ["deposit boolean true", (w) => w.deposit(true as never)],
    ["deposit Symbol", (w) => w.deposit(Symbol("x") as never)],
  ];

  for (const [label, op] of rejections) {
    test(`no state change: ${label}`, () => {
      const w = new Wallet({ initialBalance: 100n });
      assertNoStateChange(w, () => op(w), label);
    });
  }

  test("a rejection does not poison the next valid operation", () => {
    const w = new Wallet({ initialBalance: 100n });
    w.withdraw(999n); // rejected
    w.deposit(-1n); // rejected
    w.deposit(NaN); // rejected
    assert.equal(w.deposit(50n).ok, true);
    assert.equal(w.balance(), 150n);
  });

  test("the rejection result reports the CURRENT (unchanged) balance", () => {
    const w = new Wallet({ initialBalance: 100n });
    const r = w.withdraw(999n);
    assert.equal(r.ok, false);
    assert.equal(r.balance, 100n);
  });

  test("100 interleaved rejections leave the balance bit-identical", () => {
    const w = new Wallet({ initialBalance: 42n });
    for (let i = 0; i < 100; i++) {
      w.withdraw(43n);
      w.deposit(0n);
      w.withdraw(-i);
      assert.equal(w.balance(), 42n);
    }
  });
});

// ---------------------------------------------------------------------------
// S5 — invalid / zero / negative / extremely large / repeated / concurrent
//      operations have EXPLICIT outcomes
// ---------------------------------------------------------------------------
describe("S5 — explicit outcomes", () => {
  test("invalid inputs all produce a defined, non-throwing, tagged outcome", () => {
    const invalid: unknown[] = [
      NaN, Infinity, -Infinity, 1.5, 0.1, -0.5,
      Number.MAX_VALUE, Number.MIN_VALUE, 2 ** 53, 1e30,
      "10", "", " 10 ", null, undefined, true, false,
      {}, [], [5], Symbol("s"), () => 1, new Date(),
      new Number(5), { valueOf: () => 100 }, Object(5n),
    ];
    for (const bad of invalid) {
      const w = new Wallet({ initialBalance: 100n });
      const d = w.deposit(bad as never);
      const wd = w.withdraw(bad as never);
      for (const [r, op] of [[d, "deposit"], [wd, "withdraw"]] as const) {
        assert.equal(r.ok, false, `${op}(${String(bad)}) unexpectedly succeeded`);
        assert.equal(
          (r as { error: string }).error,
          "INVALID_AMOUNT",
          `${op}(${String(bad)}) produced an unexpected code`,
        );
      }
      assert.equal(w.balance(), 100n);
    }
  });

  test("valueOf/Symbol.toPrimitive are never invoked (no coercion re-entrancy)", () => {
    const w = new Wallet({ initialBalance: 100n });
    let called = 0;
    const hostile = {
      valueOf() { called++; w.withdraw(100n); return 5; },
      [Symbol.toPrimitive]() { called++; w.withdraw(100n); return 5; },
    };
    const r = w.deposit(hostile as never);
    assert.equal(r.ok, false);
    assert.equal(called, 0, "amount was coerced — re-entrancy vector exists");
    assert.equal(w.balance(), 100n);
  });

  test("zero has an explicit outcome on both operations", () => {
    const w = new Wallet({ initialBalance: 100n });
    assert.deepEqual(w.deposit(0n), { ok: false, error: "NON_POSITIVE_AMOUNT", balance: 100n });
    assert.deepEqual(w.withdraw(0n), { ok: false, error: "NON_POSITIVE_AMOUNT", balance: 100n });
    assert.deepEqual(w.deposit(0), { ok: false, error: "NON_POSITIVE_AMOUNT", balance: 100n });
    assert.deepEqual(w.deposit(-0), { ok: false, error: "NON_POSITIVE_AMOUNT", balance: 100n });
  });

  test("negative has an explicit outcome, and never inverts the operation", () => {
    const w = new Wallet({ initialBalance: 100n });
    assert.equal(w.withdraw(-50n).ok, false); // must NOT increase the balance
    assert.equal(w.deposit(-50n).ok, false); // must NOT decrease the balance
    assert.equal(w.balance(), 100n);
  });

  test("extremely large amounts are refused explicitly, never wrapped", () => {
    const w = new Wallet();
    for (const huge of [2n ** 63n, 2n ** 64n, 2n ** 128n, 2n ** 256n, 10n ** 100n]) {
      const r = w.deposit(huge);
      assert.equal(r.ok, false);
      assert.equal((r as { error: string }).error, "BALANCE_LIMIT_EXCEEDED");
      assert.equal(w.balance(), 0n, "balance moved on an oversized deposit");
    }
    // And the same magnitudes on the withdrawal side.
    for (const huge of [2n ** 63n, 10n ** 100n]) {
      const r = w.withdraw(huge);
      assert.equal(r.ok, false);
      assert.equal((r as { error: string }).error, "INSUFFICIENT_FUNDS");
    }
  });

  test("the balance ceiling is reachable exactly and is inclusive", () => {
    const w = new Wallet();
    assert.equal(w.deposit(MAX).ok, true);
    assert.equal(w.balance(), MAX);
    assert.equal(w.deposit(1n).ok, false); // one over — explicit rejection, no wrap
    assert.equal(w.balance(), MAX, "balance wrapped past the ceiling");
  });

  test("repeated identical operations compound; there is no idempotency key", () => {
    const w = new Wallet();
    for (let i = 0; i < 5; i++) w.deposit(100n);
    // Recorded as the OBSERVED semantics: repeats accumulate. The spec leaves
    // idempotency unresolved, so this is evidence, not a pass/fail.
    assert.equal(w.balance(), 500n);
    // There is no request/transaction identifier anywhere in the public surface.
    const surface = [
      ...Object.getOwnPropertyNames(Wallet.prototype),
      ...Object.getOwnPropertyNames(new Wallet()),
    ];
    assert.equal(
      surface.some((k) => /idempot|request|txn|transaction|nonce|key/i.test(k)),
      false,
      "an idempotency surface exists — retest replay semantics",
    );
  });
});

// ---------------------------------------------------------------------------
// S6 — arithmetic cannot silently overflow or lose precision
// ---------------------------------------------------------------------------
describe("S6 — no silent overflow or precision loss", () => {
  test("accumulation of 200k deposits matches exact arithmetic", () => {
    const w = new Wallet();
    let expected = 0n;
    for (let i = 1n; i <= 200_000n; i++) {
      w.deposit(i);
      expected += i;
    }
    assert.equal(w.balance(), expected);
  });

  test("values above 2^53 stay exact (float would round here)", () => {
    const w = new Wallet();
    const big = 2n ** 53n; // 9007199254740992
    w.deposit(big);
    w.deposit(1n);
    assert.equal(w.balance(), big + 1n, "the +1 was absorbed — precision lost");
    // Sanity check on the trap itself: a float-backed wallet WOULD have lost
    // this deposit, because Number(2^53 + 1) collapses back onto Number(2^53).
    assert.equal(Number(w.balance()), Number(big), "sanity: float would lose this");
  });

  test("a number that has already lost precision is refused, not absorbed", () => {
    // 2^53 + 1 is not representable as a double; it arrives as 2^53.
    assert.equal(2 ** 53 + 1, 2 ** 53);
    const w = new Wallet();
    const r = w.deposit(2 ** 53 + 1);
    assert.equal(r.ok, false, "a precision-losing number was accepted");
    assert.equal((r as { error: string }).error, "INVALID_AMOUNT");
    assert.equal(w.balance(), 0n);
  });

  test("no fractional minor unit can be silently rounded in", () => {
    const w = new Wallet();
    for (const frac of [0.1, 0.5, 0.9, 1.5, 2.000000001, 1e-7]) {
      assert.equal(w.deposit(frac).ok, false, `deposit(${frac}) was accepted`);
    }
    assert.equal(w.balance(), 0n);
  });

  test("the ceiling is enforced by an explicit error, never by wrapping", () => {
    const w = new Wallet({ initialBalance: MAX - 1n });
    assert.equal(w.deposit(1n).ok, true);
    assert.equal(w.balance(), MAX);
    const r = w.deposit(1n);
    assert.equal(r.ok, false);
    assert.equal(w.balance() > 0n, true, "balance wrapped to a negative/small value");
  });

  test("a custom maxBalance far beyond 2^64 still behaves exactly", () => {
    const huge = 10n ** 40n;
    const w = new Wallet({ maxBalance: huge });
    w.deposit(huge - 1n);
    w.deposit(1n);
    assert.equal(w.balance(), huge);
    assert.equal(w.deposit(1n).ok, false);
  });
});

// ---------------------------------------------------------------------------
// Encapsulation / bypass — invariants must not be defeatable from outside
// ---------------------------------------------------------------------------
describe("Encapsulation — S1..S4 must not be bypassable", () => {
  test("balance() returns an immutable primitive, not an aliased reference", () => {
    const w = new Wallet({ initialBalance: 100n });
    const b = w.balance();
    assert.equal(typeof b, "bigint");
    assert.equal(Object.isFrozen(Object(b)) || typeof b !== "object", true);
  });

  test("internal state is not reachable via own properties or JSON", () => {
    const w = new Wallet({ initialBalance: 100n });
    assert.deepEqual(Object.keys(w), []);
    assert.deepEqual(Object.getOwnPropertyNames(w), []);
    assert.deepEqual(Object.getOwnPropertySymbols(w), []);
    assert.equal(JSON.stringify(w), "{}");
  });

  test("maxBalance is read-only", () => {
    const w = new Wallet({ initialBalance: 100n, maxBalance: 1000n });
    assert.throws(
      () => { (w as { maxBalance: bigint }).maxBalance = 10n; },
      TypeError,
    );
    assert.equal(w.maxBalance, 1000n);
  });

  test("mutating the returned result object cannot corrupt the wallet", () => {
    const w = new Wallet({ initialBalance: 100n });
    const r = w.deposit(50n);
    (r as { balance: bigint }).balance = 10n ** 30n;
    assert.equal(w.balance(), 150n);
  });

  test("a getter on the options object cannot cause a TOCTOU on construction", () => {
    let reads = 0;
    const opts = {
      get initialBalance() {
        reads++;
        // Return a valid value on the first read, a hostile one afterwards.
        return reads === 1 ? 100n : -(10n ** 30n);
      },
    };
    const w = new Wallet(opts);
    assert.equal(w.balance() >= 0n, true, "S1 defeated via a re-read options getter");
    assert.equal(w.balance(), 100n);
  });

  /**
   * FINDING A-1. The constructor reads `options.initialBalance` / `options.maxBalance`
   * with a plain property get, which walks the prototype chain. An inherited
   * property therefore configures a wallet that was constructed with NO arguments
   * at all. This test asserts the OBSERVED (defective) behavior so the finding is
   * pinned; it will start failing if the builder adds an own-property check.
   */
  test("A-1: inherited options configure a no-argument wallet (balance minted)", () => {
    const proto = Object.prototype as Record<string, unknown>;
    proto.initialBalance = 1000n;
    try {
      const w = new Wallet(); // <- no arguments whatsoever
      assert.equal(w.balance(), 1000n, "expected the pinned defective behavior");
    } finally {
      delete proto.initialBalance;
    }
    assert.equal(new Wallet().balance(), 0n, "cleanup failed");
  });

  test("A-1b: an inherited maxBalance silently freezes every default wallet", () => {
    const proto = Object.prototype as Record<string, unknown>;
    proto.maxBalance = 0n;
    try {
      const w = new Wallet();
      assert.equal(w.maxBalance, 0n);
      const r = w.deposit(1n);
      assert.equal(r.ok, false);
      assert.equal((r as { error: string }).error, "BALANCE_LIMIT_EXCEEDED");
    } finally {
      delete proto.maxBalance;
    }
  });

  test("A-1c: despite A-1, S1 is never defeated — a negative injection still throws", () => {
    const proto = Object.prototype as Record<string, unknown>;
    proto.initialBalance = -1n;
    try {
      assert.throws(() => new Wallet(), RangeError);
    } finally {
      delete proto.initialBalance;
    }
  });

  test("constructor rejects a maxBalance below an explicit initialBalance", () => {
    assert.throws(() => new Wallet({ initialBalance: 10n, maxBalance: 5n }), RangeError);
  });
});
