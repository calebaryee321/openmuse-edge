# Edge architecture decisions

## ADR-001: Keep OpenMuse UI, make server optional

OpenMuse already has a shared React Native/Expo Android client. We retain the UI and AG-UI concepts, but introduce a local Android agent runtime. The current remote server remains available for features that inherently need remote infrastructure.

## ADR-002: Gemma is the only direct tool-calling model in v0

LiteRT-LM exposes a Kotlin tool API and can automatically execute model-emitted tool calls. However, the current LiteRT community Qwen3.5 mobile bundles we selected ship simplified templates that do not include tool-calling sections. Therefore:

- Muse/Gemma: may propose tool calls.
- Scout/Qwen 0.8B: structured classifier only.
- Sage/Qwen 4B: structured analyst/critic only.
- Central broker validates and executes all tools.

This can be revisited if Qwen LiteRT bundles gain reliable tool templates.

## ADR-003: Event-driven monitoring

Use Android callbacks and persistent work scheduling rather than a permanent inference loop.

Notification flow:

```
NotificationListenerService
        |
        v
minimal extraction / source policy
        |
        v
append encrypted event
        |
        v
schedule EventAnalysisWorker
        |
        v
Scout -> Muse (if needed) -> memory / notification
```

Long model initialization/inference must never block notification callbacks.

## ADR-004: Model files are runtime assets

Model files are multi-GB artifacts and may have click-through license requirements. They live in app-private/device storage, not the APK Git history.

A ModelManager owns:

- catalog metadata
- license state
- resumable downloads
- SHA verification
- installed versions
- accelerator preference
- load/unload lifecycle
- disk quota

## ADR-005: Central tool broker

Every action is expressed as a typed request:

```
ToolRequest {
  tool
  args
  requestedBy
  reason
  sensitivity
  approvalMode
}
```

The broker evaluates:

1. Is this tool enabled?
2. Does Android/Google permission exist?
3. Does user policy allow this source/action?
4. Does it require interactive approval?
5. Is the request schema valid?

Only then does an adapter run.

## ADR-006: Separate event memory from semantic memory

Structured facts remain queryable without an LLM.

- Room tables: events, entities, source records, commitments, tasks, summaries, tool receipts.
- Embeddings: derived index for semantic recall.
- Original data provenance: every derived memory points to source IDs.

## ADR-007: No default AccessibilityService

The product is not built around scraping arbitrary screen content. If a future accessibility feature is developed, it must have a legitimate accessibility use case and a separate security review.
