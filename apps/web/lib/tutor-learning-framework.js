export const TUTOR_LEARNING_FRAMEWORK_VERSION = "ctl-1.2.0";

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

const MODE_OUTPUT_CONFIG = Object.freeze({
  adaptive_socratic: {
    label: "The adaptive Socratic response",
    maxOutputTokens: 240,
    maxWords: 80,
    maxCharacters: 1_200,
    responseLengthInstruction: "For ordinary adaptive Socratic turns, use up to 80 words.",
    requiredSections: null,
    rejectNumericMismatches: false,
    limitMessage: "The tutor response exceeded its concise-response limit."
  },
  structured_lesson_opening: {
    label: "The structured lesson opening",
    maxOutputTokens: 1_100,
    maxWords: 480,
    maxCharacters: 4_200,
    responseLengthInstruction: "For this structured lesson opening, use up to 480 words and include the required lesson sections.",
    requiredSections: STRUCTURED_SECTIONS,
    rejectNumericMismatches: true,
    limitMessage: "The structured lesson opening exceeded Cogniva's lesson-response limit.",
    mismatchMessage: "The structured lesson contains a numeric claim that did not pass Cogniva's bounded arithmetic check."
  },
  structured_lesson_continuation: {
    label: "The structured lesson reply",
    maxOutputTokens: 560,
    maxWords: 220,
    maxCharacters: 2_400,
    responseLengthInstruction: "For this linked-unit lesson continuation, use up to 220 words.",
    requiredSections: null,
    rejectNumericMismatches: false,
    limitMessage: "The structured lesson reply exceeded Cogniva's response limit."
  },
  concept_mini_lesson: {
    label: "The concept mini-lesson",
    maxOutputTokens: 700,
    maxWords: 260,
    maxCharacters: 2_500,
    responseLengthInstruction: "For this standalone concept mini-lesson, use up to 260 words and include the required concise teaching sections.",
    requiredSections: CONCEPT_SECTIONS,
    rejectNumericMismatches: true,
    limitMessage: "The concept mini-lesson exceeded Cogniva's response limit.",
    mismatchMessage: "The concept mini-lesson contains a numeric claim that did not pass Cogniva's bounded arithmetic check."
  },
  problem_solving: {
    label: "The problem-solving response",
    maxOutputTokens: 900,
    maxWords: 360,
    maxCharacters: 3_500,
    responseLengthInstruction: "For this problem-solving walkthrough, use up to 360 words and show the required reasoning and verification sections.",
    requiredSections: PROBLEM_SECTIONS,
    rejectNumericMismatches: true,
    limitMessage: "The problem-solving response exceeded Cogniva's response limit.",
    mismatchMessage: "The problem-solving response contains a numeric claim that did not pass Cogniva's bounded arithmetic check."
  },
  problem_solving_continuation: {
    label: "The problem-solving continuation",
    maxOutputTokens: 560,
    maxWords: 220,
    maxCharacters: 2_400,
    responseLengthInstruction: "For this problem-solving continuation, use up to 220 words and focus on the learner's current step without restarting the full walkthrough.",
    requiredSections: null,
    rejectNumericMismatches: false,
    limitMessage: "The problem-solving continuation exceeded Cogniva's response limit."
  },
  attempt_feedback: {
    label: "The attempt-feedback response",
    maxOutputTokens: 450,
    maxWords: 190,
    maxCharacters: 1_700,
    responseLengthInstruction: "For this attempt-feedback turn, use up to 190 words.",
    requiredSections: null,
    rejectNumericMismatches: true,
    limitMessage: "The attempt-feedback response exceeded Cogniva's response limit.",
    mismatchMessage: "The attempt-feedback response contains a numeric claim that did not pass Cogniva's bounded arithmetic check."
  },
  quick_clarification: {
    label: "The clarification response",
    maxOutputTokens: 280,
    maxWords: 120,
    maxCharacters: 1_100,
    responseLengthInstruction: "For this focused assistance turn, use up to 120 words.",
    requiredSections: null,
    rejectNumericMismatches: false,
    limitMessage: "The clarification response exceeded Cogniva's response limit."
  }
});

