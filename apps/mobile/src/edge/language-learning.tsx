import { useEffect, useState } from "react";
import { SendHorizontal } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Chip, ErrorNotice, Field, colors, s } from "../ui";
import type { LocalTurn } from "./local-assistant";
import {
  loadLanguageAgentProfile,
  runLanguageAgent,
  type LanguageLearnerProfile,
  type LanguagePracticeMode,
} from "./language-agent";
import type { AgentHandoff } from "./agent-protocol";
import { useEdgeModel } from "./use-model-manager";

const LANGUAGES = ["French", "Spanish", "Italian", "German"] as const;
const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const MODES: readonly LanguagePracticeMode[] = [
  "Conversation",
  "Correction",
  "Vocabulary",
  "Travel role-play",
];

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: selected ? colors.blue : colors.card,
        borderWidth: 1,
        borderColor: selected ? colors.blue : colors.line,
      }}
    >
      <Text style={[s.small, { color: colors.text, fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );
}

export function LanguageLearning() {
  const muse = useEdgeModel("muse");
  const [language, setLanguage] = useState<string>("French");
  const [level, setLevel] = useState<string>("Beginner");
  const [mode, setMode] = useState<string>("Conversation");
  const [profile, setProfile] = useState<LanguageLearnerProfile>({
    schemaVersion: 2,
    language: "French",
    level: "Beginner",
    totalTurns: 0,
    totalSessions: 0,
    goals: ["Hold practical everyday conversations"],
    weakPoints: [],
    vocabulary: [],
    recentCorrections: [],
    skillBands: {
      interaction: 0,
      listening: 0,
      reading: 0,
      accuracy: 0,
      culture: 0,
    },
    errorPatterns: [],
    reviewQueue: [],
    completedMissions: [],
  });
  const [handoffs, setHandoffs] = useState<AgentHandoff[]>([]);
  const [turns, setTurns] = useState<LocalTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadLanguageAgentProfile().then((saved) => {
      setProfile(saved);
      setLanguage(saved.language || "French");
      setLevel(saved.level || "Beginner");
    });
  }, []);


  async function practice(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;

    const before = turns;
    const withUser: LocalTurn[] = [...before, { role: "user", text }];
    setTurns(withUser);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const response = await runLanguageAgent({
        language,
        level,
        mode: mode as LanguagePracticeMode,
        userText: text,
        history: before,
      });
      const completed: LocalTurn[] = [...withUser, { role: "assistant", text: response.text }];
      setTurns(completed);
      setProfile(response.profile);
      setHandoffs(response.handoffs);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBusy(false);
    }
  }

  function resetSession() {
    setTurns([]);
    setInput("");
    setError("");
    setHandoffs([]);
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={[s.between, { gap: 10 }]}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.heading}>Language Coach</Text>
          <Text style={s.small}>Local conversational practice powered by Muse.</Text>
        </View>
        <Chip tint={colors.lavender}>{profile.totalTurns} practice turns</Chip>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={s.label}>Language</Text>
        <View style={[s.row, { gap: 7, flexWrap: "wrap" }]}>
          {LANGUAGES.map((item) => (
            <Choice
              key={item}
              label={item}
              selected={language === item}
              onPress={() => {
                setLanguage(item);
                resetSession();
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={s.label}>Level</Text>
        <View style={[s.row, { gap: 7, flexWrap: "wrap" }]}>
          {LEVELS.map((item) => (
            <Choice key={item} label={item} selected={level === item} onPress={() => setLevel(item)} />
          ))}
        </View>
      </View>

      <Card
        style={{
          padding: 14,
          gap: 10,
          backgroundColor: "#F8FAFC",
          borderRadius: 20,
        }}
      >
        <View style={s.between}>
          <View>
            <Text style={[s.heading, { fontSize: 15 }]}>Learning memory</Text>
            <Text style={s.small}>The Language Agent carries this across sessions.</Text>
          </View>
          <Chip tint={colors.green}>persistent</Chip>
        </View>
        <View style={[s.row, { gap: 7, flexWrap: "wrap" }]}>
          <Chip>{profile.weakPoints.length} weak points</Chip>
          <Chip>{profile.vocabulary.length} vocabulary items</Chip>
          <Chip>{profile.recentCorrections.length} corrections</Chip>
        </View>
        {profile.weakPoints.length > 0 && (
          <Text style={s.small}>
            Current focus: {profile.weakPoints.slice(0, 3).join(" · ")}
          </Text>
        )}
      </Card>

      <View style={{ gap: 8 }}>
        <Text style={s.label}>Practice mode</Text>
        <View style={[s.row, { gap: 7, flexWrap: "wrap" }]}>
          {MODES.map((item) => (
            <Choice
              key={item}
              label={item}
              selected={mode === item}
              onPress={() => {
                setMode(item);
                resetSession();
              }}
            />
          ))}
        </View>
      </View>

      {turns.length === 0 && (
        <Card
          style={{
            backgroundColor: mode === "Travel role-play" ? "#FFF3E7" : colors.sky,
            padding: 18,
            gap: 10,
            borderRadius: 24,
          }}
        >
          <Text style={s.heading}>{mode}</Text>
          <Text style={s.muted}>
            {mode === "Travel role-play"
              ? `Practice a realistic ${language} travel situation with immediate coaching.`
              : mode === "Correction"
                ? `Write something in ${language}; Muse will correct it and explain the change.`
                : mode === "Vocabulary"
                  ? `Build useful ${language} vocabulary through examples and quick quizzes.`
                  : `Have a natural ${language} conversation matched to your level.`}
          </Text>
          <Button
            primary
            busy={busy}
            onPress={() =>
              void practice(
                mode === "Travel role-play"
                  ? "Start a travel role-play for me. Choose a useful scenario and begin."
                  : mode === "Vocabulary"
                    ? "Start a short practical vocabulary lesson and quiz me."
                    : mode === "Conversation"
                      ? "Start a friendly conversation with me at my level."
                      : "Give me a short sentence to translate, then correct my answer.",
              )
            }
          >
            Start practice
          </Button>
        </Card>
      )}

      {turns.length > 0 && (
        <View style={{ gap: 9 }}>
          {turns.slice(-10).map((turn, index) => (
            <View
              key={`${index}-${turn.role}`}
              style={{
                alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "94%",
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

      {handoffs.length > 0 && (
        <View style={{ gap: 7 }}>
          <Text style={s.label}>Agent activity</Text>
          <View style={[s.row, { gap: 7, flexWrap: "wrap" }]}>
            {handoffs.map((handoff, index) => (
              <Chip
                key={`${handoff.to}-${handoff.taskKind}-${index}`}
                tint={
                  handoff.to === "scout"
                    ? colors.green
                    : handoff.to === "sage"
                      ? colors.lavender
                      : colors.sky
                }
              >
                {handoff.to === "scout"
                  ? "Scout evaluated"
                  : handoff.to === "sage"
                    ? "Sage explained"
                    : "Muse coached"}
              </Chip>
            ))}
          </View>
        </View>
      )}

      <Field
        label={mode === "Correction" ? `Write something in ${language}` : "Your reply"}
        value={input}
        onChangeText={setInput}
        multiline
        placeholder={mode === "Correction" ? "Type a sentence to correct…" : "Reply to your tutor…"}
        editable={!busy}
        style={{ minHeight: 72 }}
      />

      <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Button
          primary
          icon={SendHorizontal}
          busy={busy}
          disabled={!input.trim()}
          onPress={() => void practice()}
        >
          Send
        </Button>
        {turns.length > 0 && (
          <Button small disabled={busy} onPress={resetSession}>
            New session
          </Button>
        )}
      </View>

      {muse.state === "not-installed" && (
        <Text style={s.small}>Muse must be downloaded before local language practice can run.</Text>
      )}
      <ErrorNotice error={error || muse.error} />
    </View>
  );
}
