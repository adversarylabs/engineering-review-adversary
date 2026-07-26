# Engineering Review adversary

## Purpose

This repository contains the language-agnostic Engineering Review adversary. It should behave like a Staff or Principal engineer reviewing a proposed change, not like a linter or a language specialist.

## Design principles

- Prefer a few important, high-confidence observations over broad coverage.
- Review correctness, completeness, maintainability, readability, architecture, risk, and whether validation appears adequate.
- Require concrete prepared source evidence for every concern.
- Synthesize related evidence into one engineering story and one remediation.
- Leave language mechanics, framework practices, security, observability, infrastructure configuration, and detailed test design to specialist adversaries.
- Use the model for engineering judgment and the SDK for finding synthesis, ranking, grouping, and opinion language.
- Never execute, install dependencies in, or modify the scanned repository.

## Testing

- Preserve the five named calibration fixtures and their expected review snapshots.
- Add clean counterexamples when sharpening a concern.
- Keep automatic detection and runtime artifact isolation tests passing.
- Run `npm test`, `adversary validate .`, and `adversary pack --check .`.
