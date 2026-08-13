# Checks — what review/engineering detects

This file is the **public audit list** of detectors. If a rule id appears here, it is part of the product surface: it should fire on a vulnerable pattern, stay quiet on the documented clean case, and produce file:line evidence where applicable.

Runtime source of truth: [`src/prompt.ts`](src/prompt.ts), [`src/model-review.ts`](src/model-review.ts).
Regression entry: package tests under the repo test suite.

**Scope:** prepared software changes across languages (LLM-first; not a fixed regex rule pack).

---

## How detection works


Unlike deterministic domain adversaries, **review/engineering** does not ship a large closed set of regex rule ids.

It uses a **staff-engineer prompt** ([`src/prompt.ts`](src/prompt.ts)) constrained by the SDK schema to emit **zero to four** observations. Each observation must include:

| Field | Requirement |
| --- | --- |
| **Engineering principle** | What good engineering demands |
| **Impact** | Why it matters if unchanged |
| **Evidence** | Citations into prepared file ranges only |
| **Recommendation** | Concrete next step |
| **Tradeoff** | When relevant |

Repository content is treated as **untrusted** (prompt-injection resistant): the model must not follow instructions found inside the repo.

## In-scope observation classes


### Contract integrity and compatibility

| | |
| --- | --- |
| **What** | A changed contract is not carried through related representations, consumers, sibling paths, state transitions, or compatibility boundaries |
| **Stays quiet when** | The migration is complete, compatibility is established, or the concern is outside the changed contract neighborhood |

### Ownership, boundaries, and sources of truth

| | |
| --- | --- |
| **What** | A change bypasses an intentional boundary, misplaces a decision, or duplicates policy that must evolve together, creating concrete coupling or drift risk |
| **Stays quiet when** | Responsibilities have a clear owner, or superficially similar implementations represent independent policies |

### Constraint scope and applicability

| | |
| --- | --- |
| **What** | A change collapses distinct per-entity constraints into one aggregate gate, causing an item to be rejected even though an applicable entity would accept it |
| **Stays quiet when** | The implementation first selects applicable entities and evaluates their constraints, or the aggregate enforces an explicit system-wide invariant |

### Alternate-path semantic parity

| | |
| --- | --- |
| **What** | An optimized, vectorized, cached, or specialized path reads a value without its validity, presence, or tombstone metadata and therefore accepts, retains, or counts an invalid item that the generic path excludes |
| **Stays quiet when** | The input is statically non-nullable, invalid items are removed by an established earlier step, or the alternate path evaluates the value together with its metadata |

### Pagination progress accounting

| | |
| --- | --- |
| **What** | A paginated loop advances a numeric position by requested capacity even though a non-final response can contain fewer records, causing the next request to skip unseen records |
| **Stays quiet when** | The client follows an opaque server cursor, advances by actual records consumed, locally guarantees full non-final pages, or intentionally addresses fixed-size byte or block ranges |

### Proportional tools and work

| | |
| --- | --- |
| **What** | A materially broad or expensive operation is used for a narrower need, work is performed unconditionally for consumers that cannot use it, an expensive operation precedes a cheap rejection proven independent of its result and effects, the same derived data is retrieved repeatedly without an intervening mutation or invalidation, or materially costly writes are kept separate even though the current code proves they can be one mutation without changing semantics |
| **Evidence** | For ordering concerns, cite both the materially expensive call and the independent cheap predicate. For duplicate retrieval, cite the repeated call sites and absence of intervening change. For coalescible writes, cite both writes, their same logical target and current endpoint/subresource/transaction boundary, their common pre-write state, the supported combine operation, and the hot-path or scale evidence |
| **Stays quiet when** | The broader operation is required for correctness; a predicate or later write depends on an earlier result or refreshed state; a compare/test/resourceVersion/timestamp/CAS preserves concurrency; writes have distinct targets, boundaries, transactions, side effects, audit, failure, or retry semantics; combine capability or material cost is unproven; or coalescing depends only on a future design |

### Lifecycle and authoritative state

| | |
| --- | --- |
| **What** | Reachable ordering across asynchronous operations or state transitions can consume stale/non-authoritative state or leave the lifecycle incomplete; this includes approving one view of mutable content, resolving it again, and granting materially greater trust or effect to a different artifact |
| **Evidence** | For approval binding, identify the approved revision, the later mutable resolution, and the trusted or irreversible action reached by mismatched content |
| **Stays quiet when** | State ownership and ordering are explicit; the same immutable object flows through; a fetch is pinned to the approved revision or digest; a mismatch aborts before effects; a later read is intentionally fresh and does not rely on earlier approval; or concurrency exists without a demonstrated incorrect outcome |

### Operational risk

| | |
| --- | --- |
| **What** | Blast radius, hidden behavior, rollout, or rollback makes the change unsafe |
| **Stays quiet when** | Risk is acknowledged and controlled |

### Change cohesion

| | |
| --- | --- |
| **What** | Prepared source evidence establishes that a change batches a materially independent behavior objective whose inclusion creates concrete rollback coupling, hidden behavior, or validation ambiguity |
| **Stays quiet when** | Changed files contribute to one implementation story, the dependency between objectives is explicit, or separateness is inferred only from paths, topic count, or unavailable PR metadata |

### Validation gaps

| | |
| --- | --- |
| **What** | Validation does not prove an important changed invariant because it misses the triggering conditions, meaningful oracle, real effect, or material state transition |
| **Stays quiet when** | Existing evidence or the platform contract already proves the invariant |
| **Note** | Does not demand tests generically or prescribe specialist-level technique |

### Overall assessment (not a rule id flood)

The review also returns a single overall stance such as `well-engineered`, `ready-with-minor-improvements`, `incomplete-implementation`, or `high-operational-risk`, with `ship=true/false` for approval gating.

## Out of scope (owned by specialists)

Full contract: **[`agent/scope.md`](agent/scope.md)**.

- Pure style / nits / rename taste → `review/nits`
- Disproportionate complexity as the only story → `review/complexity`
- Language idioms and type-system nits → language / domain packs  
- Framework middleware details as style  
- Dockerfile / CI configuration (unless evidence shows a broader engineering contract issue)  
- Security/secrets/CVE hunting (use domain adversaries)  
- Exhaustive testing technique lectures  

Mention those areas only when the evidence establishes a **broader engineering** concern.
