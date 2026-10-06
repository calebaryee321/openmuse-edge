export type FunctionalSkill =
  | "interaction"
  | "listening"
  | "reading"
  | "accuracy"
  | "culture";

export type FunctionalBand = 0 | 1 | 2 | 3 | 4;

export type SkillBands = Record<FunctionalSkill, FunctionalBand>;

export type ErrorPatternStatus = "observed" | "recurring" | "improving" | "maintained";

export type ErrorEvidence = {
  turnId: string;
  at: string;
  example?: string;
};

export type ErrorPattern = {
  key: string;
  label: string;
  category: string;
  count: number;
  status: ErrorPatternStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  evidence: ErrorEvidence[];
};

export type ReviewKind = "vocabulary" | "phrase" | "correction" | "grammar" | "culture";
export type ReviewQuality = 0 | 1 | 2 | 3;

export type ReviewItem = {
  id: string;
  kind: ReviewKind;
  prompt: string;
  answer: string;
  repetitions: number;
  intervalDays: number;
  ease: number;
  dueAt: string;
  lastReviewedAt?: string;
};

export const DEFAULT_SKILL_BANDS: SkillBands = {
  interaction: 0,
  listening: 0,
  reading: 0,
  accuracy: 0,
  culture: 0,
};

export function clampBand(value: number): FunctionalBand {
  const rounded = Math.round(value);
  return Math.max(0, Math.min(4, rounded)) as FunctionalBand;
}

export function normalizeErrorKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function recordErrorPattern(
  patterns: ErrorPattern[],
  input: {
    label: string;
    category?: string;
    turnId: string;
    at?: string;
    example?: string;
  },
): ErrorPattern[] {
  const at = input.at ?? new Date().toISOString();
  const key = normalizeErrorKey(input.label);
  if (!key) return patterns;

  const existing = patterns.find((pattern) => pattern.key === key);
  if (!existing) {
    return [
      {
        key,
        label: input.label.trim(),
        category: input.category?.trim() || "general",
        count: 1,
        status: "observed",
        firstSeenAt: at,
        lastSeenAt: at,
        evidence: [{ turnId: input.turnId, at, example: input.example }].slice(-8),
      },
      ...patterns,
    ];
  }

  const sameTurnAlreadyCounted = existing.evidence.some(
    (evidence) => evidence.turnId === input.turnId,
  );
  const count = sameTurnAlreadyCounted ? existing.count : existing.count + 1;
  const evidence = sameTurnAlreadyCounted
    ? existing.evidence
    : [...existing.evidence, { turnId: input.turnId, at, example: input.example }].slice(-8);
  const distinctTurns = new Set(evidence.map((item) => item.turnId)).size;
  const status: ErrorPatternStatus =
    count >= 3 && distinctTurns >= 2 ? "recurring" : existing.status;

  return [
    {
      ...existing,
      label: input.label.trim() || existing.label,
      category: input.category?.trim() || existing.category,
      count,
      status,
      lastSeenAt: at,
      evidence,
    },
    ...patterns.filter((pattern) => pattern.key !== key),
  ];
}

export function markPatternImproving(patterns: ErrorPattern[], key: string) {
  const normalized = normalizeErrorKey(key);
  return patterns.map((pattern) =>
    pattern.key === normalized && pattern.status === "recurring"
      ? { ...pattern, status: "improving" as const }
      : pattern,
  );
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

export function createReviewItem(
  input: Pick<ReviewItem, "id" | "kind" | "prompt" | "answer">,
  now = new Date(),
): ReviewItem {
  return {
    ...input,
    repetitions: 0,
    intervalDays: 0,
    ease: 2.3,
    dueAt: now.toISOString(),
  };
}

export function scheduleReview(
  item: ReviewItem,
  quality: ReviewQuality,
  now = new Date(),
): ReviewItem {
  let repetitions = item.repetitions;
  let intervalDays = item.intervalDays;
  let ease = item.ease;

  if (quality === 0) {
    repetitions = 0;
    intervalDays = 0.25;
    ease = Math.max(1.3, ease - 0.2);
  } else if (quality === 1) {
    repetitions = Math.max(1, repetitions);
    intervalDays = 1;
    ease = Math.max(1.3, ease - 0.1);
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = quality === 3 ? 7 : 3;
    else intervalDays = Math.max(1, Math.round(Math.max(1, intervalDays) * ease * (quality === 3 ? 1.2 : 1)));
    if (quality === 3) ease = Math.min(3, ease + 0.05);
  }

  return {
    ...item,
    repetitions,
    intervalDays,
    ease,
    lastReviewedAt: now.toISOString(),
    dueAt: addDays(now, intervalDays).toISOString(),
  };
}

export function dueReviews(items: ReviewItem[], now = new Date()) {
  const nowMs = now.getTime();
  return items
    .filter((item) => new Date(item.dueAt).getTime() <= nowMs)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

export function shouldRunScoutEvaluation(input: {
  mode: string;
  totalTurns: number;
  hasScout: boolean;
  userText: string;
  missionCheckpoint?: boolean;
}) {
  if (!input.hasScout) return false;
  if (input.missionCheckpoint) return true;
  if (input.mode === "Correction" || input.mode === "Vocabulary") return true;
  if (/\b(correct|mistake|wrong|how did i do|feedback)\b/i.test(input.userText)) return true;
  return (input.totalTurns + 1) % 3 === 0;
}

export function shouldRunSageExplanation(input: {
  hasSage: boolean;
  userText: string;
  scoutRequested?: boolean;
  recurringWeaknessCount?: number;
}) {
  if (!input.hasSage) return false;
  if (input.scoutRequested) return true;
  if ((input.recurringWeaknessCount ?? 0) >= 2) return true;
  return /\b(why|explain|grammar|rule|difference|nuance|understand)\b/i.test(input.userText);
}
