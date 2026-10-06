import * as FileSystem from "expo-file-system/legacy";
import type { AgentHandoff } from "./agent-protocol";
import { newAgentTask } from "./agent-protocol";
import { delegateWithFallback } from "./agent-orchestrator";
import { isAgentAvailable } from "./agent-runtime";
import type { LocalTurn } from "./local-assistant";

const ROOT = `${FileSystem.documentDirectory}openmuse-edge/language-agent/`;
const PROFILE_FILE = `${ROOT}profile.json`;

export type LanguagePracticeMode =
  | "Conversation"
  | "Correction"
  | "Vocabulary"
  | "Travel role-play";

export type LanguageLearnerProfile = {
  language: string;
  level: string;
  totalTurns: number;
  goals: string[];
  weakPoints: string[];
  vocabulary: string[];
  recentCorrections: string[];
  lastPracticedAt?: string;
};

export type LanguageTurnAnalysis = {
  corrected?: string;
  errors: string[];
  vocabulary: string[];
  focus?: string;
  confidence: number;
  needsDeepExplanation: boolean;
};

export type LanguageAgentReply = {
  text: string;
  profile: LanguageLearnerProfile;
  analysis?: LanguageTurnAnalysis;
  handoffs: AgentHandoff[];
};

const EMPTY_PROFILE: LanguageLearnerProfile = {
  language: "French",
  level: "Beginner",
  totalTurns: 0,
  goals: ["Hold practical everyday conversations"],
  weakPoints: [],
  vocabulary: [],
  recentCorrections: [],
};

async function ensureRoot() {
  await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
}

