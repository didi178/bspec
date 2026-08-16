# Builder evidence map

This maps the candidate behavior in `experiments/wallet/README.md` to builder
evidence. Tests are construction evidence only, not proof of correctness.

| Behavioral claim | Implementation evidence | Test evidence |
| --- | --- | --- |
| Balance never becomes negative | `Wallet.withdraw` rejects an amount greater than the balance while holding the wallet lock. | `test_insufficient_funds_does_not_change_state`; `test_concurrent_withdrawals_never_make_balance_negative` |
| Successful deposits increase by exactly the amount | `Wallet.deposit` performs `self._balance += amount` after validation and overflow checking. | `test_deposit_and_withdraw_exact_amount`; `test_concurrent_deposits_are_not_lost` |
| Successful withdrawals decrease by exactly the amount | `Wallet.withdraw` performs `self._balance -= amount` after validation and funds checking. | `test_deposit_and_withdraw_exact_amount` |
| Rejected operations do not change state | Every rejection returns before assignment to `_balance`. | invalid, insufficient-funds, and overflow tests |
| Invalid, zero, and negative operations have explicit outcomes | `_valid_amount` defines valid input; both operations return `INVALID_AMOUNT` otherwise. | `test_invalid_amounts_are_rejected_without_state_change` |
| Extremely large operations have an explicit outcome | Deposits exceeding remaining capacity return `OVERFLOW`; withdrawals exceeding balance return `INSUFFICIENT_FUNDS`. | `test_maximum_balance_and_overflow`; insufficient-funds test |
| Repeated operations have an explicit outcome | There is no operation identity; each invocation is independently validated and applied or rejected. | `test_repeated_operations_are_each_applied` |
| Concurrent operations have an explicit outcome | A per-wallet lock makes each query or operation atomic and linearizable in lock-acquisition order. | both concurrent tests |
| Arithmetic cannot silently overflow or lose precision | Amounts and balances are integers; deposits enforce `MAX_BALANCE` before addition. | `test_maximum_balance_and_overflow`; invalid non-integer cases |

## Construction test result

On 2026-08-16, the final documented command
`python3 -B -m unittest discover -s tests -v` ran 8 tests in 0.006 seconds and
reported `OK` under Apple Python 3.9.6. A source-only `compile(...)` check also
reported `syntax compile: OK`. No wallet test failed during construction.

Two environment failures/diagnostics were encountered and retained:

- The configured interactive zsh startup emitted
  `(eval):5: parse error near 'end'` before commands, while the Python test
  process still completed with exit status 0.
- `python3 -m py_compile implementation/wallet.py` failed with
  `PermissionError: [Errno 1] Operation not permitted` because Apple Python tried
  to create its configured bytecode cache under the sandbox-blocked
  `~/Library/Caches` tree. The documented `-B` test command avoids bytecode
  writes, and the non-writing `compile(...)` syntax check succeeded.

The adapter directory resolved `python3` to 3.14.5, while the prepared run
directory resolved it to 3.9.6. Results above identify the executable used from
the run directory.
