import {
  DEFAULT_SKILL_BANDS,
  type ErrorPattern,
  type ReviewItem,
  type SkillBands,
} from "./language-training";

export const LANGUAGE_PROFILE_SCHEMA_VERSION = 2;
const SESSION_GAP_MS = 2 * 60 * 60 * 1000;

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

export function createEmptyLanguageProfile(): LanguageLearnerProfile {
  return {
    schemaVersion: LANGUAGE_PROFILE_SCHEMA_VERSION,
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
}

export function migrateLanguageProfile(value: unknown): LanguageLearnerProfile {
  const defaults = createEmptyLanguageProfile();
  const parsed =
    value && typeof value === "object" ? (value as Partial<LanguageLearnerProfile>) : {};

  return {
    ...defaults,
    ...parsed,
    schemaVersion: LANGUAGE_PROFILE_SCHEMA_VERSION,
    goals: Array.isArray(parsed.goals) ? parsed.goals : defaults.goals,
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
    totalTurns:
      typeof parsed.totalTurns === "number" && parsed.totalTurns >= 0 ? parsed.totalTurns : 0,
    totalSessions:
      typeof parsed.totalSessions === "number" && parsed.totalSessions >= 0
        ? parsed.totalSessions
        : 0,
  };
}

export function startsNewLanguageSession(lastPracticedAt?: string, now = Date.now()) {
  if (!lastPracticedAt) return true;
  const last = new Date(lastPracticedAt).getTime();
  return !Number.isFinite(last) || now - last >= SESSION_GAP_MS;
}
