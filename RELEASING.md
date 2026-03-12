# Releasing

## Release stance

This repository is versioned as a `1.x` open-source project for self-hosted and embedded use.

If publishing packages publicly, confirm:

- final GitHub repository URL
- package visibility and npm scope
- publish settings for each workspace package

## Release checklist

1. Run `npm test`
2. Run `npm run example:node`
3. Run `npm run gateway:portkey:dev` in one terminal
4. Run `PORTKEY_BASE_URL=http://127.0.0.1:8787/v1 npm run example:node:live`
5. Run `PORTKEY_BASE_URL=http://127.0.0.1:8787/v1 npm run smoke:live` in a trusted local environment
6. Update `CHANGELOG.md`
7. Tag the release commit
