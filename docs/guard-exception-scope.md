# Guard exceptions must preserve the remaining contract

Review the contract and reachable behavior, not the presence or absence of a particular helper call. An old guard is evidence of implementation, not by itself proof that the protection must remain.

## Positive calibration example

A package store explicitly promises that release references cannot be rebound to different content, while moving aliases may advance. Previously `import(reference, content)` rejected conflicting bindings. A change installs content with an empty reference, then unconditionally calls `updateReference(reference, content)` so moving aliases can advance. Both moving aliases and release references reach that path, and the update permits replacing the existing binding.

Report one contract regression: the exception for moving aliases also removes the protection for release references. Cite the immutable-reference contract, the skipped conflict check, and the unguarded update. Recommend classifying the reference under the established policy and preserving the conflict check for protected references. A version-shaped string alone does not prove immutability.

## Clean counterexamples

- The bypass is conditional on an explicitly mutable alias; protected references retain the existing conflict check.
- The import is split into two operations, but reference registration enforces the same immutability contract before rebinding anything.
- The repository explicitly permits all tags, including version-shaped tags, to move. No immutable-tag policy should be invented.
- An explicit replacement operation is authorized by the governing contract and checks that authorization before changing the binding.
- The original contract is intentionally migrated for every affected category, with the supported callers updated consistently. The old guard alone is not a reason to reject the change.
- Only the moving-alias path is prepared; no protected caller or input category is shown to reach the bypass. Request sufficient evidence rather than reporting a hypothetical regression.

The same reasoning applies to ordinary validation, compatibility, and overwrite contracts. Detailed authentication or language mechanics remain specialist concerns. These examples calibrate the rule; they are not a measurement of model recall. No benchmark-specific identifiers enter the runtime prompt.
