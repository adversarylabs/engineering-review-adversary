# Shared mutation during specialized loading

Vulnerable: a specialized route implementation loads in both development and production and patches the shared base helper module. Ordinary production routes share that module; a missing helper now triggers a development-only reload rather than their documented missing-route behavior. Cite the load path, shared module identity, patch and changed ordinary consumer behavior.

Clean: the subclass owns a distinct helper module; loading is proven restricted to the specialized mode; or the global change is intentional and valid for ordinary consumers. Lexical nesting alone neither proves isolation nor proves a leak. Do not guess the runtime load path from the file name.

Policy calibration only, not a measured model result. Original corpus stays external.
