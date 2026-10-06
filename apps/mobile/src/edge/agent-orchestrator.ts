import type { EdgeAgentId } from "./types";
import { executeAgentTask, isAgentAvailable } from "./agent-runtime";
import type { AgentResult, AgentTask, AgentTrace } from "./agent-protocol";

export type DelegationResult = {
  result: AgentResult;
  trace: AgentTrace;
};

export async function delegateWithFallback(
  task: AgentTask,
  fallbackAgent?: EdgeAgentId,
): Promise<DelegationResult> {
  const trace: AgentTrace = {
    id: task.id,
    startedAt: new Date().toISOString(),
    handoffs: [],
  };

  try {
    const result = await executeAgentTask(task);
    trace.handoffs.push(result.handoff);
    trace.completedAt = new Date().toISOString();
    return { result, trace };
  } catch (error) {
    if (!fallbackAgent || fallbackAgent === task.assignedTo) throw error;
    if (!(await isAgentAvailable(fallbackAgent))) throw error;

    const fallbackTask: AgentTask = {
      ...task,
      assignedTo: fallbackAgent,
      id: `${task.id}-fallback`,
    };

    const result = await executeAgentTask(fallbackTask);
    result.handoff = {
      ...result.handoff,
      reason: `${task.assignedTo} was unavailable; delegated to ${fallbackAgent}.`,
      fallback: true,
    };
    trace.handoffs.push(result.handoff);
    trace.completedAt = new Date().toISOString();
    return { result, trace };
  }
}
