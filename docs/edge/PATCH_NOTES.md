# Integration notes for upstream OpenMuse

Base project: `CopilotKit/openmuse` (current OpenMuse architecture: Expo/React Native client + Hono/Node server).

This bootstrap is deliberately additive. It avoids replacing upstream `App.tsx`, server code, or package manifests until the native runtime is proven on a real Pixel.

## Additive paths

Copy these new paths into the OpenMuse fork:

- `docs/edge/*`
- `packages/edge-agent/*`
- `apps/mobile/modules/openmuse-edge/*`
- `apps/mobile/src/edge/*`
- `resources/edge-models.json`
- `scripts/edge/*`

## Workspace changes to make in the fork

OpenMuse already includes `packages/*` in its pnpm workspace, so `packages/edge-agent` should be discovered automatically.

Add `@openmuse/edge-agent: workspace:*` to `apps/mobile/package.json` after the package is copied.

The local Expo module under `apps/mobile/modules/openmuse-edge` should be auto-linked by Expo. It wraps LiteRT-LM and will require a native development build; Expo Go will not work for this feature.

## Android dependencies

The local module's Gradle file includes LiteRT-LM and WorkManager. Pin the LiteRT-LM Maven version after the first successful device build; the scaffold starts with `latest.release` because Google currently documents that coordinate in the Kotlin guide.

## Models

Never add `.litertlm`, `.tflite`, tokenizer model files, or generated caches to Git. `scripts/edge/download-models.sh` downloads development copies to a local ignored directory. The mobile app should later get a resumable model downloader and checksum verification.
