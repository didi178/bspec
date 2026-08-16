"""Adversarial conformance tests for run 0002.

Derived from experiments/wallet/README.md via adversary/strategy.md. These tests
assert the seven specification bullets (C1-C7); they do NOT assert the builder's
design choices. A failure here is a candidate finding, not automatically a defect
-- classification happens in findings.md.

Run from runs/0002/:
    PYTHONPATH=handoff/implementation python3 -B -m unittest discover -s adversary/tests -v
"""

from __future__ import annotations

import itertools
import random
import threading
import unittest
from decimal import Decimal
from fractions import Fraction

from wallet import MAX_BALANCE, Outcome, Result, Wallet


def state(w: Wallet) -> int:
    """The entire observable state of a wallet through its public surface."""
    return w.balance()


class C1NonNegative(unittest.TestCase):
    """C1: the balance never becomes negative."""

    def test_withdraw_from_empty(self):
        w = Wallet()
        r = w.withdraw(1)
        self.assertFalse(r.accepted)
        self.assertEqual(w.balance(), 0)

    def test_overdraw_by_one_unit(self):
        w = Wallet()
        w.deposit(100)
        r = w.withdraw(101)
        self.assertIs(r.outcome, Outcome.INSUFFICIENT_FUNDS)
        self.assertEqual(w.balance(), 100)

    def test_withdraw_exact_balance_reaches_zero(self):
        w = Wallet()
        w.deposit(100)
        r = w.withdraw(100)
        self.assertTrue(r.accepted)
        self.assertEqual(w.balance(), 0)

    def test_negative_deposit_cannot_drain(self):
        """A negative deposit is a disguised withdrawal; must not reach C1."""
        w = Wallet()
        r = w.deposit(-100)
        self.assertFalse(r.accepted)
        self.assertGreaterEqual(w.balance(), 0)

    def test_negative_withdraw_cannot_inflate(self):
        w = Wallet()
        r = w.withdraw(-100)
        self.assertFalse(r.accepted)
        self.assertEqual(w.balance(), 0)

    def test_repeated_full_withdrawals(self):
        w = Wallet()
        w.deposit(10)
        self.assertTrue(w.withdraw(10).accepted)
        self.assertFalse(w.withdraw(10).accepted)
        self.assertEqual(w.balance(), 0)


class C2C3Exactness(unittest.TestCase):
    """C2/C3: accepted deposits/withdrawals move the balance by exactly `amount`."""

    def test_deposit_exact(self):
        w = Wallet()
        for amount in (1, 2, 7, 999, 10**6, 10**18):
            before = w.balance()
            r = w.deposit(amount)
            self.assertTrue(r.accepted, amount)
            self.assertEqual(w.balance() - before, amount)
            self.assertEqual(r.balance, w.balance())

    def test_withdraw_exact(self):
        w = Wallet()
        w.deposit(10**18)
        for amount in (1, 2, 7, 999, 10**6):
            before = w.balance()
            r = w.withdraw(amount)
            self.assertTrue(r.accepted, amount)
            self.assertEqual(before - w.balance(), amount)
            self.assertEqual(r.balance, w.balance())

    def test_order_independence(self):
        """Same multiset of deposits, different orders -> same balance (C7)."""
        amounts = [1, 3, 5, 7, 11, 13, 17]
        finals = set()
        for perm in itertools.islice(itertools.permutations(amounts), 60):
            w = Wallet()
            for a in perm:
                w.deposit(a)
            finals.add(w.balance())
        self.assertEqual(finals, {sum(amounts)})


class C4RejectionPurity(unittest.TestCase):
    """C4: rejected operations do not change state."""

    REJECTED_DEPOSITS = [0, -1, -(10**30), None, "10", "", "abc", 1.0, 0.1,
                         float("nan"), float("inf"), float("-inf"),
                         Decimal("10"), Fraction(1, 1), [], {}, (), True, False,
                         object(), b"10", 1 + 0j]
    REJECTED_WITHDRAWALS = REJECTED_DEPOSITS

    def test_rejected_deposits_leave_state_untouched(self):
        for bad in self.REJECTED_DEPOSITS:
            w = Wallet()
            w.deposit(500)
            before = state(w)
            r = w.deposit(bad)
            self.assertFalse(r.accepted, repr(bad))
            self.assertEqual(state(w), before, repr(bad))
            self.assertEqual(r.balance, before, repr(bad))

    def test_rejected_withdrawals_leave_state_untouched(self):
        for bad in self.REJECTED_WITHDRAWALS:
            w = Wallet()
            w.deposit(500)
            before = state(w)
            r = w.withdraw(bad)
            self.assertFalse(r.accepted, repr(bad))
            self.assertEqual(state(w), before, repr(bad))

    def test_insufficient_funds_leaves_state_untouched(self):
        w = Wallet()
        w.deposit(500)
        for amount in (501, 10**9, MAX_BALANCE):
            r = w.withdraw(amount)
            self.assertIs(r.outcome, Outcome.INSUFFICIENT_FUNDS)
            self.assertEqual(w.balance(), 500)

    def test_overflow_leaves_state_untouched(self):
        w = Wallet()
        w.deposit(MAX_BALANCE)
        r = w.deposit(1)
        self.assertIs(r.outcome, Outcome.OVERFLOW)
        self.assertEqual(w.balance(), MAX_BALANCE)

    def test_balance_query_is_pure(self):
        w = Wallet()
        w.deposit(42)
        for _ in range(100):
            self.assertEqual(w.balance(), 42)

    def test_result_is_immutable(self):
        w = Wallet()
        r = w.deposit(10)
        with self.assertRaises(Exception):
            r.balance = 10**9          # type: ignore[misc]
        self.assertEqual(w.balance(), 10)


