import { useEffect, useRef, useState } from "react";
import { ArrowLeft, SendHorizontal, Trash2 } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, Mascot, s } from "../ui";
import { askMuse, type LocalTurn } from "./local-assistant";
import { clearChatHistory, loadChatHistory, saveChatHistory } from "./local-history";
import { edgeModelManager } from "./model-manager";
import { useEdgeModel } from "./use-model-manager";

function compactError(value?: string) {
  if (!value) return "";
  if (value.includes("Unable to initialize LiteRT-LM")) {
    return "Muse couldn't start its local AI engine. Your downloaded model is still on this phone.";
  }
  return value.length > 180 ? `${value.slice(0, 177)}…` : value;
}

export function LocalChat({ onClose }: { onClose: () => void }) {
  const muse = useEdgeModel("muse");
  const [turns, setTurns] = useState<LocalTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<FlatList<LocalTurn>>(null);

  useEffect(() => {
    void loadChatHistory().then(setTurns);
  }, []);

  useEffect(() => {
    if (turns.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [turns, busy]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
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
          "Be useful, natural, concise, and practical.",
          "Use the conversation context when it is relevant.",
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

  async function retryMuse() {
    setBusy(true);
    setError("");
    try {
      await edgeModelManager.load("muse", "auto");
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

  const visibleError = compactError(error || muse.error);
  const downloaded = Boolean(muse.localUri);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            height: 68,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: "#ECEEF1",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onClose}
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? "#F1F3F5" : "transparent",
            })}
          >
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>

          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Mascot size={38} />
            <View style={{ gap: 1 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Muse</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 7,
                    backgroundColor: muse.state === "loaded" ? "#35A36A" : "#AAB1B8",
                  }}
                />
                <Text style={s.small}>
                  {muse.state === "loaded"
                    ? `On device · ${muse.runtime.backend?.toUpperCase() || "local"}`
                    : downloaded
                      ? "Downloaded · starts when needed"
                      : "Muse not installed"}
                </Text>
              </View>
            </View>
          </View>

          {turns.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear conversation"
              disabled={busy}
              onPress={() => void clear()}
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                opacity: busy ? 0.35 : pressed ? 0.55 : 1,
              })}
            >
              <Trash2 size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        <FlatList
          ref={listRef}
          data={turns}
          keyExtractor={(_, index) => String(index)}
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: turns.length === 0 ? 1 : undefined,
            paddingHorizontal: 16,
            paddingTop: 18,
            paddingBottom: 18,
          }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View
              style={{
                alignSelf: item.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "86%",
                marginBottom: 10,
                paddingHorizontal: 15,
                paddingVertical: 11,
                borderRadius: 20,
                borderBottomRightRadius: item.role === "user" ? 7 : 20,
                borderBottomLeftRadius: item.role === "assistant" ? 7 : 20,
                backgroundColor: item.role === "user" ? "#D9ECFF" : "#F3F5F7",
              }}
            >
              <Text selectable style={[s.text, { fontSize: 15, lineHeight: 22 }]}>
                {item.text}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: "center", paddingVertical: 34, gap: 18 }}>
              <View style={{ alignItems: "center", gap: 9 }}>
                <Mascot size={64} />
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 26,
                    fontWeight: "700",
                    letterSpacing: -0.8,
                  }}
                >
                  What can I help with?
                </Text>
                <Text style={[s.muted, { textAlign: "center", maxWidth: 310 }]}>
                  Chat privately with Muse. Your conversation stays on this device.
                </Text>
              </View>

              <View style={{ gap: 8 }}>
                {[
                  "Help me plan my day",
                  "Brainstorm an idea with me",
                  "Explain something I'm working on",
                ].map((prompt) => (
                  <Pressable
                    key={prompt}
                    onPress={() => void send(prompt)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 15,
                      paddingVertical: 13,
                      borderRadius: 16,
                      backgroundColor: pressed ? "#EEF2F6" : "#F7F8FA",
                      borderWidth: 1,
                      borderColor: "#ECEEF1",
                    })}
                  >
                    <Text style={[s.text, { fontWeight: "500" }]}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          ListFooterComponent={
            busy && turns.length > 0 ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 18,
                  backgroundColor: "#F3F5F7",
                }}
              >
                <ActivityIndicator size="small" color={colors.muted} />
                <Text style={s.small}>Muse is thinking…</Text>
              </View>
            ) : null
          }
        />

        {!!visibleError && (
          <View
            style={{
              marginHorizontal: 14,
              marginBottom: 8,
              padding: 12,
              borderRadius: 15,
              backgroundColor: "#FFF3F1",
              gap: 8,
            }}
          >
            <Text style={[s.small, { color: colors.danger, fontSize: 12, lineHeight: 18 }]}>
              {visibleError}
            </Text>
            {downloaded && (
              <Pressable
                disabled={busy}
                onPress={() => void retryMuse()}
                style={({ pressed }) => ({
                  alignSelf: "flex-start",
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: pressed ? "#E7E9EC" : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#E2E5E9",
                })}
              >
                <Text style={[s.small, { color: colors.text, fontWeight: "700" }]}>Retry Muse</Text>
              </Pressable>
            )}
          </View>
        )}

        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 10,
            borderTopWidth: 1,
            borderTopColor: "#ECEEF1",
            backgroundColor: "#FFFFFF",
          }}
        >
          <View
            style={{
              minHeight: 54,
              borderRadius: 27,
              backgroundColor: "#F5F6F8",
              flexDirection: "row",
              alignItems: "flex-end",
              paddingLeft: 16,
              paddingRight: 6,
              paddingVertical: 6,
              gap: 8,
            }}
          >
            <TextInput
              accessibilityLabel="Message Muse"
              value={input}
              onChangeText={setInput}
              placeholder="Message Muse"
              placeholderTextColor="#8B929A"
              multiline
              editable={!busy}
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 16,
                lineHeight: 21,
                maxHeight: 120,
                paddingTop: 10,
                paddingBottom: 9,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!input.trim() || busy}
              onPress={() => void send()}
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: !input.trim() || busy ? "#DDE2E7" : pressed ? "#095FAF" : "#1473C8",
              })}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <SendHorizontal size={18} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
