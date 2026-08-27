# review/engineering — mission and scope

Source of truth for what this adversary is *for*.

- **Package:** `review/engineering` (keep in sync with `adversary.yaml`)
- **Factory / train routing:** human PR comments count as fair misses here only when they match **In scope**.
- **Languages / surfaces:** Language-agnostic — runs on Go, TypeScript, Python, Rust, Java, etc. when present. Running on a language does **not** mean owning that language’s domain defects.

Related: [docs/review-philosophy.md](../docs/review-philosophy.md).

## Mission

Answer: **Would an experienced software engineer approve this implementation?**

Staff/Principal **engineering judgment** on a proposed change — completeness of contracts, maintainability and architecture, operational risk, and whether important behavior is adequately proven.

This is **not**:

- a generalist whole-diff persona (that is packages like `local/torvalds-adversary`)
- a linter or style guide (`review/nits`)
- a language/framework specialist (`lang/go`, `go/*`, framework packs)
- a pure complexity meter (`review/complexity`) when disproportion is the only story

Prefer **zero to four** high-confidence observations. Silence beats speculative breadth.

## In scope (fair miss if a human raised it and we did not)

- Correctness and **internal consistency of the change** as an engineering story (not language-race/TLS/CVE hunting)
- Incomplete implementation across related paths, callers, compatibility, or validation
- Changed deployment or runtime configuration that declares a literal HTTP health, liveness, or readiness path for a proven repository-built service when prepared source exposes the complete applicable listener/route surface and the exact path has no reachable registration there
- Incomplete remediation or migration where a changed contract is not carried through related layers, consumers, or lifecycle behavior
- Required disable, unregister, restore, or cleanup effects skipped when an independent preceding operation fails or returns early, leaving concrete behavior that contradicts the changed contract
- A change that explicitly claims conformance or migration to a normative versioned contract but demonstrably violates prepared combination, precedence, ordering, fallback, or compatibility requirements on a reachable path
- Changed serialized-state decoders that enforce a required framing invariant only with a production-disabled assertion and then use a consumer proven to accept a malformed remainder as a successful partial decode
- Maintainability with **material future cost**: wrong boundaries, harmful coupling, duplication that will rot
- Incorrectly globalized policy where aggregating distinct per-entity constraints changes which items are accepted or rejected
- Alternate fast, vectorized, cached, or specialized paths that drop validity, presence, or tombstone semantics and therefore process invalid items differently from the generic path
- Optimized, cached, pooled, or specialized paths that support repeating the same logical operation but leave concrete state after the first invocation that makes a later invocation fail, skip required work, or diverge from the generic path
- Pagination loops that advance numeric positions by requested capacity despite short non-final pages, skipping records that were never consumed
- Avoidable materially expensive work before a cheap rejection whose predicate is proven independent of that work, repeated retrieval of the same derived data without an intervening mutation, or materially costly mutation writes that source evidence proves can be combined on the same current target and boundary without losing concurrency, state, side-effect, transaction, failure, or retry semantics
- Approval or validation of mutable content followed by re-resolving it before a materially trusted or irreversible action, without pinning or checking the artifact's immutable identity
- Test or integration harnesses proven directly runnable on a developer or persistent runner host that combine privileged persistent host mutation with live service or global-workload control and lack a dominating hosted-ephemeral-CI, explicit opt-in, disposable-environment, or existing-service refusal boundary; a CI marker or self-hosted runner label alone is not containment
- Abstraction that is **disproportionate and** creates a real engineering problem (if the only point is “too much machinery,” prefer `review/complexity`)
- Architectural fit, dependency direction, layering violations in product code
- Changed public or shared configuration that accepts a field in a particular mode even though prepared declaration and consumer evidence prove the value has no effect and downstream cannot observe or rely on it; forbid the combination or give it explicit semantics rather than exposing a misleading no-op
- Operational risk: blast radius, hidden behavior, rollout/rollback difficulty
- Important **changed** behavior whose invariant is not actually proved — name the behavior and missing proof; do not demand “more tests” generically
- Readability of intent **only when** confusion creates real correctness, contract, or ops risk (not bikeshed naming)

## Out of scope (not a miss for this package)

### Taste and pure style → `review/nits` (or ignore)

- “Nit:” renames, formatting, comment wording, godoc polish
- Naming bikesheds without correctness/maintainability impact
- GitHub suggestion blocks that only rewrite comments or formatting
- Unfinished renames / TODO landmines as pure hygiene

### Complexity as the main story → `review/complexity`

- Over-abstraction / unnecessary indirection **when that is the sole concern**
- Eng-review may still own complexity **when** it is evidence for incomplete design, wrong boundary, or ops risk

### Language and domain specialists (not eng-review gold)

- Language idioms and type-system mechanics as such; contract propagation across layers remains in scope when the syntax is incidental
- Go concurrency races, channels, lifecycle → `go/concurrency` (and related)
- Go HTTP / DB / CLI / modules / security shapes → matching `go/*`
- Framework conventions, HTTP middleware details, DB transaction mechanics as idioms
- Security deep-dives (secrets, authz models, CVE class) → `security/*` / domain packs
- Observability/instrumentation detail as such
- Exhaustive testing technique / coverage metrics (as process lectures)

### Infra and process

- **CI/CD and GitHub Actions** → CI specialists (`ci/github-actions`, etc.); CI-only refusal may be containment evidence for the narrow host-destructive harness contract
- Generic Helm rendering, chart schema validation, or requests to add chart tests without a demonstrated incorrect rendered value and reachable effect → Helm specialists or ignore
- Dockerfiles / container build trivia → `container/dockerfile`; container/VM configuration may be isolation evidence for the narrow host-destructive harness contract
- “LGTM”, process, merge logistics
- **Bot / automated reviewers** (Copilot overview, dependabot, …) — never gold
- **PR overview / summary dumps** that restate the change without a specific engineering defect

### Persona posture

- “Wrong stack / get another reviewer” whole-product posture → persona packages, not this one

Mention a specialist area **only** when evidence establishes a **broader engineering** concern (incomplete contract, uncontrolled blast radius, unfinished sibling paths).

## Ownership cheat sheet

| Concern | Owner |
| --- | --- |
| Staff completeness / contract / ops / architecture judgment | **review/engineering** (this package) |
| Pure nits / taste | `review/nits` |
| Disproportionate complexity as primary finding | `review/complexity` |
| Go domain defects | `go/*` / `lang/go` |
| Secrets, CI, Docker | matching specialists |
| Whole-diff maintainer persona | persona packages (e.g. torvalds) |

Train with **`official.enabled: true`** so catalog specialists catch domain gold and suppress local miss drafts that would only clone them. Scope still decides fair misses for *this* package.

## Factory / train grading rule

- **In scope + human raised it + this adversary did not surface an equivalent class** → miss for **review/engineering**
- **Out of scope** → do not treat as gold; do not create a miss issue here
- **Better fit for another adversary** (official jury or sibling) → route there; do not double-count as a miss here
- **Unclear** → prefer **out-of-scope** for grading (avoid false product failures)

## Notes for authors

- Keep prompts (`src/prompt.ts`) and CHECKS aligned with this file.
- When behavior or mission shifts, update this file in the same change.
- Do not widen scope to “everything a careful human said” — that is a different product.
