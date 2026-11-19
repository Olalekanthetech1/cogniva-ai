export const TUTOR_LEARNING_FRAMEWORK_VERSION = "ctl-1.1.0";

const STRUCTURED_SECTIONS = [
  "Learning objectives",
  "Detailed explanation",
  "Worked example",
  "Practical application",
  "Guided practice"
];
const CONCEPT_SECTIONS = [
  "Core idea",
  "Explanation",
  "Example",
  "Check your understanding"
];
const PROBLEM_SECTIONS = [
  "Understand the problem",
  "Governing principle",
  "Strategy",
  "Work through the solution",
  "Verify and interpret",
  "Transfer check"
];

function isTruncated(finishReason) {
  const normalized = typeof finishReason === "string"
    ? finishReason.trim().toLowerCase()
    : "";
  return ["length", "max_tokens", "max_output_tokens", "max_token_limit"].includes(normalized);
}

function findSectionIndex(text, title) {
  const pattern = new RegExp(
    "^\\s{0,3}(?:#{1,3}\\s*)?(?:\\d+[.)]\\s*)?" + title + "(?:\\s*:)?\\s*$",
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

function validateOrderedSections(text, sections, label) {
  const positions = sections.map((section) => findSectionIndex(text, section));
  const missing = sections.filter((section, index) => positions[index] < 0);
  if (missing.length > 0) {
    return label + " is missing required sections: " + missing.join(", ") + ".";
  }
  if (positions.some((position, index) => index > 0 && position <= positions[index - 1])) {
    return label + " sections are not in the required order.";
  }
  return null;
}

export function resolveTutorLearningMode({
  hasLinkedUnit,
  latestSubmissionType,
  learnerIntent = "follow_up",
  sessionIntent = "",
  latestStudentMessage = ""
}) {
  if (hasLinkedUnit) {
    return latestSubmissionType === "initial_prompt"
      ? "structured_lesson_opening"
      : "structured_lesson_continuation";
  }

  if (learnerIntent === "correction_challenge" && latestSubmissionType !== "initial_prompt") {
    return "quick_clarification";
  }
  if (latestSubmissionType === "attempt" || learnerIntent === "work_attempt") {
    return "attempt_feedback";
  }
  if (latestSubmissionType !== "initial_prompt" && learnerIntent === "clarification") {
    return "quick_clarification";
  }

  if (sessionIntent === "solve_problem") return "problem_solving";

  if (sessionIntent === "understand_concept" || sessionIntent === "learn_topic") {
    if (latestSubmissionType === "initial_prompt" || learnerIntent === "direct_answer_request") {
      return "concept_mini_lesson";
    }
    return "adaptive_socratic";
  }

  const message = String(latestStudentMessage ?? "");
  if (
    latestSubmissionType === "initial_prompt" &&
    /\b(solve|calculate|compute|evaluate|work out|determine|find)\b/i.test(message) &&
    /\d|[=+*/^]|\b(equation|formula|problem)\b/i.test(message)
  ) return "problem_solving";
  if (
    latestSubmissionType === "initial_prompt" &&
    /\b(what is|define|explain|meaning of|teach me|help me understand)\b/i.test(message)
  ) return "concept_mini_lesson";

  return "adaptive_socratic";
}

export function buildTutorLearningFrameworkInstructions({ mode, learnerIntent }) {
  if (mode === "structured_lesson_opening") {
    return [
      "Apply Cogniva Tutor Learning Framework (CTL) v1.1 to this approved learning-plan unit.",
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
      "Continue the existing CTL lesson for an approved learning-plan unit. Use the conversation as evidence of what has already been taught; do not restart the lesson or repeat full sections unnecessarily.",
      "Keep explanations detailed enough to resolve the current difficulty, but focus each reply on one instructional move and one learner-facing question.",
      "Use progressive scaffolding: first give a directional hint, then recall a relevant principle, then break the task into a smaller step, and reveal a partial or full solution only when needed or explicitly requested.",
      "When the learner can explain or apply the guided step, reduce support and offer a different independent-practice question. Interleave related problem types when appropriate so the learner must choose a method.",
      "When asked to recap, retrieve, or review, summarize the key principles and equations and ask one short recall question. Do not mark the unit complete or the learner mastered from conversation alone.",
      "Use real applications where relevant. Clearly label hypothetical examples and never fabricate sources, experimental data, course requirements, or validation."
    ];
    if (intent === "clarification") {
      instructions.push("This turn is a clarification: answer the exact question directly, change representation if useful, and do not advance the teaching sequence merely because a reply was generated.");
    } else if (intent === "work_attempt") {
      instructions.push("This turn contains a learner attempt: preserve correct reasoning, identify the first unsupported or incorrect step, explain why, and ask for one revised step before providing more help.");
    } else if (intent === "direct_answer_request") {
      instructions.push("The learner explicitly requested a complete answer: respect that request, provide a complete worked explanation, and do not withhold the answer merely to enforce a teaching stage.");
    } else if (intent === "correction_challenge") {
      instructions.push("The learner is challenging a previous claim: reassess it using only available evidence, correct any supported error, and do not advance until the challenged point is addressed.");
    }
    return instructions.join(" ");
  }

  if (mode === "concept_mini_lesson") {
    return [
      "Teach the standalone concept as a concise but substantive mini-lesson, not as a one-line Socratic prompt.",
      "Use these exact Markdown headings in this order: Core idea; Explanation; Example; Check your understanding. Add a short Application section only when a genuine disciplinary or practical application materially helps.",
      "Start with a direct plain-language answer. Then explain the underlying principle, why or how it works, important conditions or assumptions, and one common misconception when relevant.",
      "Give one accurate, worked example or clear illustration. Show meaningful reasoning rather than only the final result. Label invented numerical scenarios as illustrative or hypothetical.",
      "Finish with one short checkpoint that tests understanding or transfer without revealing its answer. Ask exactly one learner-facing question as the final sentence.",
      "Adapt depth to the concept. Do not invent citations, measurements, course requirements, learner attributes, or claims of mastery."
    ].join(" ");
  }

  if (mode === "problem_solving") {
    return [
      "Teach the submitted problem through a clear problem-solving walkthrough, not a terse hint-only reply.",
      "Use these exact Markdown headings in this order: Understand the problem; Governing principle; Strategy; Work through the solution; Verify and interpret; Transfer check.",
      "Identify the givens, the required result, relevant conditions, and any assumptions. Name the governing law, theorem, formula, or principle and explain why it applies.",
      "State the solution strategy before calculations. Work step by step, explain each transformation, preserve units, and distinguish exact results from rounded approximations.",
      "Check arithmetic, units, signs, dimensions, and whether the result is consistent with the stated conditions. Do not claim broader physical or factual verification than the available checks support.",
      "If required information is missing or the prompt is ambiguous, do not invent it or force a numerical answer. State what is known, identify the missing information under the relevant headings, and ask one precise clarifying question.",
      "Finish with one small transfer check or a question about the next meaningful step. Respect an explicit request for a complete worked solution."
    ].join(" ");
  }

  if (mode === "attempt_feedback") {
    return [
      "Respond specifically to the learner's submitted attempt; do not restart the lesson or merely provide a generic explanation.",
      "Separate what the learner did correctly from the first incorrect, incomplete, or unsupported step. Preserve valid reasoning and explain why the identified step needs attention.",
      "Use deterministic checks only when Cogniva reports that the exact calculation is within its supported arithmetic scope. Otherwise describe uncertainty and ask for the missing working rather than guessing.",
      "Choose one useful next action: ask the learner to revise a step, provide a progressive hint, or show the next worked step when explicitly requested or clearly needed.",
      "Do not infer a cognitive misconception or cause from an arithmetic mismatch alone. Do not claim mastery. End with exactly one focused learner-facing question."
    ].join(" ");
  }

  if (mode === "quick_clarification") {
    return [
      "Answer the learner's specific clarification directly and concisely; do not restart a lesson or force a full teaching template.",
      "Use a different representation, smaller example, or precise definition when that will resolve the question. Address a correction challenge by reassessing the exact disputed claim rather than agreeing or defending automatically.",
      "Do not advance a lesson or problem-solving sequence merely because you answered a question. End with one useful next question only when it genuinely helps."
    ].join(" ");
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
  if (isTruncated(finishReason)) return "The tutor response reached its output limit before completion.";

  const words = normalized.split(/\s+/).filter(Boolean);
  const questionIssue = validateQuestionEnding(normalized);
  if (questionIssue) return questionIssue;

  if (mode === "structured_lesson_opening") {
    if (words.length > 480 || normalized.length > 4_200) {
      return "The structured lesson opening exceeded Cogniva's lesson-response limit.";
    }
    const sectionsIssue = validateOrderedSections(normalized, STRUCTURED_SECTIONS, "The structured lesson opening");
    if (sectionsIssue) return sectionsIssue;
    const objectivesStart = normalized.indexOf("\n", findSectionIndex(normalized, STRUCTURED_SECTIONS[0]));
    const objectivesEnd = findSectionIndex(normalized, STRUCTURED_SECTIONS[1]);
    const objectivesText = objectivesStart >= 0 ? normalized.slice(objectivesStart + 1, objectivesEnd) : "";
    const objectiveCount = (objectivesText.match(/^\s*(?:[-*+]|\d+[.)])\s+\S.*$/gm) ?? []).length;
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

  if (mode === "concept_mini_lesson") {
    if (words.length > 260 || normalized.length > 2_500) {
      return "The concept mini-lesson exceeded Cogniva's response limit.";
    }
    const sectionsIssue = validateOrderedSections(normalized, CONCEPT_SECTIONS, "The concept mini-lesson");
    if (sectionsIssue) return sectionsIssue;
    if (numericMismatchCount > 0) {
      return "The concept mini-lesson contains a numeric claim that did not pass Cogniva's bounded arithmetic check.";
    }
    return null;
  }

  if (mode === "problem_solving") {
    if (words.length > 360 || normalized.length > 3_500) {
      return "The problem-solving response exceeded Cogniva's response limit.";
    }
    const sectionsIssue = validateOrderedSections(normalized, PROBLEM_SECTIONS, "The problem-solving response");
    if (sectionsIssue) return sectionsIssue;
    if (numericMismatchCount > 0) {
      return "The problem-solving response contains a numeric claim that did not pass Cogniva's bounded arithmetic check.";
    }
    return null;
  }

  if (mode === "attempt_feedback") {
    if (words.length > 190 || normalized.length > 1_700) {
      return "The attempt-feedback response exceeded Cogniva's response limit.";
    }
    if (numericMismatchCount > 0) {
      return "The attempt-feedback response contains a numeric claim that did not pass Cogniva's bounded arithmetic check.";
    }
    return null;
  }

  if (mode === "quick_clarification") {
    if (words.length > 120 || normalized.length > 1_100) {
      return "The clarification response exceeded Cogniva's response limit.";
    }
    return null;
  }

  return "Choose a valid Tutor learning mode.";
}
