"""Exotic probes that go beyond the conformance suite.

These are exploratory, not pass/fail assertions: each prints what it observed so
findings.md can quote it. Run from runs/0002/:

    PYTHONPATH=handoff/implementation python3 -B adversary/tests/probe_exotic.py
"""

from __future__ import annotations

import sys
import threading

from wallet import MAX_BALANCE, Outcome, Wallet


def hdr(title):
    print(f"\n=== {title} ===")


hdr("environment")
print("python:", sys.version.replace("\n", " "))
gil = getattr(sys, "_is_gil_enabled", None)
print("gil enabled:", gil() if gil else "n/a (non-free-threaded build)")
print("MAX_BALANCE:", MAX_BALANCE, "==", "2**63-1" if MAX_BALANCE == 2**63 - 1 else "?")


hdr("P1: hostile int subclass with overridden __gt__")


class Sneaky(int):
    """isinstance(x, int) is True, but comparisons lie selectively."""

    def __gt__(self, other):
        # True only when compared against 0 (the validity check),
        # False against the overflow/funds check.
        return other == 0


w = Wallet()
amount = Sneaky(-100)
r = w.deposit(amount)
print(f"deposit(Sneaky(-100)) -> outcome={r.outcome.value} balance={r.balance}")
print(f"wallet.balance() = {w.balance()}   NEGATIVE={w.balance() < 0}")

w2 = Wallet()
w2.deposit(50)
r2 = w2.withdraw(Sneaky(-1000))
print(f"withdraw(Sneaky(-1000)) on balance 50 -> outcome={r2.outcome.value} "
      f"balance={w2.balance()}")


hdr("P2: int subclass that re-enters the wallet during validation (deadlock)")


class Reentrant(int):
    target = None

    def __gt__(self, other):
        if Reentrant.target is not None:
            t, Reentrant.target = Reentrant.target, None
            t.balance()          # re-acquires the same non-reentrant Lock
        return int(self) > other


w3 = Wallet()
Reentrant.target = w3
done = threading.Event()


def attempt():
    try:
        w3.deposit(Reentrant(5))
    finally:
        done.set()


t = threading.Thread(target=attempt, daemon=True)
t.start()
if done.wait(timeout=2.0):
    print("no deadlock: operation completed")
else:
    print("DEADLOCK: deposit() hung for >2s holding a non-reentrant Lock")
Reentrant.target = None


hdr("P3: module-level MAX_BALANCE is public and rebindable")
import wallet as wallet_module                                  # noqa: E402

original = wallet_module.MAX_BALANCE
print("MAX_BALANCE is exported and writable:",
      "MAX_BALANCE" in dir(wallet_module))
print("note: rebinding it does not affect already-constructed wallets' data, "
      "but does change the cap for all subsequent deposits process-wide")
wallet_module.MAX_BALANCE = original


hdr("P4: private state is reachable and unvalidated")
w4 = Wallet()
w4.deposit(10)
print("before:", w4.balance())
w4._balance = -999                                              # noqa: SLF001
print("after direct _balance write:", w4.balance(), "(no encapsulation guard)")


hdr("P5: repeated operations -- idempotency question")
w5 = Wallet()
a = w5.deposit(100)
b = w5.deposit(100)
print(f"two identical deposit(100) calls -> {a.outcome.value}/{b.outcome.value}, "
      f"balance={w5.balance()} (applied twice; no idempotency key exists)")


hdr("P6: Outcome is a str-Enum -- equality with bare strings")
r6 = Wallet().deposit(1)
print("r.outcome == 'accepted':", r6.outcome == "accepted")
print("r.outcome is Outcome.ACCEPTED:", r6.outcome is Outcome.ACCEPTED)


hdr("P7: resource behaviour on absurdly large integers")
import time                                                     # noqa: E402

w7 = Wallet()
big = 10 ** 1_000_000
t0 = time.perf_counter()
r7 = w7.deposit(big)
print(f"deposit(10**1_000_000) -> {r7.outcome.value} in "
      f"{(time.perf_counter() - t0) * 1000:.2f} ms")


hdr("P8: assert stripped under -O")
print("running with -O:", not __debug__)
print("(_valid_amount already guarantees int, so the assert is redundant either way)")


hdr("P9: no persistence, no authorization, no currency, no identity")
print("Wallet public surface:",
      sorted(n for n in dir(Wallet) if not n.startswith("__")))
print("constructor signature: Wallet() -- no initial balance, no owner, "
      "no currency, no id")
