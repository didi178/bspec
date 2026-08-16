# Wallet Experiment

This experiment uses a small wallet or ledger domain to test BSpec's working model. It is intentionally narrow enough to inspect while still containing state, invariants, failures, and adversarial edge cases.

## Candidate behavior

A wallet may support deposits, withdrawals, and balance queries. An initial specification could require that:

- the balance never becomes negative;
- successful deposits increase the balance by exactly the deposited amount;
- successful withdrawals decrease it by exactly the withdrawn amount;
- rejected operations do not change state;
- invalid, zero, negative, extremely large, repeated, and concurrent operations have explicit outcomes;
- arithmetic cannot silently overflow or lose precision.

These bullets are prompts, not a complete specification. Questions such as currency, numeric representation, authorization, idempotency, concurrency, persistence, and error semantics are deliberately unresolved.

## Proposed experiment

Use the initial roles and run template in [`agents/`](../../agents/), preserving the exact prompts and run metadata alongside the results.

1. Write the smallest inspectable behavior specification for the wallet.
2. Give that specification to a builder agent and collect its implementation and rationale.
3. Have an adversary agent derive a test strategy from the same specification before revealing the builder's rationale or tests, then give it the built artifact.
4. Record counterexamples, specification gaps, and correlated assumptions.
5. Compile and run the implementation using a conventional toolchain.
6. Compare the evidence produced by alternative representations: prose plus examples, a semantic IR, a graph, or a dedicated syntax.

## Success criteria

The experiment is useful if it exposes where behavior is ambiguous, produces reproducible challenges, and helps compare representations. Producing a wallet implementation by itself is not success; ordinary tools can already do that.

No implementation or BSpec syntax has been selected yet.
