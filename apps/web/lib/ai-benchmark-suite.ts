import type { AiProviderId, AiTaskKey } from "@/lib/admin-ai-config";

export type AiBenchmarkCandidate = {
  id: string;
  provider: AiProviderId;
  label: string;
  model: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  pricingReviewedAt: string;
  pricingEffectiveThrough: string | null;
  pricingSource: string;
};

export type AiBenchmarkCase = {
  id: string;
  title: string;
  task: AiTaskKey;
  userPrompt: string;
  maxOutputTokens: number;
  reviewCriteria: readonly string[];
  expectedSignals: readonly string[];
  failureSignals: readonly string[];
};

export const AI_BENCHMARK_SUITE_VERSION = "cogniva-core-2026-11-18-v1";
export const AI_BENCHMARK_PRICING_SNAPSHOT = "usd-2026-11-18-v1";

export const AI_BENCHMARK_CANDIDATES = [
  {
    id: "gemini-38-flash",
    provider: "gemini",
    label: "Gemini 3.8 Flash",
    model: "gemini-3.8-flash",
    inputUsdPerMillion: 0.75,
    outputUsdPerMillion: 3.75,
    pricingReviewedAt: "2026-11-18",
    pricingEffectiveThrough: "2026-12-31",
    pricingSource: "https://ai.google.dev/gemini-api/docs/latest-model"
  },
  {
    id: "groq-gpt-oss-120b",
    provider: "groq",
    label: "GPT-OSS 120B on Groq",
    model: "openai/gpt-oss-120b",
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
    pricingReviewedAt: "2026-11-18",
    pricingEffectiveThrough: null,
    pricingSource: "https://console.groq.com/docs/model/openai/gpt-oss-120b"
  },
  {
    id: "mistral-large-4",
    provider: "mistral",
    label: "Mistral Large 4",
    model: "mistral-large-4-0",
    inputUsdPerMillion: 0.7,
    outputUsdPerMillion: 2.1,
    pricingReviewedAt: "2026-11-18",
    pricingEffectiveThrough: null,
    pricingSource: "https://docs.mistral.ai/models/mistral-large-4-0"
  }
] as const satisfies readonly AiBenchmarkCandidate[];

const learningPlanReviewCriteria = [
  "Valid JSON and the required learning-plan structure",
  "Coverage of the exact topic and stated learner level",
  "Specific, observable, measurable learning objectives",
  "Coherent sequencing and explicit prerequisite relationships",
  "Factual accuracy and absence of unsupported learner assumptions"
] as const;

const tutoringReviewCriteria = [
  "Uses one manageable Socratic next step rather than solving everything",
  "Addresses the learner's actual latest response",
  "Preserves the current problem and prior context",
  "Provides a useful, content-specific hint and a clear question",
  "Is factually correct and makes no unsupported verification claims"
] as const;

export const AI_BENCHMARK_SYSTEM_PROMPTS: Record<AiTaskKey, string> = {
  learning_plan_generation: [
    "You are generating a benchmark learning plan for Cogniva, a global learning platform.",
    "Use only the learner context supplied in the case. Do not invent an institution, curriculum, exam board, or prior achievement.",
    "Return one valid JSON object only. Do not use Markdown fences or add commentary.",
    "The object must have: title (string), topic (string), learnerLevel (string), and units (array).",
    "Include exactly 3 ordered units. Each unit must have: title (string), objectives (array of 2 or 3 measurable strings), concepts (array of 2 to 4 strings), prerequisites (array of strings), and estimatedMinutes (positive integer).",
    "Keep the plan appropriate to the stated time budget and level. Avoid claiming that a learner has mastered anything."
  ].join(" "),
  socratic_tutor_response: [
    "You are Cogniva, a Socratic tutor. Respond to the learner's latest message using the supplied problem and conversation context.",
    "Give exactly one small next step, not a complete solution and not a multi-step lecture.",
    "Include one concise, content-specific hint and end with one clear question the learner can answer.",
    "Do not reveal the final answer. Do not pretend to have checked work the learner has not shown.",
    "Use at most 80 words. Be respectful, precise, and appropriate to the learner's level."
  ].join(" ")
};

