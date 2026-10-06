import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampBand,
  createReviewItem,
  dueReviews,
  normalizeErrorKey,
  recordErrorPattern,
  scheduleReview,
  shouldRunSageExplanation,
  shouldRunScoutEvaluation,
} from "../src/edge/language-training.ts";
import {
  FRENCH_MISSIONS,
  buildAfterActionReview,
  recommendFrenchMission,
} from "../src/edge/language-missions.ts";
import { parseLanguageTurnAnalysis } from "../src/edge/language-analysis.ts";
import {
  migrateLanguageProfile,
  startsNewLanguageSession,
} from "../src/edge/language-profile.ts";

test("one-off mistakes do not become recurring weaknesses", () => {
  const once = recordErrorPattern([], {
    label: "Partitive articles",
    turnId: "turn-1",
    at: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(once[0].count, 1);
  assert.equal(once[0].status, "observed");
});

test("same normalized error across distinct turns becomes recurring at three observations", () => {
  let patterns = recordErrorPattern([], {
    label: "Partitive articles!",
    turnId: "turn-1",
    at: "2026-01-01T00:00:00.000Z",
  });
  patterns = recordErrorPattern(patterns, {
    label: "partitive articles",
    turnId: "turn-2",
    at: "2026-01-02T00:00:00.000Z",
  });
  patterns = recordErrorPattern(patterns, {
    label: "PARTITIVE   ARTICLES",
    turnId: "turn-3",
    at: "2026-01-03T00:00:00.000Z",
  });
  assert.equal(patterns[0].key, "partitive articles");
  assert.equal(patterns[0].count, 3);
  assert.equal(patterns[0].status, "recurring");
});

test("duplicate evidence in one turn is counted once", () => {
  let patterns = recordErrorPattern([], { label: "gender agreement", turnId: "same" });
  patterns = recordErrorPattern(patterns, { label: "gender agreement", turnId: "same" });
  assert.equal(patterns[0].count, 1);
});

test("review scheduler makes failed items due sooner than successful items", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");
  const base = createReviewItem(
    { id: "1", kind: "phrase", prompt: "Je voudrais", answer: "I would like" },
    now,
  );
  const again = scheduleReview(base, 0, now);
  const good = scheduleReview(base, 2, now);
  const easy = scheduleReview(base, 3, now);
  assert.ok(new Date(again.dueAt) < new Date(good.dueAt));
  assert.ok(new Date(good.dueAt) < new Date(easy.dueAt));
});

test("due review selection is deterministic", () => {
  const now = new Date("2026-01-03T00:00:00.000Z");
  const items = [
    { ...createReviewItem({ id: "later", kind: "phrase", prompt: "a", answer: "a" }), dueAt: "2026-01-04T00:00:00.000Z" },
    { ...createReviewItem({ id: "old", kind: "phrase", prompt: "b", answer: "b" }), dueAt: "2026-01-01T00:00:00.000Z" },
    { ...createReviewItem({ id: "new", kind: "phrase", prompt: "c", answer: "c" }), dueAt: "2026-01-02T00:00:00.000Z" },
  ];
  assert.deepEqual(dueReviews(items, now).map((item) => item.id), ["old", "new"]);
});

test("delegation policy limits model swaps", () => {
  assert.equal(
    shouldRunScoutEvaluation({
      mode: "Conversation",
      totalTurns: 0,
      hasScout: true,
      userText: "Bonjour",
    }),
    false,
  );
  assert.equal(
    shouldRunScoutEvaluation({
      mode: "Conversation",
      totalTurns: 2,
      hasScout: true,
      userText: "Bonjour",
    }),
    true,
  );
  assert.equal(
    shouldRunSageExplanation({
      hasSage: true,
      userText: "Why is this grammar different?",
    }),
    true,
  );
});

test("normalization and skill bands are bounded", () => {
  assert.equal(normalizeErrorKey("  Gender—Agreement!! "), "gender agreement");
  assert.equal(clampBand(-9), 0);
  assert.equal(clampBand(9), 4);
});


test("mission recommender advances beyond completed beginner missions", () => {
  const mission = recommendFrenchMission({
    completedMissionIds: ["fr-cafe-order"],
    recurringWeakPoints: [],
  });
  assert.equal(mission.id, "fr-hotel-checkin");
});

test("after-action review uses explicit mission success criteria", () => {
  const mission = FRENCH_MISSIONS[0];
  const aar = buildAfterActionReview({
    mission,
    metCriteria: mission.successCriteria.slice(0, 3),
    strengths: ["polite request"],
    weaknesses: ["bill vocabulary"],
    corrections: [],
    vocabulary: ["l'addition"],
  });
  assert.equal(aar.result, "completed");

  const retry = buildAfterActionReview({
    mission,
    metCriteria: [],
    strengths: [],
    weaknesses: ["could not complete the order"],
    corrections: [],
    vocabulary: [],
  });
  assert.equal(retry.result, "retry");
});


test("malformed Scout output is ignored safely", () => {
  assert.equal(parseLanguageTurnAnalysis("not json"), undefined);
  assert.equal(parseLanguageTurnAnalysis("{broken"), undefined);

  const parsed = parseLanguageTurnAnalysis(
    'prefix {"errors":[" gender agreement ",""],"vocabulary":["bonjour"],"confidence":4,"needsDeepExplanation":true} suffix',
  );
  assert.deepEqual(parsed?.errors, ["gender agreement"]);
  assert.deepEqual(parsed?.vocabulary, ["bonjour"]);
  assert.equal(parsed?.confidence, 1);
  assert.equal(parsed?.needsDeepExplanation, true);
});

test("legacy learner profile migrates without losing prior history", () => {
  const migrated = migrateLanguageProfile({
    language: "French",
    level: "Beginner",
    totalTurns: 9,
    weakPoints: ["articles"],
    vocabulary: ["bonjour"],
    recentCorrections: ["Je voudrais..."],
  });

  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.totalTurns, 9);
  assert.deepEqual(migrated.weakPoints, ["articles"]);
  assert.deepEqual(migrated.vocabulary, ["bonjour"]);
  assert.equal(migrated.totalSessions, 0);
  assert.deepEqual(migrated.completedMissions, []);
  assert.equal(migrated.skillBands.interaction, 0);
});

test("session boundary is stable and testable", () => {
  const now = Date.parse("2026-01-01T12:00:00.000Z");
  assert.equal(startsNewLanguageSession(undefined, now), true);
  assert.equal(
    startsNewLanguageSession("2026-01-01T11:00:00.000Z", now),
    false,
  );
  assert.equal(
    startsNewLanguageSession("2026-01-01T09:00:00.000Z", now),
    true,
  );
});
