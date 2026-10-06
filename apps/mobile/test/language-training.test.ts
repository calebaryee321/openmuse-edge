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
  assert.equal(normalizeErrorKey("  Gender—Agreement!! "), "genderagreement");
  assert.equal(clampBand(-9), 0);
  assert.equal(clampBand(9), 4);
});
