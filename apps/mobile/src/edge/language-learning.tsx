import { useEffect, useMemo, useState } from "react";
import { SendHorizontal } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Chip, ErrorNotice, Field, colors, s } from "../ui";
import { askMuse, type LocalTurn } from "./local-assistant";
import {
  loadLanguageProgress,
  saveLanguageProgress,
  type LanguageProgress,
} from "./local-history";
import { useEdgeModel } from "./use-model-manager";

const LANGUAGES = ["French", "Spanish", "Italian", "German"] as const;
const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const MODES = ["Conversation", "Correction", "Vocabulary", "Travel role-play"] as const;

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

function instruction(language: string, level: string, mode: string) {
  const base = [
    `You are an excellent ${language} language tutor.`,
    `The learner is at ${level.toLowerCase()} level.`,
    "Keep the lesson conversational and confidence-building.",
    "Correct mistakes clearly without overloading the learner.",
    "Use short chunks and ask only one main question at a time.",
  ];

  if (mode === "Correction") {
    base.push(
      "Focus on correcting what the learner writes.",
      "Give: corrected sentence, one short explanation, and one more natural alternative.",
    );
  } else if (mode === "Vocabulary") {
    base.push(
      "Teach useful everyday vocabulary in context.",
      "Introduce at most five new items at once and then quiz the learner.",
    );
  } else if (mode === "Travel role-play") {
    base.push(
      "Run a realistic travel role-play such as a cafe, hotel, train station, airport, or shop.",
      "Stay in character, but provide a brief English hint when the learner is stuck.",
    );
  } else {
    base.push(
      `Prefer ${language} for the conversation, with concise English explanations when necessary.`,
      "Gently correct important errors after responding naturally.",
    );
  }

  return base.join(" ");
}

export function LanguageLearning() {
  const muse = useEdgeModel("muse");
  const [language, setLanguage] = useState<string>("French");
  const [level, setLevel] = useState<string>("Beginner");
  const [mode, setMode] = useState<string>("Conversation");
  const [progress, setProgress] = useState<LanguageProgress>({
    language: "French",
    level: "Beginner",
    practiceTurns: 0,
  });
  const [turns, setTurns] = useState<LocalTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadLanguageProgress().then((saved) => {
      setProgress(saved);
      setLanguage(saved.language || "French");
      setLevel(saved.level || "Beginner");
    });
  }, []);

  const tutorInstruction = useMemo(
    () => instruction(language, level, mode),
    [language, level, mode],
  );

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
      const response = await askMuse(tutorInstruction, before, text);
      const completed: LocalTurn[] = [...withUser, { role: "assistant", text: response }];
      setTurns(completed);

      const nextProgress: LanguageProgress = {
        language,
        level,
        practiceTurns: progress.practiceTurns + 1,
        lastPracticedAt: new Date().toISOString(),
      };
      setProgress(nextProgress);
      await saveLanguageProgress(nextProgress);
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
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={[s.between, { gap: 10 }]}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.heading}>Language Coach</Text>
          <Text style={s.small}>Local conversational practice powered by Muse.</Text>
        </View>
        <Chip tint={colors.lavender}>{progress.practiceTurns} practice turns</Chip>
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
