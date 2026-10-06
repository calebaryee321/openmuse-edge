import * as FileSystem from "expo-file-system/legacy";
import type { AgentHandoff } from "./agent-protocol";
import { newAgentTask } from "./agent-protocol";
import { delegateWithFallback } from "./agent-orchestrator";
import { isAgentAvailable } from "./agent-runtime";
import type { LocalTurn } from "./local-assistant";
import {
  DEFAULT_SKILL_BANDS,
  createReviewItem,
  normalizeErrorKey,
  recordErrorPattern,
  shouldRunSageExplanation,
  shouldRunScoutEvaluation,
  type ErrorPattern,
  type ReviewItem,
  type SkillBands,
} from "./language-training";

const ROOT = `${FileSystem.documentDirectory}openmuse-edge/language-agent/`;
const PROFILE_FILE = `${ROOT}profile.json`;
const PROFILE_SCHEMA_VERSION = 2;
const SESSION_GAP_MS = 2 * 60 * 60 * 1000;

export type LanguagePracticeMode =
  | "Conversation"
  | "Correction"
  | "Vocabulary"
  | "Travel role-play";

export type LanguageLearnerProfile = {
  schemaVersion: 2;
  language: string;
  level: string;
  totalTurns: number;
  totalSessions: number;
  goals: string[];
  weakPoints: string[];
  vocabulary: string[];
  recentCorrections: string[];
  skillBands: SkillBands;
  errorPatterns: ErrorPattern[];
  reviewQueue: ReviewItem[];
  completedMissions: string[];
  lastPracticedAt?: string;
  lastAssessmentAt?: string;
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
  schemaVersion: PROFILE_SCHEMA_VERSION,
  language: "French",
  level: "Beginner",
  totalTurns: 0,
  totalSessions: 0,
  goals: ["Hold practical everyday conversations"],
  weakPoints: [],
  vocabulary: [],
  recentCorrections: [],
  skillBands: { ...DEFAULT_SKILL_BANDS },
  errorPatterns: [],
  reviewQueue: [],
  completedMissions: [],
};

async function ensureRoot() {
  await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
}

function migrateProfile(value: unknown): LanguageLearnerProfile {
  const parsed =
    value && typeof value === "object" ? (value as Partial<LanguageLearnerProfile>) : {};

  return {
    ...EMPTY_PROFILE,
    ...parsed,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    goals: Array.isArray(parsed.goals) ? parsed.goals : EMPTY_PROFILE.goals,
    weakPoints: Array.isArray(parsed.weakPoints) ? parsed.weakPoints : [],
    vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
    recentCorrections: Array.isArray(parsed.recentCorrections) ? parsed.recentCorrections : [],
    skillBands: {
      ...DEFAULT_SKILL_BANDS,
      ...(parsed.skillBands ?? {}),
    },
    errorPatterns: Array.isArray(parsed.errorPatterns) ? parsed.errorPatterns : [],
    reviewQueue: Array.isArray(parsed.reviewQueue) ? parsed.reviewQueue : [],
    completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
    totalSessions:
      typeof parsed.totalSessions === "number" && parsed.totalSessions >= 0
        ? parsed.totalSessions
        : 0,
  };
}

