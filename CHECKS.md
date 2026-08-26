# Checks

| Review area | Scans for |
| --- | --- |
| Correctness and completeness | Behavior gaps, broken invariants, missing cases, and incomplete implementation |
| Normative contract conformance | Explicit conformance or migration changes whose reachable implementation contradicts prepared combination, precedence, ordering, fallback, or compatibility requirements |
| Architecture and boundaries | Misplaced responsibilities, harmful coupling, and abstractions that weaken the design |
| Maintainability | Changes that make future reasoning, extension, or safe modification materially harder |
| Operational risk | Failure modes, rollout hazards, unsafe state transitions, and weak recovery behavior |
| Validation quality | Missing or inadequate evidence that the changed behavior works and regressions are contained |
