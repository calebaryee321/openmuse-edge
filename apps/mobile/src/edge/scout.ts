import { edgeModelManager } from "./model-manager";
import { OpenMuseEdge, type EdgeNotificationEvent } from "./native";

type ScoutDecision = {
  importance: number;
  actionRequired: boolean;
  reason: string;
};

function promptFor(event: EdgeNotificationEvent) {
  return [
    "You are Scout, a private on-device notification triage model.",
    "Return JSON only. No markdown.",
    'Schema: {"importance":0.0,"actionRequired":false,"reason":"short reason"}',
    "Importance is from 0.0 to 1.0.",
    "Be conservative. Do not infer private facts not present in the notification.",
    "",
    `App package: ${event.packageName}`,
    `Category: ${event.category ?? "unknown"}`,
    `Title: ${event.title ?? ""}`,
    `Text: ${event.text ?? ""}`,
    `Subtext: ${event.subText ?? ""}`,
  ].join("\n");
}

function parseDecision(raw: string): ScoutDecision {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  const candidate = first >= 0 && last > first ? raw.slice(first, last + 1) : raw;
  const parsed = JSON.parse(candidate) as Partial<ScoutDecision>;

  const importance =
    typeof parsed.importance === "number" && Number.isFinite(parsed.importance)
      ? Math.max(0, Math.min(1, parsed.importance))
      : 0.5;

  return {
    importance,
    actionRequired: parsed.actionRequired === true,
    reason:
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim().slice(0, 160)
        : "Scout local-model triage",
  };
}

export async function runScoutNotificationPass(limit = 8) {
  const events = OpenMuseEdge.getRecentNotificationEvents(limit);
  if (!events.length) return { processed: 0 };

  await edgeModelManager.load("scout", "auto");

  let processed = 0;
  for (const event of events) {
    try {
      const raw = await OpenMuseEdge.generate(promptFor(event));
      const decision = parseDecision(raw);
      OpenMuseEdge.updateNotificationTriage(
        event.id,
        decision.importance,
        decision.actionRequired,
        `Scout: ${decision.reason}`,
      );
      processed += 1;
    } catch {
      // Keep deterministic triage if one event cannot be parsed.
    }
  }

  return { processed };
}
