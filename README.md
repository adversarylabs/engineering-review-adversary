# Engineering Review

Engineering Review is a first-party, language-agnostic adversary that asks:

> Would an experienced software engineer approve this implementation?

It reviews correctness, completeness, maintainability, readability, architecture, operational risk, and whether changed behavior appears adequately validated. It deliberately does not replace language, framework, infrastructure, security, observability, or detailed testing adversaries.

The adversary is LLM-first. It prepares a bounded set of source evidence, asks for no more than four high-confidence engineering observations, and hands structured observations to the SDK for synthesis and presentation.

## Development

```sh
npm ci
npm test
adversary validate .
adversary pack --check .
```

Model-backed execution is configured by the adversary CLI. The adversary itself does not read provider API tokens.

See [the review philosophy](docs/review-philosophy.md) for its authority and review voice.
