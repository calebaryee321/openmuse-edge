import { edgeModelManager } from "./model-manager";
import { OpenMuseEdge } from "./native";

export type LocalTurn = {
  role: "user" | "assistant";
  text: string;
};

export async function ensureMuseReady() {
  await edgeModelManager.refresh("muse");
  let snapshot = edgeModelManager.getSnapshot("muse");

  if (!snapshot.localUri) {
    throw new Error("Muse is not installed yet. Download Muse from Device AI first.");
  }

  if (snapshot.state !== "loaded") {
    await edgeModelManager.load("muse", "auto");
    snapshot = edgeModelManager.getSnapshot("muse");
  }

  if (snapshot.state !== "loaded") {
    throw new Error("Muse could not be loaded locally.");
  }

  return snapshot;
}

function transcript(turns: LocalTurn[], limit = 10) {
  return turns
    .slice(-limit)
    .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.text}`)
    .join("\n");
}

export async function askMuse(
  systemInstruction: string,
  turns: LocalTurn[],
  userText: string,
) {
  await ensureMuseReady();

  const history = transcript(turns);
  const prompt = [
    systemInstruction.trim(),
    "",
    "Conversation so far:",
    history || "(no earlier turns)",
    "",
    `User: ${userText.trim()}`,
    "Assistant:",
  ].join("\n");

  return OpenMuseEdge.generate(prompt);
}