export async function loadLanguageAgentProfile(): Promise<LanguageLearnerProfile> {
  try {
    const info = await FileSystem.getInfoAsync(PROFILE_FILE);
    if (!info.exists) return EMPTY_PROFILE;
    return {
      ...EMPTY_PROFILE,
      ...(JSON.parse(await FileSystem.readAsStringAsync(PROFILE_FILE)) as LanguageLearnerProfile),
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

export async function saveLanguageAgentProfile(profile: LanguageLearnerProfile) {
  await ensureRoot();
  await FileSystem.writeAsStringAsync(PROFILE_FILE, JSON.stringify(profile, null, 2));
}

function uniqueRecent(values: string[], incoming: string[], limit: number) {
  return [...new Set([...incoming.filter(Boolean), ...values])].slice(0, limit);
}

function extractJsonObject(value: string): Record<string, unknown> | null {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(value.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseAnalysis(value: string): LanguageTurnAnalysis | undefined {
  const parsed = extractJsonObject(value);
  if (!parsed) return undefined;

  return {
    corrected: typeof parsed.corrected === "string" ? parsed.corrected : undefined,
    errors: asStrings(parsed.errors).slice(0, 4),
    vocabulary: asStrings(parsed.vocabulary).slice(0, 5),
    focus: typeof parsed.focus === "string" ? parsed.focus : undefined,
    confidence:
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.7,
    needsDeepExplanation: parsed.needsDeepExplanation === true,
  };
}

function historyText(turns: LocalTurn[]) {
  return turns
    .slice(-10)
    .map((turn) => `${turn.role === "user" ? "Learner" : "Tutor"}: ${turn.text}`)
    .join("\n");
}

function tutorInstruction(
  profile: LanguageLearnerProfile,
  mode: LanguagePracticeMode,
  analysis?: LanguageTurnAnalysis,
  deepNote?: string,
) {
  const modeRules: Record<LanguagePracticeMode, string> = {
    Conversation:
      "Have a natural conversation. Prefer the target language, use concise English help only when useful, and correct only important mistakes.",
    Correction:
      "Focus on correction. Give the corrected version, one short reason, one natural alternative, then invite another attempt.",
    Vocabulary:
      "Teach practical vocabulary in context. Introduce at most five useful items and reuse them naturally before quizzing.",
    "Travel role-play":
      "Run a realistic travel scenario. Stay in character, adapt difficulty to the learner, and provide a brief hint if they get stuck.",
  };

  return [
    `You are the teaching worker inside the OpenMuse Language Agent for ${profile.language}.`,
    `Learner level: ${profile.level}.`,
    `Known weak points: ${profile.weakPoints.join(", ") || "none recorded yet"}.`,
    `Recently useful vocabulary: ${profile.vocabulary.slice(0, 12).join(", ") || "none yet"}.`,
    modeRules[mode],
    "Keep one clear conversational objective per turn.",
    "Do not dump a long grammar lecture unless specifically needed.",
    analysis?.corrected ? `Scout correction signal: ${analysis.corrected}` : "",
    analysis?.focus ? `Scout focus signal: ${analysis.focus}` : "",
    deepNote ? `Sage teaching note: ${deepNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runLanguageAgent(args: {
  language: string;
  level: string;
  mode: LanguagePracticeMode;
  userText: string;
  history: LocalTurn[];
}): Promise<LanguageAgentReply> {
  let profile = await loadLanguageAgentProfile();
  profile = { ...profile, language: args.language, level: args.level };

  const handoffs: AgentHandoff[] = [];
  let analysis: LanguageTurnAnalysis | undefined;

  if (await isAgentAvailable("scout")) {
    const evaluationTask = newAgentTask(
      "language-agent",
      "scout",
      "classify",
      [
        `Evaluate one ${args.language} learner turn at ${args.level} level.`,
        "Return ONLY JSON with keys:",
        '{"corrected":"optional corrected sentence","errors":["short labels"],"vocabulary":["useful new items"],"focus":"single skill","confidence":0.0,"needsDeepExplanation":false}',
        "Keep errors and vocabulary concise.",
      ].join("\n"),
      args.userText,
      { mode: args.mode, weakPoints: profile.weakPoints.slice(0, 6) },
    );

    try {
      const delegated = await delegateWithFallback(evaluationTask);
      handoffs.push(...delegated.trace.handoffs);
      analysis = parseAnalysis(delegated.result.output);
    } catch {
      // Evaluation is optional; Muse can still teach without Scout.
    }
  }

  let deepNote = "";
  const requestsExplanation = /\b(why|explain|grammar|rule|difference|understand)\b/i.test(args.userText);
  if ((analysis?.needsDeepExplanation || requestsExplanation) && (await isAgentAvailable("sage"))) {
    const explainTask = newAgentTask(
      "language-agent",
      "sage",
      "explain",
      [
        `Act as a senior ${args.language} pedagogy specialist.`,
        "Give the teaching agent a concise explanation strategy, not a user-facing essay.",
        "Focus on the learner's exact mistake/question and include one memorable contrast or example.",
      ].join("\n"),
      args.userText,
      { level: args.level, analysis },
    );

    try {
      const delegated = await delegateWithFallback(explainTask, "muse");
      handoffs.push(...delegated.trace.handoffs);
      deepNote = delegated.result.output;
    } catch {
      // Deep explanation is an enhancement, not a blocker.
    }
  }

  const teachTask = newAgentTask(
    "language-agent",
    "muse",
    "coach",
    tutorInstruction(profile, args.mode, analysis, deepNote),
    [
      historyText(args.history) || "(new session)",
      "",
      `Learner: ${args.userText}`,
      "Tutor:",
    ].join("\n"),
    {
      profile: {
        language: profile.language,
        level: profile.level,
        weakPoints: profile.weakPoints.slice(0, 8),
      },
      mode: args.mode,
    },
  );

  const taught = await delegateWithFallback(teachTask);
  handoffs.push(...taught.trace.handoffs);

  profile = {
    ...profile,
    totalTurns: profile.totalTurns + 1,
    weakPoints: uniqueRecent(profile.weakPoints, analysis?.errors ?? [], 12),
    vocabulary: uniqueRecent(profile.vocabulary, analysis?.vocabulary ?? [], 40),
    recentCorrections: uniqueRecent(
      profile.recentCorrections,
      analysis?.corrected ? [analysis.corrected] : [],
      12,
    ),
    lastPracticedAt: new Date().toISOString(),
  };

  await saveLanguageAgentProfile(profile);

  return {
    text: taught.result.output,
    profile,
    analysis,
    handoffs,
  };
}
