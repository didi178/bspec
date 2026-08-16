/**
 * Adversary constructor-contract tests — run 0001.
 *
 * The implementation README states: "The constructor **does** throw `RangeError`
 * for structurally invalid configuration (negative/oversized initial balance)."
 *
 * These tests probe the boundary of that claim. They assert OBSERVED behavior,
 * so they pin the findings; they will fail if the builder changes the contract.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "../../builder/implementation/wallet.ts";

describe("Constructor contract", () => {
  test("documented cases do throw RangeError", () => {
    assert.throws(() => new Wallet({ initialBalance: -1n }), RangeError);
    assert.throws(() => new Wallet({ maxBalance: -1n }), RangeError);
    assert.throws(() => new Wallet({ initialBalance: 10n, maxBalance: 5n }), RangeError);
    assert.throws(() => new Wallet({ initialBalance: 1 as never }), RangeError);
    assert.throws(() => new Wallet({ maxBalance: 1 as never }), RangeError);
  });

  /**
   * FINDING A-5. `null` is structurally invalid configuration, but it escapes
   * the RangeError contract entirely: the guard is never reached because the
   * property read on `null` throws first. The caller receives a raw engine
   * TypeError naming a PRIVATE field, which is both off-contract and a small
   * internals leak.
   */
  test("A-5: new Wallet(null) throws TypeError, not the documented RangeError", () => {
    let caught: Error | undefined;
    try {
      new Wallet(null as never);
    } catch (e) {
      caught = e as Error;
    }
    assert.ok(caught, "expected a throw");
    assert.equal(caught instanceof TypeError, true, "expected the observed TypeError");
    assert.equal(caught instanceof RangeError, false, "contract says RangeError");
    assert.match(caught!.message, /Cannot read properties of null/);
  });

  /**
   * FINDING A-6. Every non-null primitive is silently accepted as an options
   * object. Property reads on a primitive yield `undefined`, both defaults
   * apply, and construction succeeds. Structurally invalid configuration is
   * neither rejected nor reported.
   */
  test("A-6: non-object arguments are silently accepted as configuration", () => {
    for (const junk of ["nope", 5, true, Symbol("s"), 7n, () => 1, []]) {
      const w = new Wallet(junk as never);
      assert.equal(w.balance(), 0n, `new Wallet(${String(junk)}) should have been rejected`);
      assert.equal(w.maxBalance, (1n << 63n) - 1n);
    }
  });

  /**
   * FINDING A-6b. A misspelled option is silently ignored. Combined with A-1
   * (prototype-chain lookup) and A-6, the pattern is that the options object is
   * never validated as a whole — only the two recognised keys are checked, and
   * only once they have already been read.
   */
  test("A-6b: a misspelled option is silently dropped, yielding a default wallet", () => {
    const w = new Wallet({ intialBalance: 500n } as never); // note the typo
    assert.equal(w.balance(), 0n);
    const w2 = new Wallet({ initialBalanace: 500n, max: 10n } as never);
    assert.equal(w2.balance(), 0n);
    assert.equal(w2.maxBalance, (1n << 63n) - 1n);
  });

  test("A-5/A-6 summary: three malformed arguments, three different behaviors", () => {
    const outcomes: string[] = [];
    for (const arg of [null, "nope", undefined]) {
      try {
        outcomes.push(`ok:${new Wallet(arg as never).balance()}`);
      } catch (e) {
        outcomes.push(`throw:${(e as Error).constructor.name}`);
      }
    }
    // Inconsistent handling of malformed configuration is the finding itself.
    assert.deepEqual(outcomes, ["throw:TypeError", "ok:0", "ok:0"]);
  });

  /**
   * A subclass may override the public reporter, but private state is
   * unreachable, so the invariant still governs the real operations.
   * Recorded as "no defect found" — encapsulation holds.
   */
  test("a subclass can misreport balance() but cannot corrupt real state", () => {
    class Liar extends Wallet {
      balance(): bigint { return 10n ** 12n; }
    }
    const l = new Liar({ initialBalance: 5n });
    assert.equal(l.balance(), 10n ** 12n); // the reporter lies
    assert.equal(l.withdraw(6n).ok, false); // real state still governs
    assert.equal(l.withdraw(5n).ok, true);
  });

  test("private state is unreachable from a borrowed or detached method", () => {
    assert.throws(() => {
      const { deposit } = new Wallet();
      (deposit as (a: bigint) => unknown)(1n);
    }, TypeError);
    assert.throws(
      () => (Wallet.prototype.deposit as (this: unknown, a: bigint) => unknown).call({}, 1n),
      TypeError,
    );
    assert.throws(() => (Object.create(Wallet.prototype) as Wallet).balance(), TypeError);
  });
});
