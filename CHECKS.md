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


### Completeness / contract alignment

| | |
| --- | --- |
| **What** | Change claims to align a weak path with a stronger sibling but leaves the shared contract incomplete |
| **Examples** | Accepting `ctx` but coercing nil to `Background`/`TODO`; fixing one HTTP path and leaving its twin half-done; adding parameters without threading call sites; calling OpenForRead (or equivalent) on a snapshot/WAL/state without first determining the latest valid snapshot |
| **Stays quiet when** | Contract is complete or the gap is outside the changed neighborhood |

### Maintainability & architecture

| | |
| --- | --- |
| **What** | Boundaries, abstraction, duplication, or coupling create material future cost. Includes overly broad exception handling scopes that can swallow unrelated errors. |
| **Examples** | Overly broad try blocks around multiple statements when only one operation (e.g. an append) can raise the caught exception |
| **Stays quiet when** | Complexity is proportionate to the problem; try blocks are narrowly scoped to only the failing operations |

### Operational risk

| | |
| --- | --- |
| **What** | Blast radius, hidden behavior, rollout, or rollback makes the change unsafe |
| **Stays quiet when** | Risk is acknowledged and controlled |

### Validation gaps

| | |
| --- | --- |
| **What** | Important changed behavior lacks adequate validation evidence |
| **Stays quiet when** | Behavior is covered or the platform contract already provides the check |
| **Note** | Does not demand tests generically — names the behavior that is unproven |

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
