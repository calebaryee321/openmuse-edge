# OpenMuse Edge — project plan

## Product goal

Build a private, local-first Android personal agent for Pixel that can observe allowed phone events, understand them on-device, maintain encrypted personal memory, and take approved actions through tightly scoped tools.

The app is an extension/fork of OpenMuse, not a Termux-hosted copy of the existing Node stack.

## Non-negotiable principles

1. **Local inference by default.** Private event text is processed by on-device models unless the user explicitly invokes a cloud fallback.
2. **Least privilege.** Every data source and action has an explicit permission and policy.
3. **Event-driven, not surveillance-loop driven.** Use Android callbacks + scheduled work; do not continuously screenshot or poll the UI.
4. **No accessibility-service abuse.** Start with official Android/Google APIs and notification access.
5. **Human approval for consequential writes.** Sending mail, destructive file operations, calendar writes, sharing data, and similar actions remain reviewable.
6. **Models are replaceable.** The orchestration layer depends on capabilities, not one hardcoded model.
7. **Battery/thermal state is a first-class routing input.** Background intelligence must degrade gracefully.

## Target hardware

Primary test target: **Pixel 10 / Tensor G5 / 12 GB RAM**.

## Agent team

### Scout — Qwen3.5 0.8B

Role: inexpensive event triage.

Inputs:
- notifications
- lightweight mail metadata/snippets
- calendar deltas
- device events

Outputs strict JSON:
- importance
- action required
- memory worthiness
- entities
- urgency
- category
- whether Muse should be woken

Scout never executes tools.

### Muse — Gemma 4 E2B

Role: primary orchestrator and conversational assistant.

Responsibilities:
- synthesize relevant local memory
- decide what the user should know
- choose tools through the central tool broker
- create plans
- request approval for consequential actions
- decide whether to consult Sage

Preferred Pixel artifact: Tensor G5-compiled Gemma 4 E2B LiteRT-LM bundle.

### Sage — Qwen3.5 4B Mixed INT4

Role: difficult local reasoning / second opinion / critique.

Invoked only when:
- ambiguity is high
- evidence conflicts
- task requires multi-source synthesis
- Muse confidence is below threshold
- user explicitly selects Deep Local

Sage returns structured analysis to Muse and does not directly execute external tools.

### Shared memory model — EmbeddingGemma 300M

Role: semantic indexing and retrieval. Not a conversational agent.

## High-level architecture

```
Android event sources
      |
      v
Event normalizer ---> encrypted event store
      |
      v
Scout (Qwen 0.8B)
      |
      +--- low value ---> compact/archive
      |
      v
Muse (Gemma E2B) <---- semantic memory ---- EmbeddingGemma
      |
      +--- hard task ---> Sage (Qwen 4B) ---> Muse
      |
      v
Permission / policy broker
      |
      +--> Gmail read/draft
      +--> Calendar read/write
      +--> local notifications
      +--> files / contacts (later)
      +--> optional OpenMuse remote browser/server tools
```

## Delivery phases

### Phase 0 — repo baseline and architecture [IN PROGRESS]

- [x] Assess OpenMuse client/server boundary.
- [x] Select local model ensemble.
- [x] Confirm LiteRT-LM Kotlin support and Android hardware acceleration path.
- [x] Define agent roles and central tool broker.
- [x] Create bootstrap code + resource manifest.
- [x] Fork OpenMuse into user GitHub and create feature branch.
- [ ] Apply bootstrap overlay and open first draft PR.

Exit criterion: repo exists in user account with additive scaffold and green TypeScript checks.

### Phase 1 — native local inference vertical slice

- [ ] Generate/finish Expo local module `OpenMuseEdge`.
- [ ] Add LiteRT-LM Android dependency.
- [ ] Implement `loadModel`, `unloadModel`, `generate`, `streamGenerate`, and runtime stats.
- [ ] Load Gemma 4 E2B from app-private storage.
- [ ] Prefer Tensor G5/NPU-compatible artifact; provide GPU fallback.
- [ ] Create a simple Device AI diagnostics screen.
- [ ] Benchmark load time, TTFT, decode rate, RSS, temperature and battery.

Exit criterion: physical Pixel can chat with Gemma fully offline inside OpenMuse.

### Phase 2 — ensemble orchestration

- [x] Implement deterministic TypeScript routing policy scaffold.
- [x] Define strict Scout/Sage structured contracts.
- [ ] Wire Scout Qwen 0.8B runtime.
- [ ] Wire Sage Qwen 4B runtime.
- [ ] Add model residency manager (one or two engines resident depending on memory/thermal state).
- [ ] Add confidence escalation and Muse↔Sage critique loop.
- [ ] Add structured-output validation + retries.