class C5ExplicitOutcomes(unittest.TestCase):
    """C5: invalid, zero, negative, huge, repeated, concurrent ops are explicit."""

    def test_every_input_returns_a_result_never_raises(self):
        weird = [0, -1, None, "x", 1.5, float("nan"), [], {}, object(),
                 True, Decimal("1"), b"1", 1 + 0j, -0.0, 10**400]
        for bad in weird:
            w = Wallet()
            for op in (w.deposit, w.withdraw):
                try:
                    r = op(bad)
                except Exception as exc:                # noqa: BLE001
                    self.fail(f"{op.__name__}({bad!r}) raised {exc!r}")
                self.assertIsInstance(r, Result, repr(bad))
                self.assertIsInstance(r.outcome, Outcome, repr(bad))

    def test_outcomes_are_distinguishable(self):
        """Different rejection reasons must not collapse into one outcome."""
        w = Wallet()
        w.deposit(10)
        self.assertIs(w.deposit(0).outcome, Outcome.INVALID_AMOUNT)
        self.assertIs(w.withdraw(11).outcome, Outcome.INSUFFICIENT_FUNDS)
        self.assertIs(w.deposit(MAX_BALANCE).outcome, Outcome.OVERFLOW)
        self.assertIs(w.deposit(1).outcome, Outcome.ACCEPTED)

    def test_zero_has_an_explicit_outcome(self):
        w = Wallet()
        self.assertIs(w.deposit(0).outcome, Outcome.INVALID_AMOUNT)
        self.assertIs(w.withdraw(0).outcome, Outcome.INVALID_AMOUNT)

    def test_extremely_large_amounts(self):
        w = Wallet()
        for amount in (2**31, 2**53, 2**53 + 1, 2**63 - 1, 2**63, 2**64, 10**100):
            r = w.deposit(amount)
            self.assertIn(r.outcome, (Outcome.ACCEPTED, Outcome.OVERFLOW), amount)
            self.assertLessEqual(w.balance(), MAX_BALANCE)
            self.assertGreaterEqual(w.balance(), 0)

    def test_2_53_plus_1_survives_exactly(self):
        """Falsifies C7 if any float ever touches the value."""
        w = Wallet()
        w.deposit(2**53 + 1)
        self.assertEqual(w.balance(), 9007199254740993)

    def test_repeated_identical_operations_accumulate(self):
        w = Wallet()
        for i in range(1, 101):
            r = w.deposit(10)
            self.assertTrue(r.accepted)
            self.assertEqual(r.balance, 10 * i)
        self.assertEqual(w.balance(), 1000)

    def test_long_run_no_drift(self):
        w = Wallet()
        rng = random.Random(20260816)
        model = 0
        for _ in range(50_000):
            amount = rng.randint(-5, 100)
            if rng.random() < 0.5:
                r = w.deposit(amount)
                if r.accepted:
                    model += amount
            else:
                r = w.withdraw(amount)
                if r.accepted:
                    model -= amount
            self.assertEqual(w.balance(), model)
            self.assertGreaterEqual(w.balance(), 0)


class C6C7Arithmetic(unittest.TestCase):
    """C6/C7: no silent overflow, no silent precision loss."""

    def test_overflow_is_explicit_not_wrapped(self):
        w = Wallet()
        self.assertTrue(w.deposit(MAX_BALANCE).accepted)
        r = w.deposit(1)
        self.assertIs(r.outcome, Outcome.OVERFLOW)
        self.assertEqual(w.balance(), MAX_BALANCE)
        self.assertGreater(w.balance(), 0)          # no wrap to negative

    def test_overflow_by_accumulation(self):
        """Individually-valid deposits whose sum exceeds the cap."""
        w = Wallet()
        chunk = MAX_BALANCE // 3 + 1
        outcomes = [w.deposit(chunk).outcome for _ in range(5)]
        self.assertIn(Outcome.OVERFLOW, outcomes)
        self.assertLessEqual(w.balance(), MAX_BALANCE)

    def test_boundary_deposit_exactly_to_cap(self):
        w = Wallet()
        w.deposit(MAX_BALANCE - 1)
        self.assertTrue(w.deposit(1).accepted)
        self.assertEqual(w.balance(), MAX_BALANCE)

    def test_fractional_amounts_are_not_silently_rounded(self):
        """0.005 must be rejected or kept exactly -- never rounded away."""
        w = Wallet()
        for amount in (0.1, 0.005, 1.005, 2.5, 0.5, 1e-9):
            before = w.balance()
            r = w.deposit(amount)
            if r.accepted:
                self.fail(f"accepted float {amount!r}; check for rounding")
            self.assertEqual(w.balance(), before)

    def test_no_float_accumulation_error(self):
        w = Wallet()
        for _ in range(10):
            w.deposit(1)
        self.assertEqual(w.balance(), 10)
        self.assertIsInstance(w.balance(), int)


