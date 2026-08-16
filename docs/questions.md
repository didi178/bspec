# Open Questions

BSpec begins with questions, not a predetermined language design.

## Representation

- Which behaviors need formal notation, and which remain clearer as prose or examples?
- Is a new language necessary, or can existing specification and testing tools express the model?
- Would a semantic intermediate representation let multiple human-facing syntaxes coexist?
- Is behavior best represented as text, a graph, a state machine, constraints, or a composition of these?
- How should ambiguity, conflict, and incompleteness be represented without hiding them?

## Trust and verification

- What makes the adversary meaningfully independent from the builder?
- How do we prevent shared model assumptions from producing correlated failures?
- Which claims can be tested, which require formal verification, and which remain judgment calls?
- How is evidence attached to a behavioral claim and kept valid as the specification changes?
- When should a failed challenge reject the implementation versus refine the specification?

## Human control

- What must remain understandable to a human who does not read the generated implementation?
- How can reviewers see the consequences of a behavior change before accepting it?
- Who resolves conflicts between intent, generated behavior, and operational evidence?
- How can the process avoid turning an opaque specification into a new form of opaque code?

## Evolution and interoperability

- How are behavioral specifications versioned and composed?
- Can existing codebases adopt the methodology incrementally?
- How should dependencies publish and verify behavioral contracts?
- What compatibility guarantees belong to behavior rather than implementation details?
- Which parts of today's compiler and toolchain ecosystem can remain unchanged?

## Evaluation

- What experiment could falsify the core “Behavior is the Source” hypothesis?
- Which domains are small enough to study but rich enough to expose real ambiguity?
- What metrics distinguish genuine correctness gains from additional process and test generation?
- How do cost, latency, reproducibility, and model diversity affect the workflow?
