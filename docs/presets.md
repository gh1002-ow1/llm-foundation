# Presets

## `auto-media-balanced`

A reusable preset based on the earlier capability-aware `auto-media` routing design.

Intended shape:

- generation and embeddings use paid models
- translation and light scoring prefer free models
- free track can escalate to paid

Files:

- `configs/presets/auto-media-balanced/capabilities.json`
- `configs/presets/auto-media-balanced/policies.json`
- `configs/presets/auto-media-balanced/providers.json`

## `auto-media-paid-default`

A reusable preset based on the more conservative paid-only production profile found in the current `auto-media` config.

Intended shape:

- all business capabilities default to paid
- provider ordering favors Baidu coding plan and Aliyun coding endpoints
- useful when consistency is more important than cost

Files:

- `configs/presets/auto-media-paid-default/capabilities.json`
- `configs/presets/auto-media-paid-default/policies.json`
- `configs/presets/auto-media-paid-default/providers.json`

## Notes

- these presets are sanitized and use `apiKeyEnv` instead of hardcoded secrets
- they are not direct copies of the source repo files
- the local import script can generate a machine-specific preview from a real `auto-media` checkout
