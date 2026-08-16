# Assumptions and unresolved ambiguities

The source bullets call themselves prompts rather than a complete specification.
The implementation therefore makes the following visible choices:

- A wallet starts at zero. Initial balance was not specified.
- Amounts are positive Python integers representing indivisible, currency-neutral
  units. Currency, fractional units, rounding, and exchange are unresolved.
- `bool`, floats, strings, `None`, zero, and negative integers are invalid and
  return `INVALID_AMOUNT`; invalid input does not raise an exception.
- The maximum balance is `2^63 - 1`. A deposit that would exceed it returns
  `OVERFLOW` without changing state. This bound is an implementation assumption,
  not a requirement inferred from the source.
- A withdrawal larger than the balance returns `INSUFFICIENT_FUNDS`, including an
  extremely large withdrawal. It does not return `OVERFLOW` because no arithmetic
  is attempted.
- Every method call is one atomic operation. Concurrent calls are serialized in
  lock-acquisition order; no stronger fairness or ordering guarantee is made.
- Repeated calls are distinct operations and are not deduplicated. Idempotency
  cannot be expressed because the supplied behavior has no operation IDs.
- Results report a symbolic outcome plus the balance immediately after that
  atomic operation. Exception types and external serialization are unresolved.
- State is in memory only. Persistence, durability, multi-process coordination,
  authentication, authorization, account identity, audit history, and transfers
  are outside what the supplied behavior states.
- The meaning of “invalid” and “extremely large” is not defined by the source;
  this implementation's exact classifications are assumptions suitable for
  adversarial challenge.
