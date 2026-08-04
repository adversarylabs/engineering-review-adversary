# engineering-review — mission and scope

Source of truth for what this adversary is *for*.

Consumers:

- **This package** — prompts and review behavior should stay aligned with this doc.
- **adversary-factory** — when grading human PR comments as gold, only **in-scope** comments count as fair misses.

Related: [review-philosophy.md](./review-philosophy.md).

## Mission

Answer: **Would an experienced software engineer approve this implementation?**

Staff/Principal engineering judgment on a proposed change — not a linter, not a specialist tool, not a style guide.

## In scope (should catch / fair to grade as a miss)

- Correctness and internal consistency of the change
- Incomplete implementation across related paths, callers, compatibility, validation
- Incomplete remediation (e.g. half-fixed contracts, nil-context coercion that undoes threading lifecycle control)
- Maintainability: boundaries, abstraction, duplication, future evolution
- Readability of intent when it creates real engineering risk (not pure bikeshed naming)
- Architectural fit, coupling, dependency direction
- Operational risk: blast radius, hidden behavior, rollback difficulty
- Important changed behavior that appears inadequately validated (specific, not “add more tests”)

## Out of scope (not a miss if humans only said these)

- Pure documentation / comment wording / godoc nits
- GitHub suggestion blocks that only rewrite comment text or formatting
- Style, formatting, naming bikesheds without correctness/maintainability impact
- Language idioms and type-system mechanics as such
- Framework conventions, HTTP middleware details, DB transaction mechanics
- Dockerfiles, CI/CD config, build system trivia
- Security deep-dives (secrets, authz models) — specialist adversaries
- Observability/instrumentation detail as such
- Exhaustive testing technique / coverage metrics
- “LGTM”, process, or merge logistics

## Factory grading rule

- **In scope + human raised it + engineering-review did not** → real miss → factory story + suggested issue
- **Out of scope** → do not treat as gold; do not create a miss issue
- **Unclear** → prefer out-of-scope for grading (avoid false product failures)
