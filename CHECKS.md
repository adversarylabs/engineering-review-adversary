# Checks

| Review area | Scans for |
| --- | --- |
| Completion-event ordering | Completed-transition events observable before a later fallible authoritative change, without atomic or equivalent guarantees; intent events, deferred dispatch, and confirmed provisional protocols stay quiet |
| Guard exception scope | Existing contract protection bypassed for an intended exception also disappears for another proven reachable category that still requires it; gated exceptions and equivalent downstream guards stay quiet |
| Correctness and completeness | Behavior gaps, broken invariants, missing cases, and incomplete implementation |
| Declared operational targets | Literal HTTP health, liveness, or readiness paths for proven repository-built services that have no reachable registration on the applicable prepared listener/route surface; external or unresolved binaries, dynamic paths, non-HTTP probes, framework-provided routes, declarations proven to target another unowned process, partial source views, and routes registered on the applicable listener stay quiet |
| Helm evidence boundary | A changed deployment template triggers cross-artifact traversal only for a concrete literal operational target; template functions or syntax alone never justify generic rendering, schema-validation, or test findings |
| Normative contract conformance | Explicit conformance or migration changes whose reachable implementation contradicts prepared combination, precedence, ordering, fallback, or compatibility requirements |
| No-op configuration contracts | Changed public/shared configuration that accepts a field in a mode where prepared declaration and consumer evidence prove the value has no effect and downstream cannot observe, preserve, or rely on it; explicitly informational or validation-driving fields, compatibility inputs documented as ignored, documented omission semantics, and incomplete consumer surfaces stay quiet |
| Architecture and boundaries | Misplaced responsibilities, harmful coupling, and abstractions that weaken the design |
| Shared-helper side effects | Caller-specific validation, warnings, or mutation leaking through shared code into a proven other caller; intentional shared contracts, correct mode gates, caller-supplied policies, and hypothetical consumers stay quiet |
| Maintainability | Changes that make future reasoning, extension, or safe modification materially harder |
| Failure-path completeness | Required disable, unregister, restore, or cleanup effects skipped when an independent preceding operation fails, leaving contradictory behavior reachable |
| Repeated-use alternate paths | Optimized, cached, pooled, or specialized paths whose first supported invocation leaves concrete state that makes a later invocation of the same logical operation fail, skip work, or diverge from the generic path |
| Operational risk | Failure modes, rollout hazards, unsafe state transitions, and weak recovery behavior |
| Validation quality | Missing or inadequate evidence that the changed behavior works and regressions are contained |

## Miss-derived review boundary

- Parser grammar boundaries: when a changed parser delegates to a permissive numeric/token helper, compare the helper's accepted spellings with the grammar at this exact syntactic position. Numeric value validity does not establish lexical validity: first-character restrictions, leading zeros, signs, empty tokens, and complete consumption may belong to the caller. Report only with a concrete accepted-invalid spelling, an authoritative prepared grammar or equivalent sibling parser, and a reachable parse result that violates that contract. Cite the entry gate, delegated helper, and contract together. Stay quiet for explicitly permissive grammars, later rejection before use, intentionally separate flag handling, or incomplete grammar evidence; do not universalize a particular format's width rules.

Miss-derived contract coverage: shared-object mutations during specialized loading require ownership, load-path and affected-consumer proof. Executable-example compatibility requires the actual harness, supported configuration and capability restriction; unproven or excluded execution stays quiet.
