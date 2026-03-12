# Security Policy

## Supported versions

The current supported release line is:

- `1.x`

## Reporting a vulnerability

Do not open a public issue for suspected credential leakage or a security vulnerability.

Instead:

1. prepare a minimal reproduction
2. include affected files or endpoints
3. include impact and suggested mitigation if known
4. send the report through the private maintainer channel used by this repository

Until a dedicated security contact is published, treat direct maintainer contact as the default path.

## Sensitive data guidance

- never commit real API keys
- keep secrets in `.env.local` or an external secret manager
- use `apiKeyEnv` in tracked config files
- do not paste machine-local credential files into issues or pull requests

## Local development

This repository includes local live workflows. Before sharing logs or examples:

- remove tokens from command history
- redact provider keys from JSON output
- avoid committing `.local/` artifacts
