# AI provider benchmark protocol

**Protocol version:** `cogniva-core-2026-11-18-v2`  
**Pricing snapshot:** `usd-2026-11-18-v2`  
**Reviewed:** 18 November 2026  
**Status:** Benchmark runner and blinded review workflow implemented on the feature branch. No benchmark has been run and no provider has been selected.

## Purpose

Compare one currently documented generally available text model from each configured provider on Cogniva's two first learner-facing tasks:

1. Learning-plan generation.
2. Socratic tutoring responses.

The benchmark is an administrator-controlled evaluation only. It must not create learner plans, tutoring sessions, mastery records, or route learner traffic.

## Initial candidate shortlist

These are candidates for testing, not recommendations or winners. Model availability, account eligibility, quota, and exact endpoint compatibility must still be verified with the credentials configured in Render.

| Provider | Candidate model ID | Input USD / 1M tokens | Output USD / 1M tokens | Price snapshot note |
|---|---|---:|---:|---|
| Gemini | `gemini-3.8-flash` | 0.75 | 3.75 | Introductory API price through 31 December 2026; recheck before any run after that date |
| Groq | `openai/gpt-oss-120b` | 0.15 | 0.60 | Groq-hosted production model |
| Mistral | `mistral-small-2603` | 0.15 | 0.60 | Mistral Small 4, generally available |

Pricing sources reviewed on 18 November 2026:

- Gemini model and introductory pricing: https://ai.google.dev/gemini-api/docs/latest-model
- Groq model availability and token rates: https://console.groq.com/docs/model/openai/gpt-oss-120b
- Mistral Small 4 model ID and token rates: https://docs.mistral.ai/models/mistral-small-4-0-26-03

These prices are a dated estimate basis, not a quote or invoice. The benchmark report must retain the price snapshot ID with every run. Reconfirm rates, account tier, taxes, cached-token treatment, and any provider-specific billed reasoning tokens before making a cost commitment. If provider usage is missing or incomplete, estimated cost must be shown as unavailable—not zero.

## Fixed evaluation suite

The machine-readable cases and prompts are versioned in `apps/web/lib/ai-benchmark-suite.ts`.

### Learning-plan generation

Three fixed cases cover beginner algebra, introductory engineering stress/strain, and descriptive statistics for laboratory data. The output contract requires a JSON object with a title, topic, learner level, and exactly three ordered units. Each unit requires measurable objectives, concepts, prerequisites, and an estimated duration.

Human reviewers score each output from 1 (poor) to 5 (excellent) on:

1. Validity of the required structure.
2. Coverage of the stated topic and level.
3. Measurability of learning objectives.
4. Sequencing and prerequisite coherence.
5. Factual accuracy and freedom from unsupported assumptions.

Structural validity should also be checked mechanically. A parse failure must remain a failed/invalid result; it must not be omitted from the denominator.

### Socratic tutoring

Three fixed cases cover an inverse-operation error in algebra, a power-rule misconception in calculus, and confusion between stress and strain.

Human reviewers score each output from 1 (poor) to 5 (excellent) on:

1. One manageable Socratic next step.
2. Relevance to the learner's latest response.
3. Continuity with the given problem and prior context.
4. Usefulness of the hint and closing question.
5. Factual correctness and absence of unsupported verification claims.

The tutor should not reveal the final answer when the case explicitly asks for guided reasoning.

## Execution and comparison rules

- Send identical task prompts and system instructions to every candidate model.
- Keep output-token limits and other controllable settings equal across providers.
- Record the suite version, exact model ID returned by the provider, provider, timestamp, latency, finish reason, input/output/total token usage, and outcome.
- Retain timeout, rate-limit, credential, model, malformed-output, and other failures in the report. Do not discard unsuccessful attempts.
- Calculate estimated API cost only where reliable input and output token counts are available, using the run's dated pricing snapshot.
- Report latency distributions only when enough completed observations exist. A small initial suite is exploratory and must not be represented as a statistically conclusive performance study.
- Blind provider and model identity during human output review. Reveal identities only after the review is submitted.
- Use human rubric scoring as the primary quality evidence. Model self-judging may be supplementary, never the sole quality measure.
- Do not auto-select or activate a provider from a benchmark score.

## Decision gate

No candidate should be chosen until the following evidence is available for both tasks:

- connection and model-ID compatibility;
- output validity and failure rate;
- human rubric results;
- latency and token usage;
- estimated cost with a current, retained price snapshot;
- a written explanation of trade-offs.

Task-specific winners are allowed: the best model for learning-plan generation need not be the best model for Socratic tutoring. Any later production activation requires a separate implementation and approval step.

## Runner implementation boundary

The administrator-only benchmark runner is implemented on the feature branch. It persists each provider/case attempt independently, retains failures, saves blinded human rubric reviews, and reveals identity/performance evidence only after review (or immediately when all requests fail and there is no output to score). The database schema requires a reviewed and separately applied Neon migration before the page can be deployed.

The runner does not execute until all three provider credentials are present in the Render service environment and an administrator explicitly starts a run. It does not activate learner-facing inference. No benchmark result exists until a real provider request has been completed and its evidence has been retained.