export function getTutorLearningModeConfig(mode) {
  return MODE_OUTPUT_CONFIG[mode] ?? MODE_OUTPUT_CONFIG.adaptive_socratic;
}

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
  latestStudentMessage = "",
  requestedLearningMode = null
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
  if (
    latestSubmissionType !== "initial_prompt" &&
    ["clarification", "hint_request", "simplification_request", "example_request", "recap_request"].includes(learnerIntent)
  ) {
    return "quick_clarification";
  }
  if (requestedLearningMode) return requestedLearningMode;

  if (sessionIntent === "solve_problem") {
    if (latestSubmissionType === "initial_prompt" || learnerIntent === "direct_answer_request") {
      return "problem_solving";
    }
    return "problem_solving_continuation";
  }

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

function appendTurnActionGuidance(instructions, learnerIntent) {
  const actionGuidance = {
    hint_request: [
      "The learner explicitly asks for a hint. Give only the next useful hint, not the complete solution, unless they also clearly request the full answer.",
      "Use the visible conversation to choose an appropriate next level: direction, recall of a relevant principle, a smaller scaffold, then a near-solution step. Do not repeat a hint already given.",
      "This progression is inferred from conversation context; do not claim a persisted hint stage or mastery record."
    ],
    simplification_request: [
      "The learner asks for a simpler explanation. Re-explain the same point using plainer language, a different representation, or a smaller step.",
      "Do not merely repeat the previous wording or remove important technical conditions."
    ],
    example_request: [
      "The learner asks for an example. Provide a new, relevant example that is not already used in the conversation, and explain the key reasoning.",
      "Label a constructed numerical scenario as illustrative; do not invent measurements or real-world findings."
    ],
    recap_request: [
      "The learner asks for a recap. Summarize only what the conversation actually covered, identify any unresolved point, and ask one useful recall question.",
      "Do not infer that the learner has mastered or completed the material."
    ]
  };
  const guidance = actionGuidance[learnerIntent];
  return guidance ? instructions + " " + guidance.join(" ") : instructions;
}

