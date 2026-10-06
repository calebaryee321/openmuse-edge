import type { EdgeAgentId } from "./types";

export type AgentTaskKind =
  | "classify"
  | "coach"
  | "explain"
  | "plan"
  | "critique"
  | "summarize";

export type AgentTask = {
  id: string;
  kind: AgentTaskKind;
  requestedBy: string;
  assignedTo: EdgeAgentId;
  instruction: string;
  input: string;
  context?: Record<string, unknown>;
};

export type AgentHandoff = {
  from: string;
  to: EdgeAgentId;
  reason: string;
  taskKind: AgentTaskKind;
  startedAt: string;
  completedAt?: string;
  fallback?: boolean;
};

export type AgentResult<T = string> = {
  task: AgentTask;
  output: T;
  worker: EdgeAgentId;
  handoff: AgentHandoff;
};

export type AgentTrace = {
  id: string;
  startedAt: string;
  completedAt?: string;
  handoffs: AgentHandoff[];
};

export function newAgentTask(
  requestedBy: string,
  assignedTo: EdgeAgentId,
  kind: AgentTaskKind,
  instruction: string,
  input: string,
  context?: Record<string, unknown>,
): AgentTask {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    requestedBy,
    assignedTo,
    instruction,
    input,
    context,
  };
}
