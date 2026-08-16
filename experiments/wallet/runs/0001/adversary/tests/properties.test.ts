/**
 * Adversary property/fuzz tests — run 0001.
 *
 * These assert only what the six specification bullets actually constrain, so a
 * failure here is unambiguously an implementation defect rather than a
 * disagreement about an unresolved question.
 *
 * Randomness is seeded and the seed is printed, so any failure replays exactly.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "../../builder/implementation/wallet.ts";

/** Deterministic PRNG (mulberry32) so failures are reproducible from the seed. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POISON: unknown[] = [
  NaN, Infinity, -Infinity, 0, -0, 0.5, -1, 2 ** 53, 1e21,
  "5", "", null, undefined, true, {}, [], Symbol("p"), 0n, -1n,
];

describe("Property: the model-based oracle", () => {
  /**
   * Runs a random op sequence against the wallet and against an exact bigint
   * reference model derived *only* from the specification bullets:
   *   - a deposit that the wallet accepts must add exactly its amount (S2)
   *   - a withdrawal that the wallet accepts must subtract exactly it (S3)
   *   - a rejected op must move nothing (S4)
   *   - the balance must never go below zero at any point (S1)
   *   - the running total must equal exact arithmetic throughout (S6)
   */
  for (const seed of [1, 2, 3, 12345, 987654321, 0xdeadbeef]) {
    test(`10k random ops hold S1..S4/S6 (seed ${seed})`, () => {
      const rand = rng(seed);
      const max = (1n << 63n) - 1n;
      const w = new Wallet({ initialBalance: 5_000n });
      let model = 5_000n;
      let accepted = 0;
      let rejected = 0;

      for (let i = 0; i < 10_000; i++) {
        const before = w.balance();
        assert.equal(before, model, `model divergence before op ${i}`);

        // Mix well-formed amounts with poison, and bias magnitudes toward the
        // zero boundary so the insufficient-funds edge is exercised constantly.
        const usePoison = rand() < 0.25;
        const amount: unknown = usePoison
          ? POISON[Math.floor(rand() * POISON.length)]
          : BigInt(Math.floor(rand() * 12_000) + 1);
        const isDeposit = rand() < 0.5;

        const r = isDeposit
          ? w.deposit(amount as never)
          : w.withdraw(amount as never);

        if (r.ok) {
          accepted++;
          const amt = amount as bigint;
          assert.equal(typeof amt, "bigint", `op ${i}: accepted a non-bigint`);
          model = isDeposit ? model + amt : model - amt;
        } else {
          rejected++;
          // S4: nothing moved.
          assert.equal(w.balance(), before, `S4 violated at op ${i}`);
        }

        // S6/S2/S3: exact agreement with the reference model.
        assert.equal(w.balance(), model, `S2/S3/S6 violated at op ${i}`);
        // S1: the invariant, checked after EVERY operation.
        assert.equal(w.balance() >= 0n, true, `S1 violated at op ${i}`);
        // The declared ceiling is never breached.
        assert.equal(w.balance() <= max, true, `ceiling breached at op ${i}`);
        // The reported balance always matches the queried balance.
        assert.equal(r.balance, w.balance(), `result.balance stale at op ${i}`);
      }

      // Guard against a vacuous run: both paths must have been exercised.
      assert.equal(accepted > 500, true, `too few accepted ops (${accepted})`);
      assert.equal(rejected > 500, true, `too few rejected ops (${rejected})`);
    });
  }

  test("conservation: final balance equals exact sum of accepted deltas", () => {
    const rand = rng(4242);
    const w = new Wallet();
    let deposits = 0n;
    let withdrawals = 0n;
    for (let i = 0; i < 20_000; i++) {
      const amt = BigInt(Math.floor(rand() * 1_000_000) + 1);
      if (rand() < 0.6) {
        if (w.deposit(amt).ok) deposits += amt;
      } else {
        if (w.withdraw(amt).ok) withdrawals += amt;
      }
    }
    assert.equal(w.balance(), deposits - withdrawals);
  });

  test("determinism: the identical sequence produces the identical trace twice", () => {
    const run = () => {
      const rand = rng(777);
      const w = new Wallet({ initialBalance: 100n });
      const trace: string[] = [];
      for (let i = 0; i < 2_000; i++) {
        const amt = BigInt(Math.floor(rand() * 300));
        const r = rand() < 0.5 ? w.deposit(amt) : w.withdraw(amt);
        trace.push(r.ok ? `ok:${r.balance}` : `err:${r.error}:${r.balance}`);
      }
      return trace.join("|");
    };
    assert.equal(run(), run());
  });

  test("boundary sweep: every amount around the balance behaves monotonically", () => {
    // For a wallet at B, withdraw(k) must succeed for 1<=k<=B and be rejected
    // with INSUFFICIENT_FUNDS for k>B. No exceptions, no off-by-one.
    const B = 500n;
    for (let k = -2n; k <= B + 2n; k++) {
      const w = new Wallet({ initialBalance: B });
      const r = w.withdraw(k);
      if (k <= 0n) {
        assert.equal(r.ok, false);
        assert.equal((r as { error: string }).error, "NON_POSITIVE_AMOUNT", `k=${k}`);
        assert.equal(w.balance(), B);
      } else if (k <= B) {
        assert.equal(r.ok, true, `k=${k} should succeed`);
        assert.equal(w.balance(), B - k);
      } else {
        assert.equal(r.ok, false, `k=${k} should be rejected`);
        assert.equal((r as { error: string }).error, "INSUFFICIENT_FUNDS", `k=${k}`);
        assert.equal(w.balance(), B);
      }
    }
  });

  test("ceiling sweep: deposits around maxBalance behave monotonically", () => {
    const MAXB = 1_000n;
    for (let k = 1n; k <= MAXB + 2n; k++) {
      const w = new Wallet({ initialBalance: 0n, maxBalance: MAXB });
      const r = w.deposit(k);
      if (k <= MAXB) {
        assert.equal(r.ok, true, `k=${k} should succeed`);
        assert.equal(w.balance(), k);
      } else {
        assert.equal(r.ok, false, `k=${k} should be rejected`);
        assert.equal((r as { error: string }).error, "BALANCE_LIMIT_EXCEEDED");
        assert.equal(w.balance(), 0n);
      }
    }
  });

  test("no input in the poison set is ever accepted", () => {
    for (const p of POISON) {
      const w = new Wallet({ initialBalance: 1_000n });
      assert.equal(w.deposit(p as never).ok, false, `deposit accepted ${String(p)}`);
      assert.equal(w.withdraw(p as never).ok, false, `withdraw accepted ${String(p)}`);
      assert.equal(w.balance(), 1_000n);
    }
  });

  test("no operation ever throws for a domain outcome", () => {
    const inputs = [...POISON, 1n, 100n, 10n ** 40n, -(10n ** 40n)];
    for (const i of inputs) {
      const w = new Wallet({ initialBalance: 10n });
      assert.doesNotThrow(() => w.deposit(i as never), `deposit threw on ${String(i)}`);
      assert.doesNotThrow(() => w.withdraw(i as never), `withdraw threw on ${String(i)}`);
    }
  });
});