export function buildTutorLearningFrameworkInstructions({ mode, learnerIntent }) {
  let instructions;

  if (mode === "structured_lesson_opening") {
    instructions = [
      "Apply Cogniva Tutor Learning Framework (CTL) v1.2 to this approved learning-plan unit.",
      "Write one coherent lesson opening in Markdown using these exact headings, in this order: Learning objectives; Detailed explanation; Worked example; Practical application; Guided practice.",
      "State 2–4 measurable learning objectives. Explain the core idea accurately, moving from intuition to formal definitions, principles, equations, assumptions, and common misconceptions where relevant.",
      "In Worked example, state what is given and required, explain the method, show each meaningful step and why it is valid, then check the result. For a non-numeric subject, work through a complete argument, experiment, design decision, or analysis instead.",
      "In Practical application, connect the concept to a genuine disciplinary or real-world use. Do not invent research, measurements, citations, or experimental findings. Label any constructed numerical scenario as illustrative or hypothetical.",
      "In Guided practice, give exactly one new, unworked checkpoint that the learner can attempt. Use that first response to gauge prior knowledge; do not claim to have diagnosed the learner before they answer.",
      "Do not reveal the guided-practice answer. Keep the explanation sufficiently detailed to teach, but avoid unrelated digressions. Ask exactly one question, as the final sentence.",
      "Do not claim lesson completion, mastery, verified syllabus coverage, or academic validation."
    ].join(" ");
  } else if (mode === "structured_lesson_continuation") {
    const continuation = [
      "Continue the existing CTL lesson for an approved learning-plan unit. Use the conversation as evidence of what has already been taught; do not restart the lesson or repeat full sections unnecessarily.",
      "Keep explanations detailed enough to resolve the current difficulty, but focus each reply on one instructional move and one learner-facing question.",
      "Use progressive scaffolding: first give a directional hint, then recall a relevant principle, then break the task into a smaller step, and reveal a partial or full solution only when needed or explicitly requested.",
      "When the learner can explain or apply the guided step, reduce support and offer a different independent-practice question. Interleave related problem types when appropriate so the learner must choose a method.",
      "When asked to recap, retrieve, or review, summarize the key principles and equations and ask one short recall question. Do not mark the unit complete or the learner mastered from conversation alone.",
      "Use real applications where relevant. Clearly label hypothetical examples and never fabricate sources, experimental data, course requirements, or validation."
    ];
    if (learnerIntent === "clarification") {
      continuation.push("This turn is a clarification: answer the exact question directly, change representation if useful, and do not advance the teaching sequence merely because a reply was generated.");
    } else if (learnerIntent === "work_attempt") {
      continuation.push("This turn contains a learner attempt: preserve correct reasoning, identify the first unsupported or incorrect step, explain why, and ask for one revised step before providing more help.");
    } else if (learnerIntent === "direct_answer_request") {
      continuation.push("The learner explicitly requested a complete answer: respect that request, provide a complete worked explanation, and do not withhold the answer merely to enforce a teaching stage.");
    } else if (learnerIntent === "correction_challenge") {
      continuation.push("The learner is challenging a previous claim: reassess it using only available evidence, correct any supported error, and do not advance until the challenged point is addressed.");
    }
    instructions = continuation.join(" ");
  } else if (mode === "concept_mini_lesson") {
    instructions = [
      "Teach the standalone concept as a concise but substantive mini-lesson, not as a one-line Socratic prompt.",
      "Use these exact Markdown headings in this order: Core idea; Explanation; Example; Check your understanding. Add a short Application section only when a genuine disciplinary or practical application materially helps.",
      "Start with a direct plain-language answer. Then explain the underlying principle, why or how it works, important conditions or assumptions, and one common misconception when relevant.",
      "Give one accurate, worked example or clear illustration. Show meaningful reasoning rather than only the final result. Label invented numerical scenarios as illustrative or hypothetical.",
      "Finish with one short checkpoint that tests understanding or transfer without revealing its answer. Ask exactly one learner-facing question as the final sentence.",
      "Adapt depth to the concept. Do not invent citations, measurements, course requirements, learner attributes, or claims of mastery."
    ].join(" ");
  } else if (mode === "problem_solving") {
    instructions = [
      "Teach the submitted problem through a clear problem-solving walkthrough, not a terse hint-only reply.",
      "Use these exact Markdown headings in this order: Understand the problem; Governing principle; Strategy; Work through the solution; Verify and interpret; Transfer check.",
      "Identify the givens, the required result, relevant conditions, and any assumptions. Name the governing law, theorem, formula, or principle and explain why it applies.",
      "State the solution strategy before calculations. Work step by step, explain each transformation, preserve units, and distinguish exact results from rounded approximations.",
      "Check arithmetic, units, signs, dimensions, and whether the result is consistent with the stated conditions. Do not claim broader physical or factual verification than the available checks support.",
      "If required information is missing or the prompt is ambiguous, do not invent it or force a numerical answer. State what is known, identify the missing information under the relevant headings, and ask one precise clarifying question.",
      "Finish with one small transfer check or a question about the next meaningful step. Respect an explicit request for a complete worked solution."
    ].join(" ");
  } else if (mode === "problem_solving_continuation") {
    instructions = [
      "Continue the existing problem-solving conversation from the actual last agreed step. Do not repeat the full problem statement, governing principle, or complete six-part walkthrough unless the learner asks for a recap or complete solution.",
      "Address the learner's latest question or next step directly. Preserve the known givens, assumptions, notation, units, and any correctly established intermediate results from the conversation.",
      "Explain only the next useful piece of reasoning, make any necessary local arithmetic or dimensional check within supported capabilities, and state uncertainty when the available information is insufficient.",
      "Adapt to the learner's current action, use hints or a smaller example when requested, and do not claim independent verification beyond the checks actually performed.",
      "Ask exactly one focused question at the end when a response from the learner is useful."
    ].join(" ");
  } else if (mode === "attempt_feedback") {
    instructions = [
      "Respond specifically to the learner's submitted attempt; do not restart the lesson or merely provide a generic explanation.",
      "Separate what the learner did correctly from the first incorrect, incomplete, or unsupported step. Preserve valid reasoning and explain why the identified step needs attention.",
      "Use deterministic checks only when Cogniva reports that the exact calculation is within its supported arithmetic scope. Otherwise describe uncertainty and ask for the missing working rather than guessing.",
      "Choose one useful next action: ask the learner to revise a step, provide a progressive hint, or show the next worked step when explicitly requested or clearly needed.",
      "Do not infer a cognitive misconception or cause from an arithmetic mismatch alone. Do not claim mastery. End with exactly one focused learner-facing question."
    ].join(" ");
  } else if (mode === "quick_clarification") {
    instructions = [
      "Answer the learner's specific clarification directly and concisely; do not restart a lesson or force a full teaching template.",
      "Use a different representation, smaller example, or precise definition when that will resolve the question. Address a correction challenge by reassessing the exact disputed claim rather than agreeing or defending automatically.",
      "Do not advance a lesson or problem-solving sequence merely because you answered a question. End with exactly one concise question focused on the clarification; do not use it to force an unrelated next task."
    ].join(" ");
  } else {
    instructions = [
      "Use Cogniva's adaptive Socratic dialogue for this direct question or problem.",
      "Choose the most useful next instructional move from the learner's latest message and the saved conversation, rather than following a fixed turn script.",
      "Do not force a multi-stage lesson when the learner needs a focused clarification or worked problem."
    ].join(" ");
  }

  return appendTurnActionGuidance(instructions, learnerIntent);
}

