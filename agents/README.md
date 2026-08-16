# Agent Roles

This directory contains minimal starting prompts and records for BSpec experiments. They are experimental controls, not product-ready agent definitions.

## Files

- [`builder.system.md`](builder.system.md) — system prompt for producing an implementation from a behavior specification.
- [`adversary.system.md`](adversary.system.md) — system prompt for independently challenging the implementation.
- [`coordinator.system.md`](coordinator.system.md) — system prompt for preserving separation and recording experiment outcomes.
- [`run-record.md`](run-record.md) — copyable template for documenting a run.

## Suggested sequence

1. Create and version the behavior specification.
2. Give the specification and allowed environment to the builder.
3. Give the same specification to the adversary and have it derive a test strategy before seeing builder-authored rationale or tests.
4. Give the implementation and executable artifact to the adversary.
5. Preserve all outputs and classify findings without forcing consensus between agents.
6. Start a new versioned run if the specification changes.

## Using and changing prompts

Experimenters may extend these prompts for a domain, but should preserve the separation between implementation and evaluation. Record the exact prompt content, model, tools, inputs, and relevant settings used in every run so that results can be interpreted and compared.

Separate prompts do not guarantee independent reasoning. Agents may share training, architecture, defaults, or blind spots. Experiments should compare models, prompt families, tools, and independently derived test strategies where possible, and report correlated assumptions as a threat to validity.
