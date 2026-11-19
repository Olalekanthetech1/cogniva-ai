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

function classifyLearnerAttempt(submissionType, mismatches) {
  if (submissionType !== "attempt" || !Array.isArray(mismatches) || mismatches.length === 0) {
    return null;
  }

  const evidenceLimit = 5;
  const evidence = mismatches.slice(0, evidenceLimit);

  return {
    status: "verified_mismatch",
    classification: mismatches.length === 1
      ? "arithmetic_result_mismatch"
      : "multiple_arithmetic_result_mismatches",
    method: "bounded_arithmetic_expression",
    mismatchCount: mismatches.length,
    mismatches: evidence,
    omittedMismatchCount: Math.max(0, mismatches.length - evidence.length)
  };
}

export function buildLearnerArithmeticFeedback(errorAnalysis) {
  if (
    errorAnalysis?.classification !== "arithmetic_result_mismatch" ||
    errorAnalysis.mismatchCount !== 1 ||
    !Array.isArray(errorAnalysis.mismatches) ||
    errorAnalysis.mismatches.length !== 1
  ) {
    return null;
  }

  const mismatch = errorAnalysis.mismatches[0];
  const evaluationPhrase = mismatch.operator === "="
    ? "evaluates to"
    : "rounds to";

  return "I checked the arithmetic statement: " + mismatch.expression + " " +
    mismatch.operator + " " + mismatch.claimedText + ". The expression " +
    evaluationPhrase + " " + mismatch.expectedText + ", not " + mismatch.claimedText +
    ". This confirms an arithmetic-result mismatch only; it does not identify which reasoning step caused it or verify units or the physical model. Re-evaluate this expression one operation at a time, following the normal order of operations. What value do you get?";
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

function inferRequestedLearningMode(text, latestSubmissionType) {
  if (latestSubmissionType === "initial_prompt") return null;
  const source = String(text ?? "").trim();

  const requestsNewProblem = /\b(?:now|next|instead|please|let'?s|let us|can we|could we|switch to|move on to)\b[\s\S]{0,55}\b(?:solve|work through|calculate|compute|derive|evaluate|prove)\b/i.test(source) ||
    /\bnew\s+(?:problem|exercise)\b/i.test(source);
  const hasProblemEvidence = /\d|[=+*/^]|\b(?:problem|equation|exercise|expression)\b/i.test(source);
  if (requestsNewProblem && hasProblemEvidence) return "problem_solving";

  const requestsNewConcept = /\bnew\s+(?:topic|concept)\b/i.test(source) ||
    /\bswitch to (?:a )?(?:new )?(?:topic|concept)\b/i.test(source) ||
    /\bmove on to (?:a )?(?:new )?(?:topic|concept)\b/i.test(source) ||
    /\b(?:let'?s|let us) learn\b/i.test(source) ||
    /\bteach me about\b/i.test(source) ||
    /\bnow\b[\s\S]{0,35}\b(?:learn|study|teach|cover)\b/i.test(source);
  if (requestsNewConcept) return "concept_mini_lesson";

  return null;
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


const PAIR_NUMBER_PATTERN = "[+-]?(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)";
const PAIR_VARIABLE_PATTERN = "[A-Za-z](?:\\s*_\\s*\\{?\\d+\\}?|\\d+)?";

function normalizePairVariable(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/_\{?(\d+)\}?/g, "_$1")
    .toLowerCase();
}
function formatNumericValue(value) {
  if (Number.isInteger(value)) return String(value);
  return Number(value.toPrecision(12)).toString();
}

/**
 * Recognize only the explicit two-variable constraint pair:
 * x^2 + y^2 = A and xy = B.
 * This supports a necessary-and-sufficient real-pair feasibility check,
 * but is deliberately not a general symbolic algebra parser.
 */
function findRealPairFeasibility(messages) {
  const text = (Array.isArray(messages) ? messages : [])
    .map((message) => String(message?.content ?? ""))
    .join("\n");
  const normalizedText = text
    .replace(/\$/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·");

  const pairCandidates = new Map();
  const sumSquaresPattern = new RegExp(
    "(" + PAIR_VARIABLE_PATTERN + ")\\s*(?:\\^\\s*\\{?2\\}?|²)\\s*\\+\\s*" +
    "(" + PAIR_VARIABLE_PATTERN + ")\\s*(?:\\^\\s*\\{?2\\}?|²)\\s*=\\s*(" +
    PAIR_NUMBER_PATTERN + ")",
    "gi"
  );

  for (const match of normalizedText.matchAll(sumSquaresPattern)) {
    const first = normalizePairVariable(match[1]);
    const second = normalizePairVariable(match[2]);
    if (!first || !second || first === second) continue;

    const variables = [first, second].sort();
    const key = variables.join("|");
    const existing = pairCandidates.get(key) ?? {
      variables,
      displayVariables: [match[1].replace(/\s+/g, ""), match[2].replace(/\s+/g, "")],
      sumSquaresValues: new Set()
    };
    existing.sumSquaresValues.add(Number(match[3].replace(/,/g, "")));
    pairCandidates.set(key, existing);
  }

  const resolved = [];
  for (const candidate of pairCandidates.values()) {
    if (candidate.sumSquaresValues.size !== 1) continue;

    const [first, second] = candidate.variables;
    const productPattern = new RegExp(
      first + "\\s*(?:(?:\\*|×|·)\\s*)?\\s*" +
      second + "\\s*=\\s*(" + PAIR_NUMBER_PATTERN + ")|" +
      second + "\\s*(?:(?:\\*|×|·)\\s*)?\\s*" +
      first + "\\s*=\\s*(" + PAIR_NUMBER_PATTERN + ")",
      "gi"
    );
    const productValues = new Set();

    for (const match of normalizedText.matchAll(productPattern)) {
      const valueText = match[1] ?? match[2];
      if (valueText !== undefined) productValues.add(Number(valueText.replace(/,/g, "")));
    }

    if (productValues.size !== 1) continue;
    const sumSquares = [...candidate.sumSquaresValues][0];
    const product = [...productValues][0];
    if (!Number.isFinite(sumSquares) || !Number.isFinite(product)) continue;

    const differenceSquare = sumSquares - 2 * product;
    const sumSquare = sumSquares + 2 * product;
    const tolerance = Math.max(1e-10, Math.abs(sumSquares) * 1e-12);
    const hasRealPair = sumSquares >= 2 * Math.abs(product) - tolerance;
    const forceMagnitudeContext = /\b(force|forces|magnitude|magnitudes)\b/i.test(text);
    const hasNonnegativePair = hasRealPair && product >= -tolerance;
    const possible = forceMagnitudeContext ? hasNonnegativePair : hasRealPair;

    let impossibleReason = null;
    if (sumSquares < -tolerance || !hasRealPair) {
      impossibleReason = "sum_of_squares_incompatible_with_product";
    } else if (forceMagnitudeContext && product < -tolerance) {
      impossibleReason = "negative_product_incompatible_with_nonnegative_magnitudes";
    }

    resolved.push({
      variables: candidate.displayVariables,
      sumSquares,
      product,
      sumSquare,
      differenceSquare,
      hasRealPair,
      hasNonnegativePair,
      forceMagnitudeContext,
      possible,
      impossibleReason
    });
  }

  return resolved.length === 1 ? resolved[0] : null;
}
function extractExplicitPromptExpression(text) {
  const source = String(text ?? "");
  const matches = [...source.matchAll(
    /\b(?:compute|calculate|evaluate|work\s+out|simplify)\s+(?:the\s+expression\s*)?([0-9][0-9,.\s()+\-*/×·÷^°]*?)(?=\s*(?:\$|[?!;,]|$))/gi
  )];
  if (matches.length !== 1) return null;

  const expression = matches[0][1].trim().replace(/[.,;]+$/, "").trim();
  if (!expression || evaluateNumericExpression(expression) === null) return null;
  return expression;
}
function extractSingleLearnerNumericAnswer(text) {
  const source = String(text ?? "").trim().replace(/^[$]+|[$]+$/g, "").trim();
  const bareAnswer = source.match(/^([+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+))[.!]?$/);
  if (bareAnswer) return normalizeNumber(bareAnswer[1]);

  const labelledValues = extractLearnerProposedValues(source);
  if (labelledValues.length === 1) return labelledValues[0];

  const claims = findNumericClaims(source);
  if (claims.length === 1) return claims[0].claimedValue;
  return null;
}
function isRealFeasibilityQuestion(text) {
  const source = String(text ?? "");
  return /\b(?:can|could|do|does|would)\b[\s\S]{0,90}\b(?:real|real-valued)\b[\s\S]{0,70}\b(?:solution|values?|roots?|numbers?|forces?|magnitudes?)\b/i.test(source) ||
    /\b(?:any|no)\s+real\s+(?:solution|values?|roots?|numbers?|forces?|magnitudes?)\b/i.test(source);
}
function resolveNumericAnswerEvaluation(input) {
  if (input.latestSubmissionType !== "attempt") return null;
  const latestTutorMessage = input.previousTutorMessages.at(-1);
  if (!latestTutorMessage) return null;

  const tutorText = String(latestTutorMessage.content ?? "");
  const pair = input.realPairFeasibility;
  let expression = extractExplicitPromptExpression(tutorText);
  let expectedValue = expression === null ? null : evaluateNumericExpression(expression);
  let method = "explicit_prompt_expression";

  if (expectedValue === null && pair) {
    const [first, second] = pair.variables;
    const firstSecondPattern = new RegExp(
      "\\(\\s*" + first + "\\s*\\+\\s*" + second + "\\s*\\)\\s*\\^\\s*\\{?2\\}?",
      "i"
    );
    const secondFirstPattern = new RegExp(
      "\\(\\s*" + second + "\\s*\\+\\s*" + first + "\\s*\\)\\s*\\^\\s*\\{?2\\}?",
      "i"
    );
    if (/\b(?:what|calculate|compute|find|determine)\b/i.test(tutorText) &&
        (firstSecondPattern.test(tutorText) || secondFirstPattern.test(tutorText))) {
      expression = formatNumericValue(pair.sumSquares) + " + 2(" +
        formatNumericValue(pair.product) + ")";
      expectedValue = pair.sumSquare;
      method = "verified_sum_of_squares_product_identity";
    } else if (/\bdiscriminant\b/i.test(tutorText) &&
        /\b(?:what|calculate|compute|find|determine)\b/i.test(tutorText)) {
      expression = formatNumericValue(pair.sumSquares) + " - 2(" +
        formatNumericValue(pair.product) + ")";
      expectedValue = pair.differenceSquare;
      method = "verified_quadratic_discriminant_from_pair_constraints";
    }
  }

  if (expectedValue === null || !Number.isFinite(expectedValue)) return null;
  const submittedValue = extractSingleLearnerNumericAnswer(input.latestStudentMessage);
  if (submittedValue === null || !Number.isFinite(submittedValue)) return null;

  const tolerance = Math.max(1e-9, Math.abs(expectedValue) * 1e-10);
  return {
    method,
    expression,
    expectedValue,
    expectedText: formatNumericValue(expectedValue),
    submittedValue,
    submittedText: formatNumericValue(submittedValue),
    isCorrect: Math.abs(submittedValue - expectedValue) <= tolerance
  };
}
export function buildNumericAnswerFeedback(evaluation) {
  if (evaluation.isCorrect) {
    return "Correct — " + evaluation.expression + " = " + evaluation.expectedText +
      ". That answers the calculation Cogniva just asked you to do, so we will move forward instead of repeating it. What would you do next with this result?";
  }

  return "Not quite. " + evaluation.expression + " evaluates to " + evaluation.expectedText +
    ", not " + evaluation.submittedText +
    ". Recheck the arithmetic and order of operations. What result do you get after recalculating?";
}

export function buildRealPairInconsistencyResponse(pair, answerEvaluation = null) {
  const first = pair.variables[0];
  const second = pair.variables[1];
  const sumSquares = formatNumericValue(pair.sumSquares);
  const product = formatNumericValue(pair.product);
  let opening = "";

  if (answerEvaluation) {
    opening = (answerEvaluation.isCorrect
      ? "Your answer is correct: "
      : "The requested calculation evaluates to " + answerEvaluation.expectedText +
        ", rather than " + answerEvaluation.submittedText + ". ") +
      answerEvaluation.expression + " = " + answerEvaluation.expectedText + ". ";
  }

  if (pair.differenceSquare < 0) {
    return opening +
      "There is an important consistency check: the equations require (" + first + " - " + second +
      ")^2 = " + sumSquares + " - 2(" + product + ") = " +
      formatNumericValue(pair.differenceSquare) +
      ". A square of a real number cannot be negative, so no real values satisfy both equations. Could one of the values in the original question be a typo?";
  }

  if (pair.impossibleReason === "negative_product_incompatible_with_nonnegative_magnitudes") {
    return opening +
      "The two quantities are force magnitudes, so both must be nonnegative. But their product is " +
      product + ", which is negative. No pair of nonnegative force magnitudes can satisfy both equations. Could one of the stated values be a typo?";
  }

  return opening +
    "For any two real values, the sum of their squares must be at least twice the absolute value of their product. The given equations violate that condition, so no real pair satisfies them. Could one of the values in the original question be a typo?";
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

  const realPairFeasibility = findRealPairFeasibility(safeMessages);
  const realFeasibilityQuestion = isRealFeasibilityQuestion(latestStudentMessage);
  const numericAnswerEvaluation = resolveNumericAnswerEvaluation({
    previousTutorMessages,
    latestStudentMessage,
    latestSubmissionType,
    realPairFeasibility
  });
  const learnerNumericMismatches = findIncorrectNumericClaims(latestStudentMessage);
  const normalizedSubmissionType = latestSubmissionType ?? "question";
  const learnerErrorAnalysis = classifyLearnerAttempt(
    normalizedSubmissionType,
    learnerNumericMismatches
  );
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
  const normalizedMessage = latestStudentMessage.trim();
  let learnerIntent = "follow_up";
  if (correctionChallenge) {
    learnerIntent = "correction_challenge";
  } else if (directAnswerRequest) {
    learnerIntent = "direct_answer_request";
  } else if (latestSubmissionType === "attempt") {
    learnerIntent = "work_attempt";
  } else if (latestSubmissionType !== "initial_prompt" && /\b(?:hint|clue|nudge|help me get started)\b/i.test(normalizedMessage)) {
    learnerIntent = "hint_request";
  } else if (latestSubmissionType !== "initial_prompt" && /\b(?:simplify|simpler|more simply|plain language|easier words|break (?:it|this) down)\b/i.test(normalizedMessage)) {
    learnerIntent = "simplification_request";
  } else if (latestSubmissionType !== "initial_prompt" && /\b(?:example|illustration|demonstration)\b/i.test(normalizedMessage)) {
    learnerIntent = "example_request";
  } else if (latestSubmissionType !== "initial_prompt" && /\b(?:recap|summari[sz]e|review|revise|revision|key points|remind me)\b/i.test(normalizedMessage)) {
    learnerIntent = "recap_request";
  } else if (/^(why|what|how|when|where|can you explain|could you explain)\b/i.test(normalizedMessage)) {
    learnerIntent = "clarification";
  }
  const requestedLearningMode = inferRequestedLearningMode(
    latestStudentMessage,
    latestSubmissionType
  );

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
    requestedLearningMode,
    latestStudentMessage,
    latestTutorClaim,
    learnerNumericMismatches,
    learnerErrorAnalysis,
    learnerProposedValues,
    learnerValueMatches,
    learnerValueDiffers,
    correctionRequired,
    realPairFeasibility,
    realFeasibilityQuestion,
    numericAnswerEvaluation,
    repeatedQuestionCount,
    previousTutorMessageCount: previousTutorMessages.length,
    latestSubmissionType: normalizedSubmissionType
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

  if (analysis.numericAnswerEvaluation) {
    const evaluation = analysis.numericAnswerEvaluation;
    instructions.push(
      "A bounded numeric-answer check compared the learner's single-number attempt with the explicit target in the immediately preceding tutor question. The expected value is " +
      evaluation.expectedText + " from " + evaluation.expression + ". Acknowledge the verified result, do not repeat the answered calculation, and do not claim mastery."
    );
  }

  if (analysis.realPairFeasibility && !analysis.realPairFeasibility.possible) {
    instructions.push(
      "The available conversation contains a supported pair of constraints that is inconsistent with real values. Explain only the derived contradiction shown by the bounded consistency check; do not invent a solution or generalize this check to unsupported equations."
    );
  }

  if (analysis.learnerErrorAnalysis?.classification === "multiple_arithmetic_result_mismatches") {
    const mismatches = analysis.learnerErrorAnalysis.mismatches ?? [];
    const evidence = mismatches.map((claim, index) =>
      (index + 1) + ") " + claim.expression + " " + claim.operator + " " +
      claim.claimedText + " (bounded result: " + claim.expectedText + ")"
    ).join("; ");
    instructions.push(
      "The learner submitted multiple explicit arithmetic statements that the bounded checker evaluated. Evidence in their written order: " +
      evidence + ". " +
      (analysis.learnerErrorAnalysis.omittedMismatchCount > 0
        ? analysis.learnerErrorAnalysis.omittedMismatchCount + " additional mismatch(es) were detected but are not expanded here. "
        : "") +
      "Treat these only as arithmetic-result mismatches, not as proof of a particular conceptual misconception or its cause. Start with the first listed mismatch, explain that calculation, preserve any correct reasoning, and ask for one revised step."
    );
  } else if (analysis.learnerErrorAnalysis?.classification === "arithmetic_result_mismatch") {
    const claim = analysis.learnerErrorAnalysis.mismatches[0];
    instructions.push(
      "The learner's explicit arithmetic statement " + claim.expression + " " +
      claim.operator + " " + claim.claimedText +
      " was checked by the bounded arithmetic evaluator and the result is " +
      claim.expectedText + ". This proves an arithmetic-result mismatch only; it does not establish the learner's underlying misconception or cause. Explain the exact discrepancy without inventing a cause, preserve any correct reasoning, and ask the learner to recalculate that expression."
    );
  } else if (analysis.latestSubmissionType === "attempt") {
    instructions.push(
      "No supported numeric mismatch was established by Cogniva's deterministic checker for this attempt. Do not label the work correct or incorrect on that basis, and do not invent a misconception. Inspect only what the submitted evidence supports; ask for a clearer single step when needed."
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
