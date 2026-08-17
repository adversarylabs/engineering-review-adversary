# Engineering Review adversary

Reviews proposed changes with Staff-level engineering judgment across languages.

## Goals

The adversary is designed to produce a small number of high-confidence,
actionable findings grounded in concrete repository evidence. Its review should
be deterministic where possible, explicit about impact, and quiet when the
available evidence does not justify a finding.

## Scope

It evaluates proposed changes across languages for correctness, completeness, maintainability, architecture, operational risk, and validation quality.

The complete detector or review inventory is maintained in
[CHECKS.md](CHECKS.md).

## Boundaries

It owns cross-language engineering judgment, while language mechanics, framework rules, security, infrastructure, pure style, and specialist test design remain with domain adversaries.
