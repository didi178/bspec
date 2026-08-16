import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "implementation"))

from wallet import MAX_BALANCE, Outcome, Wallet


class WalletTests(unittest.TestCase):
    def test_initial_balance(self):
        self.assertEqual(Wallet().balance(), 0)

    def test_deposit_and_withdraw_exact_amount(self):
        wallet = Wallet()
        self.assertEqual(wallet.deposit(10).balance, 10)
        result = wallet.withdraw(4)
        self.assertEqual((result.outcome, result.balance), (Outcome.ACCEPTED, 6))

    def test_invalid_amounts_are_rejected_without_state_change(self):
        for amount in (0, -1, 1.5, "1", None, True):
            with self.subTest(amount=amount):
                wallet = Wallet()
                self.assertEqual(wallet.deposit(amount).outcome, Outcome.INVALID_AMOUNT)
                self.assertEqual(wallet.withdraw(amount).outcome, Outcome.INVALID_AMOUNT)
                self.assertEqual(wallet.balance(), 0)

    def test_insufficient_funds_does_not_change_state(self):
        wallet = Wallet()
        wallet.deposit(3)
        self.assertEqual(wallet.withdraw(4).outcome, Outcome.INSUFFICIENT_FUNDS)
        self.assertEqual(wallet.balance(), 3)

    def test_maximum_balance_and_overflow(self):
        wallet = Wallet()
        self.assertTrue(wallet.deposit(MAX_BALANCE).accepted)
        self.assertEqual(wallet.deposit(1).outcome, Outcome.OVERFLOW)
        self.assertEqual(wallet.deposit(MAX_BALANCE + 1).outcome, Outcome.OVERFLOW)
        self.assertEqual(wallet.balance(), MAX_BALANCE)

    def test_repeated_operations_are_each_applied(self):
        wallet = Wallet()
        wallet.deposit(2)
        wallet.deposit(2)
        self.assertEqual(wallet.balance(), 4)
        wallet.withdraw(1)
        wallet.withdraw(1)
        self.assertEqual(wallet.balance(), 2)

    def test_concurrent_deposits_are_not_lost(self):
        wallet = Wallet()
        count = 500
        workers = [threading.Thread(target=lambda: [wallet.deposit(1) for _ in range(count)]) for _ in range(4)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join()
        self.assertEqual(wallet.balance(), count * len(workers))

    def test_concurrent_withdrawals_never_make_balance_negative(self):
        wallet = Wallet()
        wallet.deposit(100)
        results = []
        result_lock = threading.Lock()

        def withdraw_once():
            result = wallet.withdraw(1)
            with result_lock:
                results.append(result)

        workers = [threading.Thread(target=withdraw_once) for _ in range(200)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join()
        self.assertEqual(sum(result.accepted for result in results), 100)
        self.assertEqual(wallet.balance(), 0)


if __name__ == "__main__":
    unittest.main()
