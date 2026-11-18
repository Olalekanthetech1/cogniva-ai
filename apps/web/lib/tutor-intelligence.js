const MAX_EXPRESSION_LENGTH = 140;
const MAX_EXPRESSION_TOKENS = 64;
const MAX_ABS_VALUE = 1e15;

function tokenizeExpression(source) {
  if (typeof source !== "string" || source.length < 1 || source.length > MAX_EXPRESSION_LENGTH) {
    return null;
  }

  const normalized = source
    .replace(/[−–—]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/\u00a0/g, " ");

  const tokenPattern = /\s*(sqrt|sin|cos|tan|√|[()+\-*/^°]|(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)/iy;
  const tokens = [];
  let offset = 0;

  while (offset < normalized.length) {
    if (/^\s+$/.test(normalized.slice(offset))) break;
    tokenPattern.lastIndex = offset;
    const match = tokenPattern.exec(normalized);
    if (!match || match.index !== offset) return null;

    const token = match[1];
    if (/^(?:\d|\.)/.test(token)) {
      const validGrouping = /^\d+$/.test(token) ||
        /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(token) ||
        /^\d+(?:\.\d+)?$/.test(token) ||
        /^\.\d+$/.test(token);
      if (!validGrouping) return null;
      tokens.push({ type: "number", value: Number(token.replace(/,/g, "")) });
    } else {
      tokens.push({ type: "symbol", value: token.toLowerCase() });
    }

    offset = tokenPattern.lastIndex;
    if (tokens.length > MAX_EXPRESSION_TOKENS) return null;
  }

  return tokens.length ? tokens : null;
}

function parseExpressionTokens(tokens) {
  let index = 0;

  const peek = () => tokens[index]?.value ?? null;
  const take = () => tokens[index++];

  function parsePrimary() {
    const token = take();
    if (!token) throw new Error("Unexpected end of expression");

    if (token.type === "number") return token.value;

    if (token.value === "(") {
      const value = parseAdditive();
      if (peek() !== ")") throw new Error("Missing closing parenthesis");
      take();
      return value;
    }

    throw new Error("Expected a number or parenthesized expression");
  }

  function parseFunction(name) {
    let value;
    let angleHasDegree = false;
    if (peek() === "(") {
      take();
      value = parseAdditive();
      if (["sin", "cos", "tan"].includes(name) && peek() === "°") {
        take();
        angleHasDegree = true;
      }
      if (peek() !== ")") throw new Error("Missing function parenthesis");
      take();
    } else {
      value = parsePrimary();
    }

    if (name === "sqrt") return Math.sqrt(value);

    // Trigonometric functions are evaluated only when the input explicitly
    // marks the angle in degrees; unmarked units are ambiguous.
    if (!angleHasDegree) {
      if (peek() !== "°") throw new Error("Trigonometric angle unit is ambiguous");
      take();
    }
    const radians = (value * Math.PI) / 180;
    if (name === "sin") return Math.sin(radians);
    if (name === "cos") return Math.cos(radians);
    if (name === "tan") return Math.tan(radians);
    throw new Error("Unsupported function");
  }

  function parseUnary() {
    if (peek() === "+") {
      take();
      return parseUnary();
    }
    if (peek() === "-") {
      take();
      return -parseUnary();
    }
    if (peek() === "√") {
      take();
      return Math.sqrt(parseUnary());
    }
    if (["sqrt", "sin", "cos", "tan"].includes(peek())) {
      const name = take().value;
      return parseFunction(name);
    }
    return parsePower();
  }

  function parsePower() {
    const left = parsePrimary();
    if (peek() === "^") {
      take();
      return Math.pow(left, parseUnary());
    }
    return left;
  }

  function parseMultiplicative() {
    let value = parseUnary();
    while (true) {
      if (peek() === "*" || peek() === "/") {
        const operator = take().value;
        const right = parseUnary();
        value = operator === "*" ? value * right : value / right;
        continue;
      }

      // Juxtaposition is common in handwritten mathematics, e.g. 2(120)(140).
      const next = tokens[index];
      const beginsPrimary = next?.type === "number" ||
        ["(", "√", "sqrt", "sin", "cos", "tan"].includes(next?.value);
      if (!beginsPrimary) break;
      value *= parseUnary();
    }
    return value;
  }

  function parseAdditive() {
    let value = parseMultiplicative();
    while (peek() === "+" || peek() === "-") {
      const operator = take().value;
      const right = parseMultiplicative();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  try {
    const result = parseAdditive();
    if (index !== tokens.length || !Number.isFinite(result) || Math.abs(result) > MAX_ABS_VALUE) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

export function evaluateNumericExpression(expression) {
  const tokens = tokenizeExpression(expression);
  return tokens ? parseExpressionTokens(tokens) : null;
}

function normalizeNumber(value) {
  return Number(String(value).replace(/,/g, ""));
}

function decimalPlaces(value) {
  const decimal = String(value).replace(/,/g, "").split(".")[1];
  return Math.min(decimal?.length ?? 0, 8);
}

/**
 * Extract only explicit numeric equalities/approximations that the bounded
 * arithmetic parser can evaluate. Unsupported notation is deliberately ignored.
 */
function normalizeExplicitExpression(source) {
  const expression = String(source ?? "").trim();
  const separator = expression.indexOf(":");

  if (separator > 0 && separator <= 24) {
    const label = expression.slice(0, separator).trim();
    if (/^(hint|calculation|expression|result|check)$/i.test(label)) {
      return expression.slice(separator + 1).trim();
    }
  }

  return expression;
}

export function findNumericClaims(text) {
  if (typeof text !== "string" || !text.trim()) return [];

  const numberPattern = "[+-]?(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)";
  const pattern = new RegExp("([^=\\n]{1,140}?)\\s*(≈|≃|=)\\s*(" + numberPattern + ")", "g");
  const findings = [];
  const seen = new Set();

  for (const match of text.matchAll(pattern)) {
    const expression = normalizeExplicitExpression(match[1]);
    const operator = match[2];
    const claimedText = match[3];
    const computedValue = evaluateNumericExpression(expression);

    // Fail closed: evaluate the complete expression, never a parseable suffix
    // salvaged from surrounding natural-language prose.
    if (computedValue === null) continue;

    const claimedValue = normalizeNumber(claimedText);
    if (!Number.isFinite(claimedValue)) continue;

    const places = decimalPlaces(claimedText);
    const expectedText = computedValue.toFixed(places);
    const roundedExpectedValue = Number(expectedText);
    const difference = Math.abs(computedValue - claimedValue);
    const isCorrect = roundedExpectedValue === claimedValue;

    const key = expression + operator + claimedText;
    if (seen.has(key)) continue;
    seen.add(key);

    findings.push({
      expression,
      operator,
      claimedText,
      claimedValue,
      computedValue,
      difference,
      decimalPlaces: places,
      expectedText,
      isCorrect
    });
  }

  return findings;
}

export function findIncorrectNumericClaims(text) {
  return findNumericClaims(text).filter((claim) => !claim.isCorrect);
}

function extractLearnerProposedValues(text) {
  const number = "([+-]?(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+))";
  const patterns = [
    new RegExp("\\b(?:my\\s+)?(?:calculator|calculation)\\s+(?:gives|shows|displayed|displays|returns)\\s*(?:" + number + ")", "i"),
    new RegExp("\\b(?:my\\s+)?(?:answer|result|value)\\s*(?:is|was|=|:)\\s*(?:" + number + ")", "i"),
    new RegExp("\\bI\\s+(?:got|calculated|obtained|found)\\s*(?:" + number + ")", "i"),
    new RegExp("\\b(?:it|that)\\s+(?:is|equals|comes\\s+to)\\s*(?:" + number + ")", "i")
  ];

  const values = [];
  for (const pattern of patterns) {
    const match = String(text ?? "").match(pattern);
    if (match?.[1]) values.push(normalizeNumber(match[1]));
  }
  return values.filter(Number.isFinite);
}

function isCorrectionChallenge(text) {
  return /\b(incorrect|wrong|error|not correct|isn't correct|is not correct|i disagree|that can't be right|doesn't seem right|does not seem right|doesn't match|does not match)\b/i.test(String(text ?? ""));
}

function isDirectAnswerRequest(text) {
  return /\b(give|provide|show|tell me|just|what is|what's)\b.{0,45}\b(ans|answer|solution|result)\b/i.test(text) ||
    /\b(full|complete|worked)\s+(ans|answer|solution|working)\b/i.test(text) ||
    /\bsolve it completely\b/i.test(text);
}

function lastQuestion(text) {
  const source = String(text ?? "");
  const questionEnd = source.lastIndexOf("?");
  if (questionEnd < 0) return "";

  const sentenceStart = Math.max(
    source.lastIndexOf(".", questionEnd),
    source.lastIndexOf("!", questionEnd),
    source.lastIndexOf("?", questionEnd - 1),
    source.lastIndexOf("\n", questionEnd)
  );
  return source.slice(sentenceStart + 1, questionEnd + 1)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function analyzeTutorTurn({ messages, latestSubmissionType }) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  let latestStudentIndex = -1;

  for (let index = safeMessages.length - 1; index >= 0; index -= 1) {
    if (safeMessages[index]?.role === "student") {
      latestStudentIndex = index;
      break;
    }
  }

  const latestStudentMessage = latestStudentIndex >= 0
    ? String(safeMessages[latestStudentIndex].content ?? "")
    : "";
  const previousTutorMessages = latestStudentIndex >= 0
    ? safeMessages.slice(0, latestStudentIndex).filter((message) => message?.role === "tutor")
    : [];
  const unresolvedClaims = new Map();
  const tutorHistoryStart = Math.max(0, previousTutorMessages.length - 6);

  for (let index = tutorHistoryStart; index < previousTutorMessages.length; index += 1) {
    const claims = findNumericClaims(String(previousTutorMessages[index].content ?? ""));

    for (const candidate of claims) {
      const acknowledgedLater = previousTutorMessages.slice(index + 1).some((message) => {
        const laterText = String(message.content ?? "");
        const repeatsVerifiedValue = laterText.includes(candidate.expectedText);
        const acknowledgesCorrection = laterText.includes(candidate.claimedText) ||
          /\b(previous|earlier|rechecked|recalculated|correction|corrected|mistake|incorrect|wrong)\b/i.test(laterText);
        return repeatsVerifiedValue && acknowledgesCorrection;
      });

      if (!acknowledgedLater) {
        const key = candidate.expression + candidate.operator + candidate.claimedText;
        unresolvedClaims.set(key, candidate);
      }
    }
  }

  // Only auto-check a challenge when recent tutor history contains one
  // distinct unresolved numeric claim. Multiple claims are ambiguous.
  const latestTutorClaim = unresolvedClaims.size === 1
    ? unresolvedClaims.values().next().value
    : null;

  const learnerNumericMismatches = findIncorrectNumericClaims(latestStudentMessage);
  const learnerProposedValues = extractLearnerProposedValues(latestStudentMessage);
  for (const mismatch of learnerNumericMismatches) {
    if (!learnerProposedValues.includes(mismatch.claimedValue)) {
      learnerProposedValues.push(mismatch.claimedValue);
    }
  }
  const learnerValueMatches = latestTutorClaim
    ? learnerProposedValues.some((value) => {
        const places = latestTutorClaim.decimalPlaces;
        return Number(value.toFixed(places)) === Number(latestTutorClaim.expectedText);
      })
    : false;
  const correctionChallenge = isCorrectionChallenge(latestStudentMessage);
  const learnerValueDiffers = correctionChallenge && Boolean(latestTutorClaim) &&
    learnerProposedValues.length > 0 && !learnerValueMatches;
  const directAnswerRequest = isDirectAnswerRequest(latestStudentMessage);
  let learnerIntent = "follow_up";
  if (correctionChallenge) {
    learnerIntent = "correction_challenge";
  } else if (directAnswerRequest) {
    learnerIntent = "direct_answer_request";
  } else if (latestSubmissionType === "attempt") {
    learnerIntent = "work_attempt";
  } else if (/^(why|what|how|when|where|can you explain|could you explain)\b/i.test(latestStudentMessage.trim())) {
    learnerIntent = "clarification";
  }

  const tutorQuestions = previousTutorMessages
    .map((message) => lastQuestion(message.content))
    .filter(Boolean)
    .slice(-4);
  const questionCounts = new Map();
  for (const question of tutorQuestions) {
    questionCounts.set(question, (questionCounts.get(question) ?? 0) + 1);
  }
  const repeatedQuestionCount = Math.max(0, ...questionCounts.values());

  const correctionRequired = Boolean(latestTutorClaim) && correctionChallenge;

  return {
    learnerIntent,
    latestStudentMessage,
    latestTutorClaim,
    learnerNumericMismatches,
    learnerProposedValues,
    learnerValueMatches,
    learnerValueDiffers,
    correctionRequired,
    repeatedQuestionCount,
    previousTutorMessageCount: previousTutorMessages.length,
    latestSubmissionType: latestSubmissionType ?? "question"
  };
}

export function buildAdaptiveTutorInstructions(analysis) {
  const instructions = [
    "Choose the teaching move from the learner's latest action; do not follow a fixed script.",
    "Use the conversation history to avoid asking for information the learner has already supplied.",
    "Do not repeat a previous question or hint verbatim. If the learner is stuck or the same prompt has recurred, change representation and reduce the next step."
  ];

  if (analysis.learnerIntent === "correction_challenge") {
    instructions.push(
      "The learner is challenging a previous tutor claim. Reassess that exact claim before teaching forward. Do not defend it automatically or agree automatically. Show the check you can support; acknowledge and correct a confirmed tutor error. If the claim cannot be independently checked from available evidence, say that clearly and ask for the missing evidence."
    );
  } else if (analysis.learnerIntent === "direct_answer_request") {
    instructions.push(
      "The learner explicitly requested the answer or a complete solution. Respect that request: provide a concise worked explanation with the final result, rather than withholding it to force another Socratic step."
    );
  } else if (analysis.learnerIntent === "work_attempt") {
    instructions.push(
      "Evaluate the learner's submitted working step by step. Identify what is correct, isolate the first incorrect or missing step, and give the next useful action. Do not label an attempt as mastered."
    );
  } else if (analysis.learnerIntent === "clarification") {
    instructions.push(
      "Answer the learner's clarification directly. Use a different explanation or representation when the earlier one did not resolve the question."
    );
  } else {
    instructions.push(
      "Continue with one appropriately sized next step, based on the learner's current understanding rather than a predetermined sequence."
    );
  }

  if (analysis.repeatedQuestionCount >= 2) {
    instructions.push(
      "The recent tutor history contains a repeated question. Do not ask it again. Explicitly change approach: explain the operation, demonstrate a smaller example, or give a worked micro-step before asking a new question."
    );
  }

  if (analysis.learnerNumericMismatches?.length) {
    const claim = analysis.learnerNumericMismatches[0];
    instructions.push(
      "A deterministic arithmetic check of the learner's submitted working found a mismatch: " +
      claim.expression + " " + claim.operator + " " + claim.claimedText +
      " is inconsistent; the expression evaluates to " + claim.expectedText +
      ". Explain the precise arithmetic correction without dismissing any other correct reasoning."
    );
  }

  if (analysis.latestTutorClaim) {
    const claim = analysis.latestTutorClaim;
    instructions.push(
      claim.isCorrect
        ? "A deterministic check confirms the previous tutor's numeric claim: " +
          claim.expression + " " + claim.operator + " " + claim.claimedText +
          " is consistent with the computed value " + claim.expectedText +
          ". Explain this check clearly if the learner challenges it."
        : "A deterministic arithmetic check of a recent tutor message found a mismatch: " +
          claim.expression + " " + claim.operator + " " + claim.claimedText +
          " is inconsistent; the expression evaluates to " + claim.expectedText +
          ". Treat this check as authoritative for this numeric expression, correct the prior message before advancing, and do not repeat the incorrect value."
    );
  }

  if (analysis.repeatedQuestionCount >= 2) {
    instructions.push("Recent repeated tutor question count: " + analysis.repeatedQuestionCount + ".");
  }

  return instructions.join(" ");
}

export function buildVerifiedCorrectionResponse({ claim, learnerMessage }) {
  const expected = claim.expectedText;
  const proposedValues = extractLearnerProposedValues(learnerMessage);
  const learnerMatches = proposedValues.some((value) =>
    Number(value.toFixed(claim.decimalPlaces)) === Number(expected)
  );
  const proposedValue = proposedValues[0];

  if (claim.isCorrect) {
    if (proposedValue !== undefined && !learnerMatches) {
      return "I rechecked the numeric expression: " + claim.expression +
        " rounds to " + expected +
        ", so the previous tutor value " + claim.claimedText +
        " agrees at the displayed precision. The value you reported, " +
        proposedValue.toFixed(claim.decimalPlaces) +
        ", does not match this calculation. This check verifies arithmetic only; it does not verify units or the physical model. Would you like me to show the arithmetic step by step?";
    }
    return "I rechecked the numeric expression: " + claim.expression +
      " rounds to " + expected +
      ", so the previous tutor value " + claim.claimedText +
      " agrees at the displayed precision. This check verifies arithmetic only; it does not verify units or the physical model. Would you like me to show the arithmetic step by step?";
  }

  if (learnerMatches) {
    return "You're right to challenge the previous numeric claim. The bounded arithmetic check evaluates " +
      claim.expression + " to " + expected +
      ", not " + claim.claimedText +
      ". Your reported value matches this arithmetic result at the displayed precision. Units and the physical model still need separate checking. Shall we continue?";
  }

  return "I need to correct the previous numeric claim. The bounded arithmetic check evaluates " +
    claim.expression + " to " + expected +
    ", not " + claim.claimedText +
    ". This verifies the arithmetic expression only; it does not establish units or the physical model. Would you like to rework the step?";
}

export function buildNumericOutputCorrectionResponse(claim) {
  return "I checked that calculation before sending this step: " +
    claim.expression + " evaluates to " + claim.expectedText +
    ", not " + claim.claimedText +
    ". Use " + claim.expectedText +
    " for the next step. Would you like to continue with the corrected value?";
}
