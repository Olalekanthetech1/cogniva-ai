export const TUTOR_LEARNING_FRAMEWORK_VERSION = "ctl-1.0.0";

const STRUCTURED_SECTIONS = [
  "Learning objectives",
  "Detailed explanation",
  "Worked example",
  "Practical application",
  "Guided practice"
];

function isTruncated(finishReason) {
  const normalized = typeof finishReason === "string"
    ? finishReason.trim().toLowerCase()
    : "";
  return [
    "length",
    "max_tokens",
    "max_output_tokens",
    "max_token_limit"
  ].includes(normalized);
}

function findSectionIndex(text, title) {
  const escaped = title.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
  const pattern = new RegExp(
    "^\\\\s{0,3}(?:#{1,3}\\\\s*)?(?:\\\\d+[.)]\\\\s*)?" +
      escaped +
      "(?:\\\\s*:)?\\\\s*$",
    "im"
  );
  const match = pattern.exec(text);
  return match ? match.index : -1;
}

function validateQuestionEnding(text) {
  const questions = (text.match(/\?/g) ?? []).length;
  if (!text.endsWith("?") || questions !== 1) {
    return "Tutor replies must end with exactly one clear learner-facing question.";
  }
  return null;
}

export function resolveTutorLearningMode({ hasLinkedUnit, latestSubmissionType }) {
  if (!hasLinkedUnit) return "adaptive_socratic";
  return latestSubmissionType === "initial_prompt"
    ? "structured_lesson_opening"
    : "structured_lesson_continuation";
}

export function buildTutorLearningFrameworkInstructions({ mode, learnerIntent }) {
  if (mode === "structured_lesson_opening") {
    return [
      "Apply Cogniva Tutor Learning Framework (CTL) v1 to this approved learning-plan unit.",
      "Write one coherent lesson opening in Markdown using these exact headings, in this order: Learning objectives; Detailed explanation; Worked example; Practical application; Guided practice.",
      "State 2–4 measurable learning objectives. Explain the core idea accurately, moving from intuition to formal definitions, principles, equations, assumptions, and common misconceptions where relevant.",
      "In Worked example, state what is given and required, explain the method, show each meaningful step and why it is valid, then check the result. For a non-numeric subject, work through a complete argument, experiment, design decision, or analysis instead.",
      "In Practical application, connect the concept to a genuine disciplinary or real-world use. Do not invent research, measurements, citations, or experimental findings. Label any constructed numerical scenario as illustrative or hypothetical.",
      "In Guided practice, give exactly one new, unworked checkpoint that the learner can attempt. Use that first response to gauge prior knowledge; do not claim to have diagnosed the learner before they answer.",
      "Do not reveal the guided-practice answer. Keep the explanation sufficiently detailed to teach, but avoid unrelated digressions. Ask exactly one question, as the final sentence.",
      "Do not claim lesson completion, mastery, verified syllabus coverage, or academic validation."
    ].join(" ");
  }

  if (mode === "structured_lesson_continuation") {
    const intent = learnerIntent ?? "follow_up";
    const instructions = [
      "Continue the existing CTL v1 lesson for an approved learning-plan unit. Use the conversation as evidence of what has already been taught; do not restart the lesson or repeat full sections unnecessarily.",
      "Keep explanations detailed enough to resolve the current difficulty, but focus each reply on one instructional move and one learner-facing question.",
      "Use progressive scaffolding: first give a directional hint, then recall a relevant principle, then break the task into a smaller step, and reveal a partial or full solution only when needed or explicitly requested.",
      "When the learner can explain or apply the guided step, reduce support and offer a different independent-practice question. Interleave related problem types when appropriate so the learner must choose a method.",
      "When asked to recap, retrieve, or review, summarize the key principles and equations and ask one short recall question. Do not mark the unit complete or the learner mastered from conversation alone.",
      "Use real applications where relevant. Clearly label hypothetical examples and never fabricate sources, experimental data, course requirements, or validation."
    ];

    if (intent === "clarification") {
      instructions.push(
        "This turn is a clarification: answer the exact question directly, change representation if useful, and do not advance the teaching sequence merely because a reply was generated."
      );
    } else if (intent === "work_attempt") {
      instructions.push(
        "This turn contains a learner attempt: preserve correct reasoning, identify the first unsupported or incorrect step, explain why, and ask for one revised step before providing more help."
      );
    } else if (intent === "direct_answer_request") {
      instructions.push(
        "The learner explicitly requested a complete answer: respect that request, provide a complete worked explanation, and do not withhold the answer merely to enforce a teaching stage."
      );
    } else if (intent === "correction_challenge") {
      instructions.push(
        "The learner is challenging a previous claim: reassess it using only available evidence, correct any supported error, and do not advance until the challenged point is addressed."
      );
    }

    return instructions.join(" ");
  }

  return [
    "Use Cogniva's adaptive Socratic dialogue for this direct question or problem.",
    "Do not force a multi-stage lesson when the learner needs a focused clarification or worked problem."
  ].join(" ");
}

export function validateTutorLearningOutput({
  text,
  finishReason,
  mode,
  numericMismatchCount = 0
}) {
  const normalized = typeof text === "string" ? text.trim() : "";
  if (!normalized) return "The tutor returned an empty response.";
  if (isTruncated(finishReason)) {
    return "The tutor response reached its output limit before completion.";
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const questionIssue = validateQuestionEnding(normalized);
  if (questionIssue) return questionIssue;

  if (mode === "structured_lesson_opening") {
    if (words.length > 480 || normalized.length > 4_200) {
      return "The structured lesson opening exceeded Cogniva's lesson-response limit.";
    }
    const sectionPositions = STRUCTURED_SECTIONS.map((section) =>
      findSectionIndex(normalized, section)
    );
    const missing = STRUCTURED_SECTIONS.filter((section, index) =>
      sectionPositions[index] < 0
    );
    if (missing.length > 0) {
      return "The structured lesson opening is missing required sections: " + missing.join(", ") + ".";
    }
    if (sectionPositions.some((position, index) =>
      index > 0 && position <= sectionPositions[index - 1]
    )) {
      return "The structured lesson sections are not in the required order.";
    }

    const objectivesStart = normalized.indexOf("\n", sectionPositions[0]);
    const objectivesEnd = sectionPositions[1];
    const objectivesText = objectivesStart >= 0
      ? normalized.slice(objectivesStart + 1, objectivesEnd)
      : "";
    const objectiveCount = (
      objectivesText.match(/^\s*(?:[-*+]|\d+[.)])\s+\S.*$/gm) ?? []
    ).length;
    if (objectiveCount < 2 || objectiveCount > 4) {
      return "The structured lesson must state between two and four list-form learning objectives.";
    }

    if (numericMismatchCount > 0) {
      return "The structured lesson contains a numeric claim that did not pass Cogniva's bounded arithmetic check.";
    }
    return null;
  }

  if (mode === "structured_lesson_continuation") {
    if (words.length > 220 || normalized.length > 2_400) {
      return "The structured lesson reply exceeded Cogniva's response limit.";
    }
    return null;
  }

  return "Choose a valid Tutor learning mode.";
}
