# llm-foundation

An application-facing LLM policy router with pluggable gateway backends.

## Why this exists

Most teams do not need to rewrite provider wiring for every project.

They need:

- one reusable LLM entrypoint
- capability-based routing
- free vs paid policy
- fallback and escalation rules
- gateway portability across LiteLLM, Portkey, or other OpenAI-compatible backends

This repository starts with three layers:

1. `packages/policy-router`
2. `packages/gateway-adapter-portkey`
3. `packages/gateway-adapter-litellm`

It also includes:

- config examples under `configs/`
- a starter example under `examples/node-basic`
- a JSON schema package under `packages/config-schema`

## Quick start

```bash
git clone https://github.com/your-org/llm-foundation.git
cd llm-foundation
npm test
npm run example:node
```

To run the example against a live local gateway:

```bash
PORTKEY_BASE_URL=http://127.0.0.1:8787/v1 \
LLM_FOUNDATION_CONFIG_DIR=./examples/node-basic/config \
npm run example:node:live
```

To run a local live smoke test using provider keys discovered from local config files such as
`~/.openclaw/openclaw.json` and `auto-media/config/api-keys.json`:

```bash
PORTKEY_BASE_URL=http://127.0.0.1:8787/v1 \
npm run smoke:live
```

This script reads local credentials at runtime and does not store them in the repository.

## Repository layout

```text
packages/
  policy-router/
  gateway-adapter-portkey/
  gateway-adapter-litellm/
  config-schema/
examples/
  node-basic/
configs/
docs/
```

## Current public API

The core package exports:

- `createPolicyRouter(options)`
- `createPolicyRouterFromConfig(options)`
- `loadRouterConfig(options)`
- `validateRouterConfig(config)`

The intended app-facing pattern is:

1. load config from files
2. choose a gateway adapter
3. inject the adapter via `invoke`
4. call `router.execute(capability, request)`

## Development status

This repository is in early standalone-project shape.

It is intentionally focused on:

- capability routing
- free and paid tracks
- same-track fallback
- cross-track escalation or degradation
- gateway portability

It is not trying to replace LiteLLM or Portkey feature-for-feature.

## Project docs

- `docs/architecture.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `RELEASING.md`

## Current shape

- `policy-router` owns capability and track selection
- gateway adapters own request execution
- app code should only talk to the policy router

See `docs/architecture.md` for the intended direction.
