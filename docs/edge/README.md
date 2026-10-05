# OpenMuse Edge bootstrap

Working bootstrap for a local-first Android personal agent derived from OpenMuse.

This overlay intentionally does **not** vendor model weights. Models are downloaded to device storage at runtime and are excluded from Git.

## Working model team

- **Scout — Qwen3.5 0.8B**: fast event triage and structured classification.
- **Muse — Gemma 4 E2B**: primary orchestrator, user-facing assistant, and LiteRT-LM tool caller.
- **Sage — Qwen3.5 4B Mixed INT4**: difficult analysis / critique / planning, invoked on demand.
- **EmbeddingGemma 300M**: shared semantic-memory embedder (infrastructure, not a conversational agent).

The current Qwen3.5 LiteRT community exports are treated as structured-output specialists rather than direct tool callers. Muse owns external tool execution through a central permission broker.

## What is implemented in this bootstrap

- Project plan and phased backlog.
- Model/resource manifest and download helper.
- Pure TypeScript ensemble-routing core with lazy-load recommendations.
- Permission-aware tool policy.
- Expo local-module scaffold for a Kotlin LiteRT-LM bridge.
- Android service design for notification event ingestion.
- Unit-style routing checks that can run without model weights.

## Apply to OpenMuse

1. Use this repository fork of `CopilotKit/openmuse`.
2. Work on `feature/openmuse-edge-v0`.
3. Add the bootstrap paths incrementally while preserving upstream structure.
4. Merge package/workspace snippets documented in `PATCH_NOTES.md` rather than replacing upstream files wholesale.
5. Run typecheck/tests before enabling native builds.

See `docs/edge/PROJECT_PLAN.md` for the build sequence.
