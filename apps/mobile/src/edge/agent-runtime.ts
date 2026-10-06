import { edgeModelManager } from "./model-manager";
import { OpenMuseEdge } from "./native";
import type { EdgeAgentId } from "./types";
import type { AgentResult, AgentTask } from "./agent-protocol";

export async function isAgentAvailable(agentId: EdgeAgentId) {
  await edgeModelManager.refresh(agentId);
  return Boolean(edgeModelManager.getSnapshot(agentId).localUri);
}

async function ensureAgentLoaded(agentId: EdgeAgentId) {
  await edgeModelManager.refresh(agentId);
  let snapshot = edgeModelManager.getSnapshot(agentId);

  if (!snapshot.localUri) {
    throw new Error(`${agentId} is not installed on this device.`);
  }

  if (snapshot.state !== "loaded") {
    await edgeModelManager.load(agentId, "auto");
    snapshot = edgeModelManager.getSnapshot(agentId);
  }

  if (snapshot.state !== "loaded") {
    throw new Error(`${agentId} could not be loaded.`);
  }

  return snapshot;
}

export async function executeAgentTask(task: AgentTask): Promise<AgentResult> {
  const startedAt = new Date().toISOString();
  await ensureAgentLoaded(task.assignedTo);

  const context = task.context ? JSON.stringify(task.context, null, 2) : "(none)";
  const prompt = [
    task.instruction.trim(),
    "",
    `Task kind: ${task.kind}`,
    `Requested by: ${task.requestedBy}`,
    "Context:",
    context,
    "",
    "Input:",
    task.input.trim(),
  ].join("\n");

  const output = await OpenMuseEdge.generate(prompt);

  return {
    task,
    output,
    worker: task.assignedTo,
    handoff: {
      from: task.requestedBy,
      to: task.assignedTo,
      reason: `${task.requestedBy} delegated a ${task.kind} task.`,
      taskKind: task.kind,
      startedAt,
      completedAt: new Date().toISOString(),
    },
  };
}
