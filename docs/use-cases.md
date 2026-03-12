# Use Cases

## 1. Shared LLM policy across multiple apps

Teams often have:

- a web app
- a background worker
- an internal admin tool

All three need LLM access, but they should not each decide:

- which provider to use
- when to escalate from free to paid
- how to order fallback providers

`llm-foundation` centralizes those decisions behind one config and one app-facing API.

## 2. Free-first routing with paid fallback

Many product capabilities are cheap enough to try on a lower-cost or free model first.

Typical examples:

- translation
- short rewriting
- tagging
- light classification

When a free provider fails or is unavailable, the router can escalate to a paid track without business-code changes.

## 3. Quality-first routing for premium capabilities

Some capabilities should always start on the paid track.

Typical examples:

- longform generation
- executive summaries
- structured extraction with high accuracy requirements

The capability policy can route these straight to the paid track while keeping the rest of the app on cheaper defaults.

## 4. Gateway portability

A team may want to:

- start on Portkey
- move some workloads to LiteLLM
- use an internal OpenAI-compatible proxy later

The router keeps the business-facing contract stable while gateway adapters change underneath.

## 5. Local integration testing

The built-in development gateway makes it possible to:

- validate real provider credentials locally
- test the Portkey adapter path without an external Portkey install
- run `doctor`, `example:node:live`, and `smoke:live` on one machine