export const AI_BENCHMARK_CASES = {
  learning_plan_generation: [
    {
      id: "lp-001-linear-equations",
      title: "Beginner algebra: linear equations",
      task: "learning_plan_generation",
      userPrompt: [
        "Create a three-unit learning plan for a beginner who wants to solve linear equations in one variable.",
        "The learner can do basic arithmetic but has not studied algebra formally.",
        "Available study time: four 30-minute sessions.",
        "The plan must progress from the meaning of a variable and equality, through inverse operations, to checking solutions by substitution."
      ].join(" "),
      maxOutputTokens: 850,
      reviewCriteria: learningPlanReviewCriteria,
      expectedSignals: [
        "Starts with variables and the meaning of equality",
        "Introduces inverse operations before multi-step equations",
        "Includes substitution as a way to check a proposed solution",
        "Objectives describe observable learner actions"
      ],
      failureSignals: [
        "Presents multi-step equations before explaining equality or inverse operations",
        "Contains mathematically incorrect algebra",
        "Claims the learner has mastered a topic"
      ]
    },
    {
      id: "lp-002-materials-stress-strain",
      title: "Introductory engineering: stress and strain",
      task: "learning_plan_generation",
      userPrompt: [
        "Create a three-unit introductory learning plan on mechanical stress and strain for a first-time engineering learner.",
        "Assume only basic algebra and familiarity with force and length; do not assume prior materials-science coursework.",
        "Available study time: three 40-minute sessions.",
        "Cover force, cross-sectional area, normal stress, tensile strain, units, and the distinction between stress and strain.",
        "Do not provide instructions for operating laboratory equipment."
      ].join(" "),
      maxOutputTokens: 850,
      reviewCriteria: learningPlanReviewCriteria,
      expectedSignals: [
        "Defines normal stress as force per unit area",
        "Defines tensile strain as change in length relative to original length",
        "Distinguishes stress units from dimensionless strain",
        "Sequences physical meaning before calculation practice"
      ],
      failureSignals: [
        "Confuses stress with strain or gives incorrect units",
        "Assumes access to specialist equipment or prior laboratory training",
        "Includes unsafe or unnecessary equipment-operation instructions"
      ]
    },
    {
      id: "lp-003-descriptive-statistics",
      title: "Lab data: descriptive statistics",
      task: "learning_plan_generation",
      userPrompt: [
        "Create a three-unit learning plan on descriptive statistics for a university learner who needs to summarize a small laboratory measurement dataset.",
        "Assume basic arithmetic only.",
        "Available study time: three 30-minute sessions.",
        "Cover mean, median, range, variance, standard deviation, and how to describe variation without claiming that descriptive statistics prove causation."
      ].join(" "),
      maxOutputTokens: 850,
      reviewCriteria: learningPlanReviewCriteria,
      expectedSignals: [
        "Explains centre and spread as distinct ideas",
        "Sequences simple summaries before variance and standard deviation",
        "Includes interpretation of variation in measured data",
        "Avoids causal conclusions from descriptive statistics alone"
      ],
      failureSignals: [
        "Defines variance or standard deviation incorrectly",
        "Treats the mean as always representative despite outliers",
        "Claims descriptive statistics establish causation"
      ]
    }
  ],
  socratic_tutor_response: [
    {
      id: "st-001-linear-equation-error",
      title: "Algebra: incorrect inverse operation",
      task: "socratic_tutor_response",
      userPrompt: [
        "Problem: Solve 3x + 5 = 20.",
        "Conversation so far: The tutor asked what operation could isolate the term 3x. The learner replied: 'I subtract 5, so 3x = 25.'",
        "Learner's latest message: 'I think the answer is 25 divided by 3.'",
        "Respond to this latest message with one Socratic next step. Do not give the value of x."
      ].join(" "),
      maxOutputTokens: 220,
      reviewCriteria: tutoringReviewCriteria,
      expectedSignals: [
        "Notices that subtracting 5 from 20 should reduce the right-hand side",
        "Asks the learner to apply the same operation to both sides",
        "Does not disclose the final value of x"
      ],
      failureSignals: [
        "Affirms 3x = 25",
        "Gives the final numerical solution",
        "Changes to a different equation"
      ]
    },
    {
      id: "st-002-power-rule-misconception",
      title: "Calculus: power-rule misconception",
      task: "socratic_tutor_response",
      userPrompt: [
        "Problem: Differentiate f(x) = x^3.",
        "Conversation so far: The learner has been introduced to the power rule.",
        "Learner's latest message: 'I multiply by 3, so the derivative is 3x.'",
        "Respond with one Socratic next step that helps the learner reconsider what happens to the exponent. Do not state the final derivative."
      ].join(" "),
      maxOutputTokens: 220,
      reviewCriteria: tutoringReviewCriteria,
      expectedSignals: [
        "Focuses on both the coefficient and the new exponent",
        "Prompts the learner to reduce the exponent by one",
        "Does not state the final derivative"
      ],
      failureSignals: [
        "Says the derivative is 3x",
        "Gives the complete final derivative",
        "Introduces unrelated differentiation rules"
      ]
    },
    {
      id: "st-003-stress-vs-strain",
      title: "Materials science: stress versus strain",
      task: "socratic_tutor_response",
      userPrompt: [
        "Question: What is the difference between normal stress and tensile strain?",
        "Conversation so far: The tutor asked the learner to compare the physical meaning and units of each quantity.",
        "Learner's latest message: 'They both measure how much a material stretches, so I think they are the same thing.'",
        "Respond with one Socratic next step. Help the learner distinguish applied force per area from relative change in length, but do not provide a full textbook explanation."
      ].join(" "),
      maxOutputTokens: 220,
      reviewCriteria: tutoringReviewCriteria,
      expectedSignals: [
        "Separates the cause (applied force per area) from the relative deformation",
        "Uses units as a useful distinction",
        "Asks the learner to reason about one distinction"
      ],
      failureSignals: [
        "Says stress and strain are identical",
        "Gives incorrect stress or strain units",
        "Responds with a long lecture rather than one next step"
      ]
    }
  ]
} as const satisfies Record<AiTaskKey, readonly AiBenchmarkCase[]>;

export function estimateBenchmarkCostUsd(
  candidate: AiBenchmarkCandidate,
  inputTokens: number | null,
  outputTokens: number | null
): number | null {
  if (
    inputTokens === null ||
    outputTokens === null ||
    !Number.isSafeInteger(inputTokens) ||
    !Number.isSafeInteger(outputTokens) ||
    inputTokens < 0 ||
    outputTokens < 0
  ) {
    return null;
  }

  return (
    (inputTokens * candidate.inputUsdPerMillion +
      outputTokens * candidate.outputUsdPerMillion) /
    1_000_000
  );
}
