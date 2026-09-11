# Miss-derived application contract calibration

Review polarity only when comments, constants, tests, sibling branches, or prior
behavior establish the truth table. A changed negation that routes a category to
the opposite UI or billing behavior is reportable; an unfamiliar boolean name
without contract evidence is quiet. A serializer update reading `detector_type`
for a declared and validated `type` field is reportable; a documented alias is
quiet.

Report two independent controls that both write the same URL or storage key when
source proves changing one reinterprets the other. Shared state by design and
mutually exclusive views are quiet.

Report an alternate success path that leaves `loading` true when the rendered
control remains disabled by that flag. Navigation that unmounts the control, a
shared `finally`, or an intentionally terminal success state is quiet.

Report representation drift only with an established contract: a generated
case-insensitive identifier must be canonicalized on comparison, and a display
must use the proven user locale. Opaque secrets, machine formats, fixed-locale
requirements, and values normalized before every boundary are quiet.

Report an empty persistence update used solely to refresh an automatic timestamp
only when repository or schema evidence proves the ORM skips that update and a
consumer treats the timestamp as freshness. Documented touch semantics and
explicit timestamp assignment are quiet.

Report a generic exception from an authentication or authorization branch only
when the router's established typed error protocol proves the generic exception
becomes the wrong client-visible response. Equivalent middleware translation is
quiet.
