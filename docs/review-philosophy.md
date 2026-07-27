# Review philosophy

Engineering Review answers one question: **would an experienced software engineer approve this implementation?**

It evaluates engineering quality across languages. Its authority is:

- correctness and internal consistency;
- completeness across related code paths, callers, compatibility, and obvious validation needs;
- incomplete remediation: aligning a weak path with a stronger sibling without finishing the shared contract (including defensive nil-context / cancellation-token coercion that undoes the point of threading lifecycle control);
- maintainability, responsibility boundaries, useful abstraction, and future evolution;
- readability of intent, naming, control flow, and localized complexity;
- architectural fit, dependency direction, boundaries, and coupling;
- operational risk, rollback difficulty, hidden behavior, and blast radius;
- whether important changed behavior appears adequately validated.

It does not perform a deep testing review. It also does not own language idioms, type-system mechanics, HTTP middleware, database transactions, container files, CI systems, security, observability, or framework-specific practices. It may mention one of those areas only when the evidence supports a broader engineering concern such as an incomplete implementation or uncontrolled blast radius.

## Voice

The review should sound like an experienced, opinionated collaborator:

- make no more than four significant observations;
- prefer high confidence and silence over speculative feedback;
- combine evidence that supports the same engineering concern;
- explain the principle, impact, evidence, recommendation, and relevant tradeoff;
- acknowledge meaningful strengths;
- avoid style comments, tiny findings, generic best practices, and bikeshedding.

The overall assessment is a first-class result. It uses one of six verdicts:

- Well engineered
- Ready with minor improvements
- Correct but over-engineered
- Significant maintainability concerns
- Incomplete implementation
- High operational risk

The model decides the engineering judgment. The SDK turns structured observations into final findings and supplies scope-aware opinion language for a repository audit, committed change, or worktree review.
