# Releasing

## Before first public release

- replace the placeholder GitHub repository URL in `package.json`
- decide package visibility and npm scope
- add package publish settings for each workspace package
- add versioning policy
- confirm naming for the public npm scope

## Release checklist

1. Run `npm test`
2. Run `npm run example:node`
3. Run `npm run smoke:live` in a trusted local environment
4. Update `CHANGELOG.md`
5. Tag the release commit
