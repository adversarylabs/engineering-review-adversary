# review/engineering

**review/engineering** is a language-agnostic, **LLM-first** Staff/Principal engineering review. It answers: *Would an experienced software engineer approve this implementation?*

It deliberately does **not** replace language, framework, infrastructure, security, observability, or detailed testing adversaries. Those stay with specialists. It reports zero to four high-confidence engineering observations with evidence.

## What it does

1. **Receives** a bounded, read-only view of the change via the SDK (not full freestyle repo dumps).
2. **Applies staff-level judgment** on correctness, completeness, maintainability, architecture, operational risk, and validation gaps.
3. **Emits at most four** medium-or-higher confidence observations with citations; silence is preferred over speculation.
4. **Hands structured observations** to the SDK for synthesis and presentation.

It never executes the scanned project as the product under review, never installs dependencies into it, and never needs network access to the target repository.

## What it detects

Every **shipped rule id**, severity, and short description lives in **[CHECKS.md](CHECKS.md)** — the audit surface for “what does this adversary look for?”

Highlights:

| Area | Examples |
| --- | --- |
| Completeness | Sibling paths half-aligned; nil-context coercion; unfinished contracts |
| Maintainability | Disproportionate abstraction; boundary violations; coupling |
| Correctness | Per-entity constraints incorrectly collapsed into a global gate |
| Operations | Blast radius, rollback difficulty, hidden behavior |
| Validation | Important changed behavior without adequate proof |
| Approval | Overall ship assessment (well-engineered → high operational risk) |

### Ownership boundaries

**Scope (train / factory):** [`agent/scope.md`](agent/scope.md).

Other packages own adjacent classes so findings stay non-duplicative:

| Concern | Owned by |
| --- | --- |
| Pure style / nits / rename taste | `review/nits` |
| Disproportionate complexity as the main story | `review/complexity` |
| Go concurrency / HTTP / DB / CLI / security / modules | the matching `go/*` domain adversaries |
| CI and Dockerfile supply chain | `ci/*` and `container/dockerfile` |
| Committed secrets | [`security/secrets`](https://github.com/adversarylabs/secrets-adversary) |
| Adversary package authoring quality | [`adversarylabs/adversary`](https://github.com/adversarylabs/adversary-adversary) |
| Whole-diff maintainer persona | persona packages (e.g. torvalds) |

## Precision stance

- Model-backed: every observation must cite prepared evidence (citation ids from read tools).
- Zero to four observations; no linter-style flood.
- Do not invent files, runtime behavior, or requirements.
- Nil-context coercion and incomplete contract alignment are in scope; framework nits are not.
