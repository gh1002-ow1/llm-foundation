# llm-foundation

Capability-based LLM routing for application teams.

`llm-foundation` gives projects one reusable LLM entrypoint with:

- capability-based routing
- free vs paid model tracks
- same-track fallback and cross-track escalation
- gateway portability across Portkey, LiteLLM, and other OpenAI-compatible backends
- local CLI workflows for config setup, validation, simulation, and live checks

It is designed for teams that do not want provider-selection logic scattered across every app, worker, and script.

## What this project is

This repository is a reusable routing layer, not a chat application.

Use it when you want:

- one shared LLM policy across multiple projects
- clean business-facing capability names such as `localization.translate`
- a place to encode cost, fallback, and provider ordering decisions
- a consistent integration surface while changing models or gateways underneath

This repository includes:

1. `@llm-foundation/policy-router`
2. `@llm-foundation/gateway-adapter-portkey`
3. `@llm-foundation/gateway-adapter-litellm`
4. `@llm-foundation/config-schema`
5. CLI workflows for `init`, `doctor`, `validate`, and `simulate`
6. a local Portkey-compatible dev gateway for live testing

## When to use it

Good fits:

- multi-project teams that want one LLM policy layer
- products with separate capabilities such as translation, rewriting, and longform generation
- stacks that want free-first routing with paid fallback
- teams migrating between gateways without changing business code

Less useful:

- a single script that always calls one model directly
- products that do not need routing, fallback, or policy control

## Quick start

Install and verify:

```bash
npm test
npm run example:node
```

Create a local config:

```bash
npm run cli -- init --dir ./llm-config --preset auto-media-balanced --yes \
  --free-providers openrouter-free-router \
  --paid-providers aliyuncs-qwen35-plus \
  --set-env OPENROUTER_API_KEY=your_openrouter_key \
  --set-env ALIYUNCS_API_KEY=your_aliyun_key
```

Check the config:

```bash
npm run doctor -- --config-dir ./llm-config --skip-probe
npm run cli -- simulate --config-dir ./llm-config --capability localization.translate
```

Run a local live path:

```bash
npm run gateway:portkey:dev
```

In another terminal:

```bash
PORTKEY_BASE_URL=http://127.0.0.1:8787/v1 \
LLM_FOUNDATION_CONFIG_DIR=./llm-config \
npm run example:node:live
```

## CLI workflows

Current commands:

```bash
npm run cli -- init
npm run cli -- init --dir ./llm-config --preset auto-media-balanced --yes
npm run cli -- validate --config-dir ./llm-config
npm run cli -- simulate --config-dir ./llm-config --capability localization.translate
npm run cli -- doctor --config-dir ./llm-config
npm run doctor -- --config-dir ./llm-config
npm run cli -- import-auto-media
npm run cli -- smoke-live
npm run gateway:portkey:dev
```

The `init` flow is interactive by default and writes:

- `capabilities.json`
- `policies.json`
- `providers.json`
- `.env.example`
- `.env.local`

For automation, `init` also supports:

- `--yes`
- per-track `--<track>-providers`
- repeated `--set-env KEY=value`

The `doctor` command checks:

- config validity
- per-provider readiness by gateway requirements
- missing provider env vars
- planned capability routes and fallback tracks
- local gateway reachability for `portkey` and `litellm`

For CI or offline checks:

```bash
npm run doctor -- --config-dir ./llm-config --skip-probe
```

## Example integration

This is the intended app-facing pattern:

1. load config from files
2. create the gateway invoke function
3. call the router by business capability

```js
const { createPolicyRouterFromConfig } = require('@llm-foundation/policy-router');
const { createPortkeyAdapter } = require('@llm-foundation/gateway-adapter-portkey');

const adapter = createPortkeyAdapter({
  baseUrl: process.env.PORTKEY_BASE_URL || 'http://127.0.0.1:8787/v1'
});

const router = createPolicyRouterFromConfig({
  configDir: './llm-config',
  invoke: async ({ candidate, request }) => adapter.chat(candidate, request)
});

async function translate(text) {
  return router.execute('localization.translate', {
    messages: [
      { role: 'system', content: 'Return JSON only.' },
      { role: 'user', content: `Translate to Chinese: ${text}` }
    ]
  });
}
```

Your app code only chooses the capability. The router decides the provider chain and fallback behavior.

## Practical scenarios

### 1. Product localization

Use `localization.translate` for UI strings, subtitles, or short content.

Typical policy:

- default to the `free` track
- escalate to `paid` when free providers fail

### 2. Longform generation

Use `generation.longform` for blog outlines, summaries, or analysis.

Typical policy:

- route directly to the `paid` track
- keep higher-quality providers first in the ordered list

### 3. Shared infra across multiple apps

Point multiple apps at the same config directory or shared config source.

Typical result:

- one place to adjust provider ordering
- one place to switch gateways
- no business-code changes when the model policy changes

## Configuration shape

Minimal example:

`providers.json`

```json
{
  "tracks": {
    "free": [
      {
        "name": "openrouter-free-router",
        "gateway": "portkey",
        "provider": "openai",
        "apiKeyEnv": "OPENROUTER_API_KEY",
        "customHost": "https://openrouter.ai/api/v1",
        "model": "openrouter/free"
      }
    ],
    "paid": [
      {
        "name": "aliyuncs-qwen35-plus",
        "gateway": "portkey",
        "provider": "openai",
        "apiKeyEnv": "ALIYUNCS_API_KEY",
        "customHost": "https://coding.dashscope.aliyuncs.com/v1",
        "model": "qwen3.5-plus"
      }
    ]
  }
}
```

`policies.json`

```json
{
  "defaults": {
    "track": "free",
    "fallbackTrackByTrack": {
      "free": "paid"
    }
  },
  "capabilities": {
    "localization.translate": {
      "track": "free"
    },
    "generation.longform": {
      "track": "paid"
    }
  }
}
```

`capabilities.json`

```json
{
  "localization.translate": {
    "description": "Translate content"
  },
  "generation.longform": {
    "description": "Generate long-form text"
  }
}
```

## Local live testing

The repository includes `npm run gateway:portkey:dev`, a small local Portkey-compatible development gateway.

It is intended for:

- local integration testing
- validating real provider credentials through the Portkey adapter
- exercising the default project path without a separate Portkey install

It is not intended to replace a production Portkey deployment.

## Public API

The core package exports:

- `createPolicyRouter(options)`
- `createPolicyRouterFromConfig(options)`
- `loadRouterConfig(options)`
- `validateRouterConfig(config)`

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
scripts/
```

## Version 1.0 scope

`llm-foundation` 1.0 focuses on:

- chat completions and embeddings
- capability routing
- ordered provider chains
- free and paid track strategy
- same-track fallback and cross-track escalation
- pluggable gateway adapters
- local CLI setup and verification

Non-goals for 1.0:

- full provider feature flattening
- provider-specific parameter parity across every vendor
- replacing Portkey or LiteLLM feature-for-feature
- a complete hosted control plane or Web UI

## Project docs

- `docs/architecture.md`
- `docs/presets.md`
- `docs/use-cases.md`
- `docs/integration-guide.md`
- `docs/release-checklist.md`
- `docs/project-intro.md`
- `docs/github-metadata.md`
- `docs/release-notes-v1.0.0.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `RELEASING.md`

## Release status

This repository is in `1.0.0` open-source release shape for self-hosted and embedded use.

Use it as:

- a shared LLM routing module inside application code
- a reusable policy layer across multiple repositories
- a local integration harness for gateway-backed LLM workflows
