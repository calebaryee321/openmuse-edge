export type EdgeAgentId = "scout" | "muse" | "sage";

export type EdgeRisk = "low" | "medium" | "high";

export interface EdgeModelSpec {
  id: EdgeAgentId;
  label: string;
  model: string;
  role: string;
  artifact: string;
  approximateSizeGb: number;
  preferredBackend: "npu" | "gpu" | "auto";
  residentByDefault: boolean;
  directToolCalls: boolean;
}

export interface EdgeRouteInput {
  source: "notification" | "email" | "calendar" | "chat" | "memory" | "device";
  importance?: number;
  complexity?: number;
  confidence?: number;
  actionRequired?: boolean;
  risk?: EdgeRisk;
  userRequestedDeepReasoning?: boolean;
}

export interface EdgeRouteDecision {
  agent: EdgeAgentId;
  reason: string;
  escalateTo?: EdgeAgentId;
}
