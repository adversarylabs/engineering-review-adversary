# Engineering Review

Engineering Review is a first-party, language-agnostic adversary that asks:

> Would an experienced software engineer approve this implementation?

It reviews correctness, completeness, maintainability, readability, architecture, operational risk, and whether changed behavior appears adequately validated. It deliberately does not replace language, framework, infrastructure, security, observability, or detailed testing adversaries.

The adversary is LLM-first. It gives the model a bounded, read-only view of the
repository through the SDK, asks for no more than four high-confidence
engineering observations, and hands those structured observations to the SDK
for synthesis and presentation.

Repository content is retrieved on demand rather than copied into one large
prompt. The SDK lets the model page through directory listings and read bounded
line ranges from relevant files. Every successful file read creates an
immutable citation ID, and Engineering Review accepts findings only when their
citation ID and line number resolve to content the model actually read. Tool
rounds, calls, bytes, and lines are capped, and source paths are constrained to
the review root.

## Development

```sh
npm ci
npm test
adversary validate .
adversary pack --check .
```

Model-backed execution is configured by the adversary CLI. The adversary itself does not read provider API tokens.

See [the review philosophy](docs/review-philosophy.md) for its authority and review voice.

## Project

Source is available in the [Engineering Review repository](https://github.com/adversarylabs/engineering-review-adversary). Engineering Review is licensed under the [MIT License](LICENSE).
