import type { EdgeModelSpec } from "./types";

export const EDGE_MODELS: readonly EdgeModelSpec[] = [
  {
    id: "scout",
    label: "Scout",
    model: "Qwen3.5 0.8B",
    role: "Fast event triage, classification, urgency and memory-worthiness.",
    artifact: "Qwen3.5-0.8B_int8.litertlm",
    approximateSizeGb: 0.96,
    preferredBackend: "gpu",
    residentByDefault: true,
    directToolCalls: false,
  },
  {
    id: "muse",
    label: "Muse",
    model: "Gemma 4 E2B",
    role: "Primary local orchestrator, conversation model and approved tool caller.",
    artifact: "gemma-4-E2B-it_Google_Tensor_G5.litertlm",
    approximateSizeGb: 3.11,
    preferredBackend: "npu",
    residentByDefault: false,
    directToolCalls: true,
  },
  {
    id: "sage",
    label: "Sage",
    model: "Qwen3.5 4B Mixed INT4",
    role: "Deep reasoning, critique and difficult multi-source synthesis.",
    artifact: "Qwen3.5-4B_mixed_int4.litertlm",
    approximateSizeGb: 2.57,
    preferredBackend: "gpu",
    residentByDefault: false,
    directToolCalls: false,
  },
] as const;

export const EDGE_MODEL_TOTAL_GB = EDGE_MODELS.reduce(
  (total, model) => total + model.approximateSizeGb,
  0,
);
