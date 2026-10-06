export type ImmersionMode = "guided" | "immersion" | "full";

export type LanguageMission = {
  id: string;
  title: string;
  scenario: string;
  objective: string;
  successCriteria: string[];
  skillFocus: string[];
  difficulty: 1 | 2 | 3 | 4;
  recommendedMode: ImmersionMode;
  culturalFocus?: string;
};

export type MissionResult = "completed" | "partial" | "retry";

export type AfterActionReview = {
  missionId: string;
  result: MissionResult;
  strengths: string[];
  weaknesses: string[];
  corrections: string[];
  vocabulary: string[];
  culturalNote?: string;
  nextMissionId?: string;
};

export const FRENCH_MISSIONS: readonly LanguageMission[] = [
  {
    id: "fr-cafe-order",
    title: "Order at a café",
    scenario: "You enter a busy French café and speak with the server.",
    objective: "Order a drink and food, answer one follow-up question, and ask for the bill.",
    successCriteria: [
      "Makes a clear order",
      "Responds to a follow-up question",
      "Uses a polite request",
      "Asks for the bill",
    ],
    skillFocus: ["interaction", "polite requests", "food vocabulary"],
    difficulty: 1,
    recommendedMode: "guided",
    culturalFocus: "Natural polite ordering rather than translating an English script word-for-word.",
  },
  {
    id: "fr-hotel-checkin",
    title: "Check into a hotel",
    scenario: "You arrive at a hotel desk with a reservation.",
    objective: "Give your name, confirm the stay, understand breakfast information, and ask one question.",
    successCriteria: [
      "Identifies the reservation",
      "Handles dates or number of nights",
      "Understands one hotel detail",
      "Asks a practical question",
    ],
    skillFocus: ["interaction", "numbers and dates", "listening"],
    difficulty: 1,
    recommendedMode: "guided",
  },
  {
    id: "fr-train-problem",
    title: "Handle a train problem",
    scenario: "Your train is delayed and you need to understand the new plan.",
    objective: "Ask what happened, understand the alternative, and confirm the platform or departure time.",
    successCriteria: [
      "Asks for clarification",
      "Understands the main disruption",
      "Confirms a time or platform",
    ],
    skillFocus: ["clarification", "listening", "transport vocabulary"],
    difficulty: 2,
    recommendedMode: "immersion",
  },
  {
    id: "fr-yesterday",
    title: "Explain what you did yesterday",
    scenario: "A friend asks how your previous day went.",
    objective: "Give a short connected account of at least three events in the past.",
    successCriteria: [
      "Describes at least three past events",
      "Connects ideas beyond isolated sentences",
      "Answers one follow-up question",
    ],
    skillFocus: ["past tense", "narration", "interaction"],
    difficulty: 2,
    recommendedMode: "immersion",
  },
  {
    id: "fr-clarify-politely",
    title: "Recover when you do not understand",
    scenario: "A native speaker says something too quickly.",
    objective: "Stay in French while asking them to repeat, slow down, or rephrase.",
    successCriteria: [
      "Signals lack of understanding naturally",
      "Requests repetition or rephrasing",
      "Confirms the recovered meaning",
    ],
    skillFocus: ["repair strategies", "listening", "confidence"],
    difficulty: 2,
    recommendedMode: "full",
    culturalFocus: "Use natural repair phrases instead of immediately switching to English.",
  },
  {
    id: "fr-opinion",
    title: "Give and defend an opinion",
    scenario: "A friend asks your view on a familiar everyday topic.",
    objective: "State an opinion, give two reasons, and respond to a mild disagreement.",
    successCriteria: [
      "States a position",
      "Gives at least two connected reasons",
      "Responds to disagreement",
    ],
    skillFocus: ["sustained interaction", "connectors", "nuance"],
    difficulty: 3,
    recommendedMode: "full",
  },
];

export function recommendFrenchMission(input: {
  completedMissionIds: string[];
  recurringWeakPoints: string[];
}) {
  const remaining = FRENCH_MISSIONS.filter(
    (mission) => !input.completedMissionIds.includes(mission.id),
  );
  const pool = remaining.length > 0 ? remaining : [...FRENCH_MISSIONS];

  const weaknessText = input.recurringWeakPoints.join(" ").toLowerCase();
  if (weaknessText) {
    const targeted = pool.find((mission) =>
      mission.skillFocus.some((skill) => weaknessText.includes(skill.toLowerCase())),
    );
    if (targeted) return targeted;
  }

  return [...pool].sort((a, b) => a.difficulty - b.difficulty)[0];
}

export function buildAfterActionReview(input: {
  mission: LanguageMission;
  metCriteria: string[];
  strengths: string[];
  weaknesses: string[];
  corrections: string[];
  vocabulary: string[];
  culturalNote?: string;
  nextMissionId?: string;
}): AfterActionReview {
  const met = new Set(input.metCriteria);
  const ratio =
    input.mission.successCriteria.length === 0
      ? 1
      : input.mission.successCriteria.filter((criterion) => met.has(criterion)).length /
        input.mission.successCriteria.length;

  const result: MissionResult = ratio >= 0.75 ? "completed" : ratio >= 0.4 ? "partial" : "retry";

  return {
    missionId: input.mission.id,
    result,
    strengths: input.strengths.slice(0, 4),
    weaknesses: input.weaknesses.slice(0, 4),
    corrections: input.corrections.slice(0, 4),
    vocabulary: input.vocabulary.slice(0, 6),
    culturalNote: input.culturalNote,
    nextMissionId: input.nextMissionId,
  };
}
