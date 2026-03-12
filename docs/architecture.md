# Architecture

## Layers

### 1. Gateway Layer

This layer is responsible for talking to real model infrastructure.

Examples:

- LiteLLM
- Portkey Gateway
- any OpenAI-compatible internal proxy

Responsibilities:

- provider transport
- retries and fallback at the gateway level
- auth pass-through or gateway auth
- unified OpenAI-compatible endpoint

### 2. Policy Router Layer

This layer is the main product surface of this repository.

Responsibilities:

- map a business capability to a model track
- pick a provider chain
- apply same-track fallback
- apply cross-track escalation or degradation
- preserve app-facing semantics such as `generation.longform`

### 3. App SDK Layer

This layer should stay thin.

Responsibilities:

- app-specific helpers
- structured output helpers
- prompt conventions
- error shaping

## Non-goals for v1

- full provider feature flattening
- direct support for every provider-specific parameter
- replacing LiteLLM or Portkey feature-for-feature

## v1 Scope

- chat completions
- embeddings
- capability routing
- free and paid tracks
- fallback and escalation
- pluggable gateway adapters
