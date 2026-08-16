"""Probe the window between mutation and result reporting, plus concurrency stress.

Run from runs/0002/:
    PYTHONPATH=handoff/implementation python3 -B adversary/tests/probe_interrupt.py
"""

from __future__ import annotations

import random
import sys
import threading
import time

from wallet import Wallet


def hdr(title):
    print(f"\n=== {title} ===")


hdr("P10: async exception between mutation and Result construction")
# wallet.py deposit():
#     self._balance += amount          <-- state already changed
#     return Result(Outcome.ACCEPTED, self._balance)   <-- caller learns here
# An async exception (KeyboardInterrupt, signal-based timeout, GC'd generator
# throw) landing between those two lines leaves the balance mutated while the
# caller sees an exception and will reasonably believe the operation failed.
# Injected with sys.settrace so the implementation is NOT modified.

w = Wallet()
w.deposit(1000)
before = w.balance()

TARGET_FILE = "wallet.py"
fired = []


def line_tracer(frame, event, arg):
    if event == "line" and frame.f_code.co_name == "deposit":
        if frame.f_code.co_filename.endswith(TARGET_FILE):
            # fire once, on the line right after the += has executed
            if not fired and frame.f_locals.get("self") is w:
                if w.balance.__self__._balance != before:  # mutation happened
                    fired.append(frame.f_lineno)
                    raise KeyboardInterrupt("simulated async interrupt")
    return line_tracer


def global_tracer(frame, event, arg):
    if event == "call" and frame.f_code.co_name == "deposit":
        return line_tracer
    return None


sys.settrace(global_tracer)
threading.settrace(global_tracer)
caught = None
try:
    w.deposit(500)
except BaseException as exc:  # noqa: BLE001
    caught = exc
finally:
    sys.settrace(None)
    threading.settrace(None)

after = w.balance()
print(f"balance before: {before}")
print(f"caller observed: {type(caught).__name__ if caught else 'a Result'}")
print(f"balance after:  {after}")
if caught is not None and after != before:
    print(f"SPLIT OUTCOME: state advanced by {after - before} but the caller "
          f"received an exception, not a Result. Lock released cleanly, so the "
          f"wallet is not corrupted -- but the operation is not atomic from the "
          f"caller's point of view.")
elif caught is not None:
    print("interrupt landed before the mutation; no split outcome this time")
else:
    print("injection did not fire; inconclusive")


hdr("P11: concurrency stress -- 40 rounds of contended withdraw-to-zero")
overdraws = 0
mismatches = 0
for round_no in range(40):
    n = 64
    w = Wallet()
    w.deposit(n // 2)
    barrier = threading.Barrier(n)
    wins = []
    lock = threading.Lock()

    def worker():
        barrier.wait()
        r = w.withdraw(1)
        if r.balance < 0:
            with lock:
                wins.append("NEG")
        if r.accepted:
            with lock:
                wins.append(1)

    ts = [threading.Thread(target=worker) for _ in range(n)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    if "NEG" in wins:
        overdraws += 1
    if wins.count(1) != n // 2 or w.balance() != 0:
        mismatches += 1
print(f"rounds: 40, threads/round: 64, negative balances observed: {overdraws}, "
      f"accounting mismatches: {mismatches}")


hdr("P12: concurrency stress -- mixed ops, conservation check")
mismatch = 0
for round_no in range(20):
    w = Wallet()
    w.deposit(50_000)
    n = 24
    barrier = threading.Barrier(n)
    deltas = []
    agg = threading.Lock()

    def worker(seed):
        rng = random.Random(seed)
        local = 0
        barrier.wait()
        for _ in range(500):
            amount = rng.randint(1, 50)
            if rng.random() < 0.5:
                if w.deposit(amount).accepted:
                    local += amount
            else:
                if w.withdraw(amount).accepted:
                    local -= amount
        with agg:
            deltas.append(local)

    ts = [threading.Thread(target=worker, args=(round_no * 100 + i,))
          for i in range(n)]
    t0 = time.perf_counter()
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    if w.balance() != 50_000 + sum(deltas):
        mismatch += 1
print(f"rounds: 20, threads/round: 24, ops/thread: 500 "
      f"(240,000 ops total), conservation violations: {mismatch}")
print(f"last round wall time: {(time.perf_counter() - t0) * 1000:.0f} ms")
