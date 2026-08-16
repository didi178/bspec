"""Small, thread-safe wallet with explicit rejection outcomes."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from threading import Lock


MAX_BALANCE = (1 << 63) - 1


class Outcome(str, Enum):
    ACCEPTED = "accepted"
    INVALID_AMOUNT = "invalid_amount"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    OVERFLOW = "overflow"


@dataclass(frozen=True)
class Result:
    outcome: Outcome
    balance: int

    @property
    def accepted(self) -> bool:
        return self.outcome is Outcome.ACCEPTED


class Wallet:
    """A balance of indivisible integer units in the range 0..MAX_BALANCE."""

    def __init__(self) -> None:
        self._balance = 0
        self._lock = Lock()

    def balance(self) -> int:
        with self._lock:
            return self._balance

    def deposit(self, amount: object) -> Result:
        with self._lock:
            if not _valid_amount(amount):
                return Result(Outcome.INVALID_AMOUNT, self._balance)
            assert isinstance(amount, int)
            if amount > MAX_BALANCE - self._balance:
                return Result(Outcome.OVERFLOW, self._balance)
            self._balance += amount
            return Result(Outcome.ACCEPTED, self._balance)

    def withdraw(self, amount: object) -> Result:
        with self._lock:
            if not _valid_amount(amount):
                return Result(Outcome.INVALID_AMOUNT, self._balance)
            assert isinstance(amount, int)
            if amount > self._balance:
                return Result(Outcome.INSUFFICIENT_FUNDS, self._balance)
            self._balance -= amount
            return Result(Outcome.ACCEPTED, self._balance)


def _valid_amount(amount: object) -> bool:
    # bool is an int subclass in Python, but is not treated as a monetary amount.
    return isinstance(amount, int) and not isinstance(amount, bool) and amount > 0
