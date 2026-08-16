/**
 * Adversary concurrency probes — run 0001.
 *
 * Specification bullet S5 requires that "concurrent operations have explicit
 * outcomes". The README simultaneously lists concurrency as deliberately
 * unresolved. The bar applied here is therefore: whatever the artifact does
 * under concurrent access must be defined and must not break S1..S4.
 *
 * Per strategy.md §3: a PASS here proves very little (schedules are not
 * exhaustively explored). Only a FAILURE is strong evidence.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "../../builder/implementation/wallet.ts";

describe("S5 — concurrency", () => {
  test("async interleaving cannot break the invariant (methods are synchronous)", async () => {
    // 200 concurrent async agents hammering one wallet. Because deposit/withdraw
    // are synchronous, no await point exists *inside* an operation, so the event
    // loop cannot interleave a partial update. This probes that claim empirically.
    const w = new Wallet({ initialBalance: 1_000n });
    let deposited = 0n;
    let withdrawn = 0n;

    const agent = async (id: number) => {
      for (let i = 0; i < 200; i++) {
        await Promise.resolve(); // yield to the event loop between operations
        if ((id + i) % 2 === 0) {
          if (w.deposit(3n).ok) deposited += 3n;
        } else {
          if (w.withdraw(2n).ok) withdrawn += 2n;
        }
        assert.equal(w.balance() >= 0n, true, "S1 violated under interleaving");
      }
    };

    await Promise.all(Array.from({ length: 200 }, (_, i) => agent(i)));
    assert.equal(w.balance(), 1_000n + deposited - withdrawn, "lost update detected");
  });

  test("a balance held near zero survives concurrent draining", async () => {
    // Bias the schedule toward the insufficient-funds boundary, which is where a
    // check-then-act race would surface as a negative balance.
    const w = new Wallet({ initialBalance: 10n });
    let successes = 0;
    const drain = async () => {
      for (let i = 0; i < 500; i++) {
        await Promise.resolve();
        if (w.withdraw(1n).ok) successes++;
        if (i % 3 === 0) w.deposit(1n);
        assert.equal(w.balance() >= 0n, true, "S1 violated while draining");
      }
    };
    await Promise.all(Array.from({ length: 50 }, drain));
    assert.equal(w.balance() >= 0n, true);
    assert.equal(successes > 0, true, "vacuous run: nothing was withdrawn");
  });

  /**
   * FINDING A-2 (specification gap, demonstrated).
   *
   * Individual operations are atomic, but the artifact offers no COMPOUND
   * atomic operation and no transaction/lock. The ordinary consumer pattern
   * "check the balance, do async work, then withdraw" is therefore racy at the
   * application level. The wallet itself stays correct (S1 holds — it rejects),
   * but the caller observes a check that was true and an action that failed.
   *
   * This is not a wallet bug. It is the specification failing to say what
   * "concurrent operations" means at the API boundary. Demonstrated, not asserted.
   */
  test("A-2: check-then-act across an await is racy (compound ops are not atomic)", async () => {
    const w = new Wallet({ initialBalance: 100n });
    const outcomes: string[] = [];

    const spendIfAffordable = async () => {
      if (w.balance() >= 100n) {
        await Promise.resolve(); // any real async work: I/O, a fetch, a DB call
        const r = w.withdraw(100n);
        outcomes.push(r.ok ? "spent" : `failed:${(r as { error: string }).error}`);
      } else {
        outcomes.push("skipped");
      }
    };

    await Promise.all([spendIfAffordable(), spendIfAffordable()]);

    // Both callers saw an affordable balance; only one could actually spend.
    assert.deepEqual(outcomes.sort(), ["failed:INSUFFICIENT_FUNDS", "spent"]);
    // The wallet's own invariant is intact — this is a gap, not a defect.
    assert.equal(w.balance(), 0n);
  });

  /**
   * FINDING A-3 (specification gap, demonstrated).
   *
   * A Wallet cannot cross a worker_threads boundary: structuredClone drops the
   * class and its private fields. So "concurrent" can only ever mean
   * single-isolate async concurrency for this artifact. Nothing in the artifact
   * states this limit.
   */
  test("A-3: a Wallet cannot be shared across threads (structuredClone drops it)", () => {
    const w = new Wallet({ initialBalance: 100n });
    const clone = structuredClone(w) as Record<string, unknown>;
    // The clone is a bare object: no methods, no balance, no invariants.
    assert.equal(typeof (clone as { balance?: unknown }).balance, "undefined");
    assert.equal(clone instanceof Wallet, false);
    assert.deepEqual(Object.keys(clone), []);
  });
});

describe("Serialization / persistence surface", () => {
  /**
   * FINDING A-4 (specification gap, demonstrated).
   *
   * The result object that makes outcomes "explicit" (S5) cannot be JSON
   * serialized, because `balance` is a bigint. Any transport, log, or persisted
   * ledger built on the documented return value throws. Persistence is listed as
   * unresolved in the specification, so this is a gap rather than a defect — but
   * it is a concrete consequence of an undeclared representation choice.
   */
  test("A-4: the documented result object throws on JSON.stringify", () => {
    const w = new Wallet();
    const r = w.deposit(100n);
    assert.throws(() => JSON.stringify(r), TypeError);
    assert.throws(() => JSON.stringify({ balance: w.balance() }), TypeError);
  });

  test("A-4b: balance() cannot be compared or combined with a plain number", () => {
    const w = new Wallet({ initialBalance: 100n });
    // Strict equality against a number is always false — a silent-bug generator
    // for any consumer that forgets the representation choice.
    assert.equal((w.balance() as unknown) === 100, false);
    assert.equal(w.balance() == 100, true); // loose equality DOES hold
    assert.throws(() => (w.balance() as unknown as number) * 1.5, TypeError);
  });
});
