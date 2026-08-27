# Checks

| Review area | Scans for |
| --- | --- |
| Correctness and completeness | Behavior gaps, broken invariants, missing cases, and incomplete implementation |
| Declared operational targets | Literal HTTP health, liveness, or readiness paths for proven repository-built services that have no reachable registration on the applicable prepared listener/route surface; external or unresolved binaries, dynamic paths, non-HTTP probes, framework-provided routes, declarations proven to target another unowned process, partial source views, and routes registered on the applicable listener stay quiet |
| Helm evidence boundary | A changed deployment template triggers cross-artifact traversal only for a concrete literal operational target; template functions or syntax alone never justify generic rendering, schema-validation, or test findings |
| Normative contract conformance | Explicit conformance or migration changes whose reachable implementation contradicts prepared combination, precedence, ordering, fallback, or compatibility requirements |
| No-op configuration contracts | Changed public/shared configuration that accepts a field in a mode where prepared declaration and consumer evidence prove the value has no effect and downstream cannot observe, preserve, or rely on it; explicitly informational or validation-driving fields, compatibility inputs documented as ignored, documented omission semantics, and incomplete consumer surfaces stay quiet |
| Architecture and boundaries | Misplaced responsibilities, harmful coupling, and abstractions that weaken the design |
| Maintainability | Changes that make future reasoning, extension, or safe modification materially harder |
| Failure-path completeness | Required disable, unregister, restore, or cleanup effects skipped when an independent preceding operation fails, leaving contradictory behavior reachable |
| Repeated-use alternate paths | Optimized, cached, pooled, or specialized paths whose first supported invocation leaves concrete state that makes a later invocation of the same logical operation fail, skip work, or diverge from the generic path |
| Operational risk | Failure modes, rollout hazards, unsafe state transitions, and weak recovery behavior |
| Validation quality | Missing or inadequate evidence that the changed behavior works and regressions are contained |
