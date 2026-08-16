# Wallet implementation

Requires Python 3.9 or newer and has no third-party dependencies.

From the run's `builder` directory, run the tests with:

```sh
python3 -B -m unittest discover -s tests -v
```

Use the API by putting `implementation` on `PYTHONPATH` (as the tests do):

```python
from wallet import Wallet

wallet = Wallet()
assert wallet.deposit(10).accepted
assert wallet.withdraw(4).accepted
assert wallet.balance() == 6
```

Every mutation returns a `Result` containing an `Outcome` and the balance after
the operation. Rejected operations return the unchanged balance.
