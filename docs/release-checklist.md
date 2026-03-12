# Release Checklist

## Before publishing the repository

1. Confirm the final Git remote and public repository name.
2. Add real `repository`, `homepage`, and `bugs` metadata to the root `package.json`.
3. Confirm whether workspace packages will remain source-only or be published to npm.
4. Run a final secret scan over git history.
5. Confirm the maintainer contact path referenced by `SECURITY.md`.

## Technical verification

Run these commands from the repository root:

```bash
npm test
npm run example:node
npm run cli -- init --dir ./llm-config --preset auto-media-balanced --yes \
  --free-providers openrouter-free-router \
  --paid-providers aliyuncs-qwen35-plus
npm run doctor -- --config-dir ./llm-config --skip-probe
npm run cli -- simulate --config-dir ./llm-config --capability localization.translate
```

Optional live verification:

Terminal 1:

```bash
npm run gateway:portkey:dev
```

Terminal 2:

```bash
PORTKEY_BASE_URL=http://127.0.0.1:8787/v1 \
LLM_FOUNDATION_CONFIG_DIR=./llm-config \
npm run example:node:live
```

## Release assets

Prepare:

- repository description
- topic tags
- first release notes
- a short architecture diagram or request flow diagram
- one usage example for the README or project homepage

## Suggested release tag

```bash
git tag v1.0.0
```
