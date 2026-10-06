export type LanguageTurnAnalysis = {
  corrected?: string;
  errors: string[];
  vocabulary: string[];
  focus?: string;
  confidence: number;
  needsDeepExplanation: boolean;
};

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
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export function parseLanguageTurnAnalysis(value: string): LanguageTurnAnalysis | undefined {
  const parsed = extractJsonObject(value);
  if (!parsed) return undefined;

  return {
    corrected: typeof parsed.corrected === "string" ? parsed.corrected.trim() : undefined,
    errors: asStrings(parsed.errors).slice(0, 4),
    vocabulary: asStrings(parsed.vocabulary).slice(0, 5),
    focus: typeof parsed.focus === "string" ? parsed.focus.trim() : undefined,
    confidence:
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.7,
    needsDeepExplanation: parsed.needsDeepExplanation === true,
  };
}
