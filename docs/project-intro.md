# Project Intro

## Chinese

### Short description

`llm-foundation` 是一个面向应用团队的 LLM 路由层，用配置驱动能力路由、免费/付费分层、fallback 策略，以及 Portkey / LiteLLM 等网关适配。

### One-paragraph introduction

`llm-foundation` 适合那些不想在每个项目里重复维护 provider 选择、模型切换和降级逻辑的团队。它把业务侧看到的接口稳定成 capability，例如 `localization.translate`、`generation.longform`，再由路由层根据配置决定应该走哪个 provider、哪个模型、哪个网关，以及失败后如何 fallback。它既可以作为共享基础模块嵌入多个项目，也可以配合本地开发网关做真实链路验证。

### Key points

- 面向业务能力，而不是面向某个单一模型
- 支持 free / paid track 和 fallback
- 支持 Portkey、LiteLLM 和 OpenAI-compatible 网关
- 附带 CLI，可做 init / doctor / simulate
- 适合作为多项目共用的 LLM 基础设施层

### Short release post

发布 `llm-foundation 1.0.0`。

这是一个面向应用团队的 capability-based LLM routing 项目，目标是把 provider 选择、fallback、免费/付费分层和 gateway 适配从业务代码里抽离出来。仓库内置了 `init` / `doctor` / `simulate` CLI，以及一个本地 Portkey-compatible dev gateway，方便直接验证真实调用链路。

适合：

- 多项目共享一套路由策略
- free-first / paid-fallback 模式
- 需要在 Portkey / LiteLLM / OpenAI-compatible 网关之间切换的团队

## English

### Short description

`llm-foundation` is a capability-based LLM routing layer for application teams, with config-driven routing, free vs paid tracks, fallback policy, and gateway adapters for Portkey, LiteLLM, and other OpenAI-compatible backends.

### One-paragraph introduction

`llm-foundation` is for teams that do not want provider selection, model switching, and fallback logic duplicated across every app or worker. It keeps the business-facing contract stable through capabilities such as `localization.translate` and `generation.longform`, while the router decides which provider, model, and gateway should handle the request and how fallback should behave. It can be embedded as a shared infrastructure module across multiple repositories, and it also includes a local development gateway for live-path validation.

### Key points

- capability-first instead of model-first
- free / paid track strategy with fallback
- Portkey, LiteLLM, and OpenAI-compatible gateway support
- built-in CLI for init / doctor / simulate
- useful as shared LLM infrastructure across multiple projects

### Short release post

Released `llm-foundation 1.0.0`.

It is a capability-based LLM routing project for application teams. The goal is to pull provider selection, fallback policy, free-vs-paid routing, and gateway adaptation out of business code. The repository includes `init`, `doctor`, and `simulate` CLI workflows, plus a local Portkey-compatible development gateway for validating real live request paths.

Good fits:

- one routing policy shared across multiple apps
- free-first with paid fallback
- teams switching between Portkey, LiteLLM, and other OpenAI-compatible gateways
