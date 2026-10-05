# Resource manifest

## Upstream application

- OpenMuse: https://github.com/CopilotKit/openmuse
- Mobile client: `apps/mobile`
- Current architecture: Expo/React Native client + Hono/Node API + optional browser/computer workers.

## Google AI Edge

- LiteRT overview: https://developers.google.com/edge/litert
- LiteRT-LM repo: https://github.com/google-ai-edge/LiteRT-LM
- Kotlin guide: https://github.com/google-ai-edge/LiteRT-LM/blob/main/docs/api/kotlin/getting_started.md
- Google Tensor / Pixel SDK: https://developers.google.com/edge/litert/next/tensor-sdk
- LiteRT samples: https://github.com/google-ai-edge/litert-samples

## Android / Expo

- Expo local native modules: https://docs.expo.dev/modules/get-started/
- create-expo-module: https://docs.expo.dev/more/create-expo-module/
- NotificationListenerService: https://developer.android.com/reference/android/service/notification/NotificationListenerService
- WorkManager: https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started
- Background restrictions: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start

## Model repositories

### Muse — Gemma 4 E2B

Repository:
`litert-community/gemma-4-E2B-it-litert-lm`

Primary Pixel 10 artifact:
`gemma-4-E2B-it_Google_Tensor_G5.litertlm`

Fallback generic artifact:
`gemma-4-E2B-it.litertlm`

### Scout — Qwen3.5 0.8B

Repository:
`litert-community/Qwen3.5-0.8B`

Artifact:
`Qwen3.5-0.8B_int8.litertlm`

### Sage — Qwen3.5 4B

Repository:
`litert-community/Qwen3.5-4B`

Artifact:
`Qwen3.5-4B_mixed_int4.litertlm`

Use the INT8 build only after real Pixel RAM/performance measurements justify it.

### Memory — EmbeddingGemma

Repository:
`litert-community/embeddinggemma-300m`

The repository contains several sequence-length/backend variants and requires acceptance of Google's model usage terms. Select a 256/512 sequence model for mobile memory indexing after the first runtime benchmark.

## Development tools

- Android Studio Ladybug or newer
- Android SDK / adb
- Node LTS compatible with OpenMuse (upstream currently requires Node >=22; README calls for Node 24 LTS)
- pnpm version pinned by OpenMuse
- Python 3.9–3.12 for LiteRT CLI tooling if used
- `hf` CLI for model downloads

## Licensing notes

Do not mirror model binaries into the source repository. Preserve model licenses/attribution and any click-through acceptance requirements in the in-app model manager.