class Isolation(unittest.TestCase):
    """No shared/global state across wallet instances."""

    def test_wallets_are_independent(self):
        a, b = Wallet(), Wallet()
        a.deposit(100)
        self.assertEqual(b.balance(), 0)
        b.deposit(7)
        self.assertEqual(a.balance(), 100)
        self.assertEqual(b.balance(), 7)

    def test_many_wallets(self):
        wallets = [Wallet() for _ in range(50)]
        for i, w in enumerate(wallets):
            w.deposit(i + 1)
        self.assertEqual([w.balance() for w in wallets], list(range(1, 51)))


class Concurrency(unittest.TestCase):
    """C1/C5 under concurrent operations."""

    THREADS = 32
    ROUNDS = 400

    def test_concurrent_withdrawals_never_overdraw(self):
        for _ in range(5):
            w = Wallet()
            w.deposit(self.THREADS // 2)
            start = threading.Barrier(self.THREADS)
            accepted = []
            lock = threading.Lock()

            def worker():
                start.wait()
                r = w.withdraw(1)
                if r.accepted:
                    with lock:
                        accepted.append(1)

            threads = [threading.Thread(target=worker) for _ in range(self.THREADS)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            self.assertEqual(len(accepted), self.THREADS // 2)
            self.assertEqual(w.balance(), 0)

    def test_concurrent_deposits_lose_no_updates(self):
        w = Wallet()
        start = threading.Barrier(self.THREADS)

        def worker():
            start.wait()
            for _ in range(self.ROUNDS):
                w.deposit(1)

        threads = [threading.Thread(target=worker) for _ in range(self.THREADS)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(w.balance(), self.THREADS * self.ROUNDS)

    def test_mixed_concurrent_ops_preserve_invariant_and_conservation(self):
        w = Wallet()
        w.deposit(10_000)
        start = threading.Barrier(self.THREADS)
        deltas = []
        agg = threading.Lock()
        violations = []

        def worker(seed):
            rng = random.Random(seed)
            local = 0
            start.wait()
            for _ in range(self.ROUNDS):
                amount = rng.randint(1, 20)
                if rng.random() < 0.5:
                    r = w.deposit(amount)
                    if r.accepted:
                        local += amount
                else:
                    r = w.withdraw(amount)
                    if r.accepted:
                        local -= amount
                if r.balance < 0:
                    violations.append(r.balance)
            with agg:
                deltas.append(local)

        threads = [threading.Thread(target=worker, args=(i,))
                   for i in range(self.THREADS)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(violations, [])
        self.assertEqual(w.balance(), 10_000 + sum(deltas))
        self.assertGreaterEqual(w.balance(), 0)


class ModelBasedProperty(unittest.TestCase):
    """Randomised sequences against a reference model, with shrinking."""

    OPS = ("deposit", "withdraw")

    def reference(self, ops):
        """Returns the model balance, or None if the model rejects the run."""
        bal = 0
        for op, amount in ops:
            if not (isinstance(amount, int) and not isinstance(amount, bool)
                    and amount > 0):
                continue
            if op == "deposit":
                if bal + amount <= MAX_BALANCE:
                    bal += amount
            else:
                if amount <= bal:
                    bal -= amount
        return bal

    def run_ops(self, ops):
        w = Wallet()
        for op, amount in ops:
            r = getattr(w, op)(amount)
            if r.balance < 0:
                return None
        return w.balance()

    def shrink(self, ops):
        """Delta-debug to a minimal failing prefix/subset."""
        current = list(ops)
        changed = True
        while changed and len(current) > 1:
            changed = False
            for i in range(len(current)):
                candidate = current[:i] + current[i + 1:]
                if self.run_ops(candidate) != self.reference(candidate):
                    current = candidate
                    changed = True
                    break
        return current

    def test_random_sequences_match_reference(self):
        rng = random.Random(0xB5EC)
        pool = [0, 1, 2, -1, -5, 7, 10**3, 10**19, MAX_BALANCE, MAX_BALANCE - 1,
                2**63, None, "5", 1.5, True, float("nan")]
        for trial in range(2000):
            n = rng.randint(1, 12)
            ops = [(rng.choice(self.OPS), rng.choice(pool)) for _ in range(n)]
            observed = self.run_ops(ops)
            expected = self.reference(ops)
            if observed != expected:
                minimal = self.shrink(ops)
                self.fail(f"trial {trial}: expected {expected}, got {observed}; "
                          f"minimal counterexample: {minimal}")


if __name__ == "__main__":
    unittest.main()
