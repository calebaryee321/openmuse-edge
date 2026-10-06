import { useEffect, useState } from "react";
import { SendHorizontal, Trash2 } from "lucide-react-native";
import { Text, View } from "react-native";
import { Button, Card, Chip, ErrorNotice, Field, colors, s } from "../ui";
import { askMuse, type LocalTurn } from "./local-assistant";
import { clearChatHistory, loadChatHistory, saveChatHistory } from "./local-history";
import { useEdgeModel } from "./use-model-manager";

export function LocalChat() {
  const muse = useEdgeModel("muse");
  const [turns, setTurns] = useState<LocalTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadChatHistory().then(setTurns);
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const before = turns;
    const withUser: LocalTurn[] = [...before, { role: "user", text }];
    setTurns(withUser);
    setInput("");
    setBusy(true);
    setError("");
    await saveChatHistory(withUser);

    try {
      const response = await askMuse(
        [
          "You are Muse, a private on-device personal assistant.",
          "Be useful, warm, concise, and practical.",
          "Do not claim to have used remote services unless the user explicitly asks and they are available.",
          "The conversation is local to this device.",
        ].join(" "),
        before,
        text,
      );

      const completed: LocalTurn[] = [...withUser, { role: "assistant", text: response }];
      setTurns(completed);
      await saveChatHistory(completed);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    await clearChatHistory();
    setTurns([]);
    setError("");
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={[s.between, { gap: 10 }]}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.heading}>Private local chat</Text>
          <Text style={s.small}>Conversation history stays in OpenMuse app-private storage.</Text>
        </View>
        <Chip tint={muse.state === "loaded" ? colors.green : undefined}>
          Muse · {muse.state.replace(/-/g, " ")}
        </Chip>
      </View>

      {muse.state === "not-installed" && (
        <Card style={{ backgroundColor: colors.orange, padding: 14, gap: 4 }}>
          <Text style={s.heading}>Muse is required</Text>
          <Text style={s.small}>Download Muse from Device AI, then return here to chat locally.</Text>
        </Card>
      )}

      {turns.length === 0 ? (
        <View
          style={{
            backgroundColor: "#F7F9FC",
            borderRadius: 24,
            padding: 18,
            gap: 7,
          }}
        >
          <Text style={[s.heading, { fontSize: 18 }]}>Start anywhere</Text>
          <Text style={s.muted}>
            Ask a question, plan something, brainstorm, or paste text to work through privately.
          </Text>
          <View style={[s.row, { gap: 7, flexWrap: "wrap", marginTop: 5 }]}>
            {["Plan my day", "Brainstorm with me", "Explain something"].map((prompt) => (
              <Button
                key={prompt}
                small
                onPress={() => setInput(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ gap: 9 }}>
          {turns.slice(-12).map((turn, index) => (
            <View
              key={`${index}-${turn.role}`}
              style={{
                alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
                paddingHorizontal: 14,
                paddingVertical: 11,
                borderRadius: 18,
                backgroundColor: turn.role === "user" ? colors.blue : colors.card,
                borderWidth: turn.role === "assistant" ? 1 : 0,
                borderColor: colors.line,
              }}
            >
              <Text selectable style={s.text}>
                {turn.text}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Field
        label="Message Muse"
        value={input}
        onChangeText={setInput}
        multiline
        placeholder="Ask anything…"
        editable={!busy}
        style={{ minHeight: 72 }}
      />

      <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Button
          primary
          icon={SendHorizontal}
          busy={busy}
          disabled={!input.trim()}
          onPress={() => void send()}
        >
          Send
        </Button>
        {turns.length > 0 && (
          <Button small danger icon={Trash2} disabled={busy} onPress={() => void clear()}>
            Clear
          </Button>
        )}
      </View>

      <ErrorNotice error={error || muse.error} />
    </View>
  );
}
