# Executable examples on supported configurations

Vulnerable: CI's supported target matrix compiles documentation examples with a single-thread runtime feature set. A changed runnable example selects a multithread runtime that the prepared library/configuration contract excludes on that target. Cite the actual example inclusion, target/feature matrix and required unavailable capability.

Clean: the example explicitly selects the supported single-thread runtime; the actual harness excludes it on that target under the documented support contract; or it is a non-executable illustrative block. Do not assume all documentation is executed or invent supported platforms.

Policy calibration only, not a measured model result. Original corpus stays external.
