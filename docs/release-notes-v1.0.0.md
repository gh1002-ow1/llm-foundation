# llm-foundation v1.0.0

First public open-source release.

## What this project does

`llm-foundation` provides a capability-based LLM routing layer for application teams. It keeps business-facing code stable while routing requests across providers, tracks, and gateways through configuration.

## Included in 1.0.0

- `@llm-foundation/policy-router`
- Portkey gateway adapter
- LiteLLM gateway adapter
- config schema package
- CLI workflows for `init`, `validate`, `simulate`, and `doctor`
- sanitized presets derived from earlier `auto-media` routing strategy
- local Portkey-compatible development gateway for live validation
- Node example and local smoke workflow

## Good fits

- multiple apps sharing one LLM policy layer
- free-first with paid fallback
- business capabilities such as translation, rewriting, and longform generation
- teams switching between Portkey, LiteLLM, and other OpenAI-compatible gateways

## Validation status

- automated test suite passing
- CLI setup and simulation paths verified
- local live gateway path verified

## Notes

- this project is intended as a reusable routing foundation, not a chat product
- the included development gateway is for local testing, not a production Portkey replacement
