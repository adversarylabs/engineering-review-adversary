# Events must not falsely announce completed state changes

## Positive calibration example

A recurring-reservation handler builds audit data declaring `pending -> accepted` and awaits an external queue publication. Only afterward does it start the authoritative updates. A database error can leave the queued acceptance record visible even though a reservation remains pending. An early observer can likewise see a completed-transition event before the state transition. The review should cite the event payload's completed-state meaning, the queue dispatch, and the later fallible updates as one ordering defect.

Follow the helper to its actual dispatch boundary: building an event object or calling a method named `publish` does not alone prove observability. For multiple updates, identify which transitions have actually committed; do not assume the batch is atomic.

## Clean counterexamples

- The event means `acceptance requested`, and consumers treat it as intent rather than proof of completion.
- The state change and an outbox entry share a transaction, and dispatch occurs only after commit.
- A callback only registers an after-commit hook; no completion event can escape a rollback.
- Publication follows successful completion of the required state changes.
- The established protocol explicitly marks the event provisional and consumers wait for confirmation before acting on it as completed.
- Prepared source shows only event construction or an unresolved helper, not actual publication or consumer observability.

Recommend ordering or an existing atomic publication mechanism appropriate to the delivery contract. Moving publication after an update prevents this false-completion path but does not alone prevent lost events if the process crashes between commit and dispatch. Avoid demanding an outbox for every notification or inventing transactional delivery requirements.

These are language-neutral calibration examples, not measured model recall. The runtime prompt contains no benchmark-specific identifiers.