export function validateTutorLearningOutput({
  text,
  finishReason,
  mode,
  numericMismatchCount = 0
}) {
  if (!Object.hasOwn(MODE_OUTPUT_CONFIG, mode)) {
    return "Choose a valid Tutor learning mode.";
  }

  const normalized = typeof text === "string" ? text.trim() : "";
  if (!normalized) return "The tutor returned an empty response.";
  if (isTruncated(finishReason)) return "The tutor response reached its output limit before completion.";

  const config = getTutorLearningModeConfig(mode);
  const words = normalized.split(/\s+/).filter(Boolean);
  const questionIssue = validateQuestionEnding(normalized);
  if (questionIssue) return questionIssue;

  if (words.length > config.maxWords || normalized.length > config.maxCharacters) {
    return config.limitMessage;
  }

  if (config.requiredSections) {
    const sectionsIssue = validateOrderedSections(normalized, config.requiredSections, config.label);
    if (sectionsIssue) return sectionsIssue;
  }

  if (mode === "structured_lesson_opening") {
    const objectivesStart = normalized.indexOf("\n", findSectionIndex(normalized, STRUCTURED_SECTIONS[0]));
    const objectivesEnd = findSectionIndex(normalized, STRUCTURED_SECTIONS[1]);
    const objectivesText = objectivesStart >= 0 ? normalized.slice(objectivesStart + 1, objectivesEnd) : "";
    const objectiveCount = (objectivesText.match(/^\s*(?:[-*+]|\d+[.)])\s+\S.*$/gm) ?? []).length;
    if (objectiveCount < 2 || objectiveCount > 4) {
      return "The structured lesson must state between two and four list-form learning objectives.";
    }
  }

  if (config.rejectNumericMismatches && numericMismatchCount > 0) {
    return config.mismatchMessage;
  }

  return null;
}
