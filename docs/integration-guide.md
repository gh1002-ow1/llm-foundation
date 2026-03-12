# Integration Guide

## Goal

Keep application code focused on business capabilities, not provider-selection logic.

## Recommended application flow

1. Create or load a config directory.
2. Choose a gateway adapter.
3. Construct a router from config.
4. Call `router.execute(capability, request)` from business code.

## Minimal Node integration

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

async function executeCapability(capability, messages) {
  return router.execute(capability, { messages });
}
```

## Suggested project structure

```text
your-app/
  src/
    llm/
      router.js
      capabilities.js
  llm-config/
    capabilities.json
    policies.json
    providers.json
    .env.local
```

## Integration patterns

### API server

Use the router inside request handlers that need model execution.

Typical examples:

- `/translate`
- `/summarize`
- `/generate-outline`

### Background worker

Use the router for offline or queued jobs.

Typical examples:

- content enrichment
- transcript translation
- title rewriting

### Shared internal package

Wrap the router in your own app-facing helper package when multiple repos need the same capabilities and prompts.

## Operational tips

- keep provider keys in `.env.local` or your secret manager
- use `simulate` when changing routing rules
- use `doctor` before integration tests or local live tests
- keep capability names business-oriented and stable
- let provider ordering live in config, not in application code
