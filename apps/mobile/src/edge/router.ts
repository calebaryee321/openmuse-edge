import type { EdgeRouteDecision, EdgeRouteInput } from "./types";

export function routeEdgeTask(input: EdgeRouteInput): EdgeRouteDecision {
  const importance = input.importance ?? 0.5;
  const complexity = input.complexity ?? 0.5;
  const confidence = input.confidence ?? 1;

  if (
    input.userRequestedDeepReasoning ||
    input.risk === "high" ||
    complexity >= 0.82 ||
    confidence < 0.55
  ) {
    return {
      agent: "sage",
      reason: "High complexity, low confidence, high risk, or explicit deep-local request.",
    };
  }

  if (
    input.source === "notification" &&
    importance < 0.72 &&
    !input.actionRequired &&
    complexity < 0.35
  ) {
    return {
      agent: "scout",
      reason: "Low-cost notification triage can remain with Scout.",
    };
  }

  if (input.source === "notification") {
    return {
      agent: "scout",
      reason: "Scout triages device events first.",
      escalateTo: importance >= 0.72 || input.actionRequired ? "muse" : undefined,
    };
  }

  return {
    agent: "muse",
    reason: "Muse handles normal user-facing reasoning and orchestration.",
    escalateTo: complexity >= 0.7 || confidence < 0.8 ? "sage" : undefined,
  };
}
