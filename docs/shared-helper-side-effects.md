# Shared-helper side effects

A shared helper is not inherently a design problem. This check needs the changed effect, a reachable second caller, and evidence that the effect applies only to another caller or mode. It extends engineering boundary review without owning language or framework mechanics.

## Positive example

Both a validator and a renderer call `discoverInputs`. The change makes that helper emit warnings for unmatched validation-only exclusions. A renderer invocation now emits validation-policy warnings despite not applying those exclusions. The review should cite both caller paths and the warning’s validation-specific configuration, then recommend moving the warning to validation or gating it appropriately. Merely showing two callers is insufficient.

## Clean counterexamples

- The helper checks `mode == VALIDATE` before evaluating validation exclusions; the renderer supplies `RENDER`. The second caller cannot reach the warning.
- Both callers explicitly promise to report unreadable input paths, and the helper adds that common warning. Its effect belongs to the shared contract.
- The helper evaluates a predicate supplied by each caller; the renderer supplies rendering exclusions and the validator supplies validation exclusions. No policy leaks between callers.
- Only the validator is shown to call the helper. A possible future renderer is not evidence of a reachable regression.

These are review calibration examples, not evidence of measured model recall. No benchmark-specific identifiers or expected answers are included in the runtime rule.
