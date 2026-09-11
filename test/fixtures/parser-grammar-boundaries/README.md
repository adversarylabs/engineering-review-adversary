# parser-grammar-boundaries

Vulnerable: a grammar defines a width token as [1-9][0-9]*, while a new caller accepts [0-9] and delegates to a shared decimal parser; the helper accepts 07 and no later validation rejects it. Numeric value 7 cannot prove spelling 07 was valid.
Clean: a protocol explicitly permits leading zeros; or the caller rejects zero before delegating; or the parent parser rejects remaining invalid syntax before any result is used. Do not universalize one grammar or infer a rule from a helper name.

These are review-policy calibration cases, not a measured model-recall claim.
