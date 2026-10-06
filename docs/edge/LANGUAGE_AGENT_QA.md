# OpenMuse Language Agent — QA Report

Status: Active
Updated: 2026-10-06

## Scope

This report covers:
- language-agent orchestration
- learner profile persistence/migration
- recurring error detection
- spaced review
- mission selection
- Scout/Muse/Sage delegation policy
- Android build compatibility

## Verification levels

- **Unit verified**: deterministic logic executed in Node tests.
- **Type/build verified**: TypeScript/native Android build succeeds.
- **Emulator verified**: installed standalone APK launches and survives smoke QA.
- **Pixel required**: behavior depends on Tensor G5/NPU, thermal state, real model files, microphone, or app-update persistence.

## Findings addressed

### 1. Model download vs runtime state
Fixed before language-agent work.
Downloaded model files are preserved when LiteRT initialization fails.

### 2. Android LiteRT model path
Fixed before language-agent work.
React Native file URIs are normalized to filesystem paths before EngineConfig.

### 3. Single-engine agent swaps
Risk: blindly invoking Scout → Sage → Muse every turn causes avoidable engine initialization latency.

Mitigation implemented:
- Scout selective evaluation policy
- Sage deep-help policy
- Muse remains mandatory teaching worker
- specialist absence is non-blocking

Still Pixel-required:
- cold/warm model init timing
- Scout→Muse swap latency
- Sage→Muse swap latency
- thermal/battery cost

### 4. One-off mistakes becoming permanent weaknesses
Mitigation implemented:
- normalized error keys
- evidence stored by turn
- duplicate evidence in one turn counted once
- recurring threshold requires >=3 observations across >=2 turns

### 5. Malformed Scout structured output
Mitigation implemented:
- bounded JSON extraction
- missing/malformed JSON returns undefined
- string arrays trimmed/bounded
- confidence clamped to 0..1
- evaluator failure never blocks Muse

### 6. Old learner profile compatibility
Mitigation implemented:
- profile schema v2
- migration from legacy profile fields
- nested skill-band defaults
- malformed/missing arrays replaced safely

### 7. Mission start React state race
Fixed.
First mission turn receives the selected mission directly instead of relying on asynchronous state update.

## Unit test matrix

- one-off mistake remains observed
- recurrence at threshold
- duplicate evidence not double counted
- error-key normalization
- review Again/Good/Easy ordering
- due-review deterministic sorting
- skill band bounds
- Scout selective delegation
- Sage explanation trigger
- mission progression
- AAR success thresholds
- malformed evaluator output
- evaluator confidence clamp
- legacy profile migration
- session boundary logic

## Integration QA still required

### Local agent execution
- Muse-only turn
- Scout→Muse evaluated turn
- Sage→Muse deep explanation
- missing Scout
- missing Sage
- Scout load failure
- Sage load failure
- Muse load failure
- model swap recovery after inference error

### Persistence
- app process kill
- app restart
- APK update over existing install
- existing 3+ GB model remains present
- learner profile remains present
- corrupted profile JSON recovers without app crash

### Long-session
- 10 turns
- 30 turns
- profile remains bounded
- review queue <=120
- error evidence <=8 per pattern
- UI does not progressively slow
- no unbounded native memory growth

## Pixel hardware QA

Required on target Pixel:
- NPU Muse initialization
- fallback order NPU→GPU→CPU
- real tokens/sec
- first useful response latency
- Scout→Muse swap latency
- Sage→Muse swap latency
- peak RSS
- battery delta
- thermal state after 30-turn session
- screen-off/resume behavior
- update-in-place preserves models

## Learning behavior QA

Synthetic learner scripts should test:
1. three repeated article mistakes => recurring weakness
2. one typo => no weakness
3. repeated correct use after weakness => improving (next implementation)
4. vocabulary extracted => review queue
5. due review appears on schedule
6. mission criteria drive AAR result
7. cultural/naturalness feedback remains separate from grammar

## Current release gate

Language Agent APK is eligible for user testing only when:
- Edge/type checks pass
- language-agent unit tests pass
- standalone APK builds
- artifact is collected
- emulator launch has no OpenMuse fatal crash

Pixel inference is a separate hardware validation gate.
