# Contributing

## Development

Requirements:

- Node.js 20+
- npm 11+

Install and verify:

```bash
npm test
npm run example:node
```

Recommended local live loop:

```bash
npm run gateway:portkey:dev
PORTKEY_BASE_URL=http://127.0.0.1:8787/v1 npm run example:node:live
```

## Project rules

- keep gateway integrations behind adapter interfaces
- keep business-facing APIs capability-based
- do not hard-couple packages to a single provider or a single app repo
- prefer OpenAI-compatible transport at the gateway boundary

## Pull request expectations

- add or update tests for behavior changes
- keep README and config examples in sync with public API changes
- if adding a new gateway adapter, include one smoke-style unit test
- if changing routing or local live behavior, update `doctor`, examples, and related docs together