export async function loadLanguageAgentProfile(): Promise<LanguageLearnerProfile> {
  try {
    const info = await FileSystem.getInfoAsync(PROFILE_FILE);
    if (!info.exists) return { ...EMPTY_PROFILE, skillBands: { ...DEFAULT_SKILL_BANDS } };
    const raw = JSON.parse(await FileSystem.readAsStringAsync(PROFILE_FILE));
    return migrateProfile(raw);
  } catch {
    return { ...EMPTY_PROFILE, skillBands: { ...DEFAULT_SKILL_BANDS } };
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
    errors: asStrings(parsed.errors).map((item) => item.trim()).filter(Boolean).slice(0, 4),
    vocabulary: asStrings(parsed.vocabulary).map((item) => item.trim()).filter(Boolean).slice(0, 5),
    focus: typeof parsed.focus === "string" ? parsed.focus.trim() : undefined,
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
    `Known recurring weak points: ${profile.weakPoints.join(", ") || "none recorded yet"}.`,
    `Recently useful vocabulary: ${profile.vocabulary.slice(0, 12).join(", ") || "none yet"}.`,
    modeRules[mode],
    "Keep one clear conversational objective per turn.",
    "Do not dump a long grammar lecture unless specifically needed.",
    "Distinguish grammatical correctness from what sounds natural or culturally appropriate.",
    analysis?.corrected ? `Scout correction signal: ${analysis.corrected}` : "",
    analysis?.focus ? `Scout focus signal: ${analysis.focus}` : "",
    deepNote ? `Sage teaching note: ${deepNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function startsNewSession(lastPracticedAt?: string) {
  if (!lastPracticedAt) return true;
  const last = new Date(lastPracticedAt).getTime();
  return !Number.isFinite(last) || Date.now() - last >= SESSION_GAP_MS;
}

function addReviewItemIfMissing(items: ReviewItem[], item: ReviewItem) {
  const duplicate = items.some(
    (existing) =>
      existing.kind === item.kind &&
      existing.prompt.trim().toLowerCase() === item.prompt.trim().toLowerCase(),
  );
  return duplicate ? items : [item, ...items].slice(0, 120);
}

function recurringLabels(patterns: ErrorPattern[]) {
  return patterns
    .filter((pattern) => pattern.status === "recurring" || pattern.status === "improving")
    .sort((a, b) => b.count - a.count)
    .map((pattern) => pattern.label)
    .slice(0, 12);
}

export async function runLanguageAgent(args: {
  language: string;
  level: string;
  mode: LanguagePracticeMode;
  userText: string;
  history: LocalTurn[];
  missionCheckpoint?: boolean;
}): Promise<LanguageAgentReply> {
  let profile = await loadLanguageAgentProfile();
  const newSession = startsNewSession(profile.lastPracticedAt);
  profile = {
    ...profile,
    language: args.language,
    level: args.level,
    totalSessions: newSession ? profile.totalSessions + 1 : profile.totalSessions,
  };

  const handoffs: AgentHandoff[] = [];
  let analysis: LanguageTurnAnalysis | undefined;

  const hasScout = await isAgentAvailable("scout");
  const runScout = shouldRunScoutEvaluation({
    mode: args.mode,
    totalTurns: profile.totalTurns,
    hasScout,
    userText: args.userText,
    missionCheckpoint: args.missionCheckpoint,
  });

  if (runScout) {
    const evaluationTask = newAgentTask(
      "language-agent",
      "scout",
      "classify",
      [
        `Evaluate one ${args.language} learner turn at ${args.level} level.`,
        "Return ONLY JSON with keys:",
        '{"corrected":"optional corrected sentence","errors":["short stable error labels"],"vocabulary":["useful new items"],"focus":"single skill","confidence":0.0,"needsDeepExplanation":false}',
        "Do not treat obvious typos or fatigue slips as durable weaknesses.",
        "Keep errors and vocabulary concise.",
      ].join("\n"),
      args.userText,
      {
        mode: args.mode,
        recurringWeakPoints: profile.weakPoints.slice(0, 6),
      },
    );

    try {
      const delegated = await delegateWithFallback(evaluationTask);
      handoffs.push(...delegated.trace.handoffs);
      analysis = parseAnalysis(delegated.result.output);
    } catch {
      // Evaluation is optional; Muse can still teach without Scout.
    }
  }

  const turnId = `turn-${profile.totalTurns + 1}-${Date.now()}`;
  let errorPatterns = profile.errorPatterns;
  for (const error of analysis?.errors ?? []) {
    errorPatterns = recordErrorPattern(errorPatterns, {
      label: error,
      turnId,
      example: args.userText,
    });
  }

  const recurringWeaknessCount = (analysis?.errors ?? []).filter((error) => {
    const key = normalizeErrorKey(error);
    return errorPatterns.some(
      (pattern) => pattern.key === key && pattern.status === "recurring",
    );
  }).length;

  let deepNote = "";
  const potentialDeepNeed =
    analysis?.needsDeepExplanation === true ||
    /\b(why|explain|grammar|rule|difference|nuance|understand)\b/i.test(args.userText) ||
    recurringWeaknessCount >= 2;

  if (potentialDeepNeed) {
    const hasSage = await isAgentAvailable("sage");
    if (
      shouldRunSageExplanation({
        hasSage,
        userText: args.userText,
        scoutRequested: analysis?.needsDeepExplanation,
        recurringWeaknessCount,
      })
    ) {
      const explainTask = newAgentTask(
        "language-agent",
        "sage",
        "explain",
        [
          `Act as a senior ${args.language} pedagogy specialist.`,
          "Give the teaching agent a concise explanation strategy, not a user-facing essay.",
          "Focus on the learner's exact mistake/question.",
          "Include one memorable contrast/example and one likely misconception.",
        ].join("\n"),
        args.userText,
        { level: args.level, analysis, recurringWeaknessCount },
      );

      try {
        const delegated = await delegateWithFallback(explainTask, "muse");
        handoffs.push(...delegated.trace.handoffs);
        deepNote = delegated.result.output;
      } catch {
        // Deep explanation is an enhancement, not a blocker.
      }
    }
  }

  const nextWeakPoints = recurringLabels(errorPatterns);
  const teachTask = newAgentTask(
    "language-agent",
    "muse",
    "coach",
    tutorInstruction({ ...profile, weakPoints: nextWeakPoints }, args.mode, analysis, deepNote),
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
        weakPoints: nextWeakPoints.slice(0, 8),
      },
      mode: args.mode,
    },
  );

  const taught = await delegateWithFallback(teachTask);
  handoffs.push(...taught.trace.handoffs);

  let reviewQueue = profile.reviewQueue;
  for (const vocabulary of analysis?.vocabulary ?? []) {
    reviewQueue = addReviewItemIfMissing(
      reviewQueue,
      createReviewItem({
        id: `vocab-${normalizeErrorKey(vocabulary)}-${Date.now()}`,
        kind: "vocabulary",
        prompt: vocabulary,
        answer: `Use "${vocabulary}" naturally in ${args.language}.`,
      }),
    );
  }

  if (analysis?.corrected) {
    reviewQueue = addReviewItemIfMissing(
      reviewQueue,
      createReviewItem({
        id: `correction-${Date.now()}`,
        kind: "correction",
        prompt: args.userText,
        answer: analysis.corrected,
      }),
    );
  }

  profile = {
    ...profile,
    totalTurns: profile.totalTurns + 1,
    weakPoints: nextWeakPoints,
    errorPatterns,
    reviewQueue,
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
