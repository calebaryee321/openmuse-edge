import * as FileSystem from "expo-file-system/legacy";
import type { AgentHandoff } from "./agent-protocol";
import { newAgentTask } from "./agent-protocol";
import { delegateWithFallback } from "./agent-orchestrator";
import { isAgentAvailable } from "./agent-runtime";
import type { LocalTurn } from "./local-assistant";
import type { LanguageMission } from "./language-missions";
import {
  createEmptyLanguageProfile,
  migrateLanguageProfile,
  startsNewLanguageSession,
  type LanguageLearnerProfile,
} from "./language-profile";
import {
  parseLanguageTurnAnalysis,
  type LanguageTurnAnalysis,
} from "./language-analysis";
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
export type LanguagePracticeMode =
  | "Conversation"
  | "Correction"
  | "Vocabulary"
  | "Travel role-play";


export type { LanguageLearnerProfile } from "./language-profile";

export type LanguageAgentReply = {
  text: string;
  profile: LanguageLearnerProfile;
  analysis?: LanguageTurnAnalysis;
  handoffs: AgentHandoff[];
};

async function ensureRoot() {
  await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
}

export async function loadLanguageAgentProfile(): Promise<LanguageLearnerProfile> {
  try {
    const info = await FileSystem.getInfoAsync(PROFILE_FILE);
    if (!info.exists) return createEmptyLanguageProfile();
    const raw = JSON.parse(await FileSystem.readAsStringAsync(PROFILE_FILE));
    return migrateLanguageProfile(raw);
  } catch {
    return createEmptyLanguageProfile();
  }
}

export async function saveLanguageAgentProfile(profile: LanguageLearnerProfile) {
  await ensureRoot();
  await FileSystem.writeAsStringAsync(PROFILE_FILE, JSON.stringify(profile, null, 2));
}

function uniqueRecent(values: string[], incoming: string[], limit: number) {
  return [...new Set([...incoming.filter(Boolean), ...values])].slice(0, limit);
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
  mission?: LanguageMission,
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
    mission ? `Mission: ${mission.title}` : "",
    mission ? `Scenario: ${mission.scenario}` : "",
    mission ? `Objective: ${mission.objective}` : "",
    mission ? `Success criteria: ${mission.successCriteria.join(" | ")}` : "",
    mission?.culturalFocus ? `Cultural focus: ${mission.culturalFocus}` : "",
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
  mission?: LanguageMission;
}): Promise<LanguageAgentReply> {
  let profile = await loadLanguageAgentProfile();
  const newSession = startsNewLanguageSession(profile.lastPracticedAt);
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
      analysis = parseLanguageTurnAnalysis(delegated.result.output);
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
    tutorInstruction(
      { ...profile, weakPoints: nextWeakPoints },
      args.mode,
      analysis,
      deepNote,
      args.mission,
    ),
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
      mission: args.mission
        ? {
            id: args.mission.id,
            title: args.mission.title,
            objective: args.mission.objective,
          }
        : undefined,
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