Exit criterion: a synthetic event suite demonstrates Scout → Muse → Sage escalation correctly.

### Phase 3 — notification intelligence

- [ ] Add `NotificationListenerService` with explicit user-granted access.
- [ ] Normalize notification payloads into an internal event schema.
- [ ] Redact configured sensitive apps before LLM processing.
- [ ] Queue inference rather than doing long work in listener callbacks.
- [ ] Use WorkManager for durable deferred analysis.
- [ ] Add per-app policies: ignore / metadata only / analyze / retain.
- [ ] Build daily and morning briefings.

Exit criterion: overnight notifications can be triaged locally into an actionable briefing.

### Phase 4 — local encrypted memory

- [ ] Add Room schema for events, entities, commitments, projects, summaries and provenance.
- [ ] Encrypt at rest using Android Keystore-backed database keying.
- [ ] Integrate EmbeddingGemma for local semantic vectors.
- [ ] Implement retrieval with provenance to original local events.
- [ ] Add retention controls (30d/90d/forever/per-source).
- [ ] Add "What do you know about X?" and delete/export controls.

Exit criterion: Muse can answer project/person history using only local memory with traceable sources.

### Phase 5 — Gmail

Two-layer strategy:

1. **Immediate local signal:** Gmail notifications through NotificationListenerService.
2. **Full thread retrieval:** Google OAuth + Gmail API when a notification/event needs more context or the user searches mail.

- [ ] Add Google Identity/OAuth on device.
- [ ] Start read-only scopes.
- [ ] Search/read threads and attachments on demand.
- [ ] Keep retrieved content on device for inference.
- [ ] Add draft generation.
- [ ] Require explicit approval before send.

Exit criterion: "summarize emails that need me today" works locally; no third-party LLM receives message bodies.

### Phase 6 — calendar + contacts + files

- [ ] Local Android Calendar Provider read integration where appropriate.
- [ ] Optional Google Calendar API for cloud calendar fidelity.
- [ ] Contacts read access behind opt-in permission.
- [ ] SAF-based selected-file access.
- [ ] Meeting briefing workflow: calendar → related mail → memory → concise prep.

### Phase 7 — optional remote capabilities

Keep selected OpenMuse server capabilities as explicit optional tools:

- browser automation
- public web research
- remote Linux workspace
- cloud-model fallback

Remote calls must declare what context is leaving the device before sensitive data is sent.

### Phase 8 — production hardening

- [ ] Threat model and data-flow audit.
- [ ] Prompt-injection boundaries around email/web content.
- [ ] Tool argument allowlists and approval gates.
- [ ] Crash-safe model lifecycle.
- [ ] battery/thermal regression tests.
- [ ] offline-first QA.
- [ ] signed APK/AAB pipeline.
- [ ] model license/attribution screen.

## Routing policy v0

- Notification/event ingestion starts with Scout unless the source is configured metadata-only.
- Scout importance >= 0.72 OR `actionRequired=true` wakes Muse.
- Muse may answer directly or request Sage.
- Sage is forced for `risk=high`, conflicting evidence, or complexity >= 0.82.
- Consequential tools always pass through the permission broker independent of model confidence.

These thresholds are initial hypotheses and must be tuned from real event logs.

## Battery / thermal policy v0

- Thermal NORMAL: Scout background allowed; Muse on important events; Sage only when requested/escalated.
- Thermal WARM: batch Scout events; do not preload Sage.
- Thermal HOT/SEVERE: store events, defer generative inference, surface only deterministic urgent notifications.
- Battery saver: Scout only for allowlisted high-value sources; defer embeddings and Sage.
- Charging + idle: backfill embeddings, compact memory, generate daily summaries.

## Security boundaries

- Model output is untrusted data until parsed and validated.
- Email/web content is untrusted instructions; never allow it to override system/tool policy.
- Models do not hold OAuth refresh tokens; platform secure storage does.
- Tool calls are capability-scoped and logged locally.
- Sensitive-app exclusion is evaluated before event text reaches a model.

## First engineering milestone

**M1: Offline Muse on Pixel**

Ship a development APK where OpenMuse can:

1. detect installed/downloaded Gemma model,
2. initialize LiteRT-LM,
3. run an offline prompt,
4. stream tokens into the existing chat surface,
5. report runtime/backend stats,
6. unload cleanly.

Do this before adding notification monitoring so inference performance is known first.
