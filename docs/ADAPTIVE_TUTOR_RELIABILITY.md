# Adaptive tutor reliability layer

**Status:** Implemented in the tutor response path; awaiting CI review.

## Turn-aware teaching

Each learner turn is classified from the actual conversation and submission type. The tutor can change its next move for:

- submitted working or an answer attempt;
- a clarification question;
- a correction challenge to an earlier tutor claim;
- an explicit request for a worked answer;
- a repeated tutor question or a stalled interaction;
- an ordinary follow-up.

The adaptive instructions are derived from the current conversation. They do not add a mastery claim or silently change attempt evaluation status.

## Deterministic numeric checks

A bounded arithmetic parser checks explicit numeric equalities and approximations that it can safely interpret. Supported forms include basic arithmetic, parentheses, common multiplication symbols and juxtaposition, powers, square roots, and trigonometric functions with an explicit degree symbol.

The parser does not use eval or execute learner text. It enforces expression length, token count, and numeric bounds. It evaluates a complete supported expression, or a complete expression after a small set of explicit labels; it does not salvage a parseable suffix from arbitrary prose. Results are compared after rounding to the precision stated in the numeric claim. Units and physical-model validity are outside this arithmetic check.

When exactly one explicit numeric mismatch is found in a generated tutor response, Cogniva can replace that response with an arithmetic-only correction. When a learner challenges prior work, the deterministic path is used only if recent tutor history contains exactly one distinct unresolved numeric claim. Ambiguous multi-claim history is left to the configured tutor rather than selecting an arbitrary calculation. Ordinary mentions of an answer, or simply reporting a learner answer, do not by themselves trigger deterministic correction. The response metadata records whether the answer came from the configured provider or the bounded arithmetic checker. A deterministic arithmetic result does not verify units, physical interpretation, or the surrounding explanation.

## Bounded answer evaluation and real-pair consistency

A plain numeric learner attempt is evaluated only when the immediately preceding tutor message contains a supported explicit arithmetic prompt, or when the tutor asks for a recognized sum-square or discriminant result and the conversation contains one unambiguous pair of constraints:

- \(x^2 + y^2 = A\)
- \(xy = B\)

For that specific constraint form, the verifier derives \((x-y)^2 = A - 2B\) and checks whether a real pair is possible. In a force-magnitude context, it also requires a nonnegative product. If the learner's single numeric answer matches the supported target, Cogniva acknowledges it and advances instead of asking for the same calculation again. If the supported constraints prove impossible, Cogniva explains the contradiction rather than generating force values.

The checker fails closed when a required equation is missing, multiple conflicting values are present, the learner submits an ambiguous multi-number response, or the notation is outside the supported form. It does not parse arbitrary symbolic algebra, solve general systems, or grade multi-step working. Its deterministic feedback does not mark an attempt as mastered or change mastery/progress records.

When a supported numeric evaluation is produced for an explicitly submitted attempt, the attempt record transitions from `not_evaluated` to `evaluated` in the same database transaction that saves the deterministic tutor reply. The reply metadata retains the verification method and expected/submitted values. Provider-only feedback, unsupported notation, ambiguous responses, and ordinary follow-up questions do not trigger this transition. `evaluated` means only that this bounded numeric check ran; it does not mean the learner has mastered the concept.

## Evidence boundary

This is not a general theorem prover, symbolic algebra system, or subject-wide fact checker. It deliberately ignores unsupported notation and expressions it cannot parse. It does not independently verify non-numeric scientific, historical, or factual claims. For those, the adaptive prompt requires the tutor to distinguish supported reasoning from uncertainty rather than claiming verification it has not performed.

No provider routing preference, database schema, mastery status, learner progress, or benchmark result is changed by this layer.

## Regression coverage

The native Node test suite includes regression cases from a real learner session alongside independent arithmetic, trigonometric, precedence, rounding, numeric-answer prompt matching, sum-square/product feasibility, discriminant evaluation, ambiguous constraint rejection, false-positive challenge, and unsupported-expression cases. These tests exercise the declared grammar; they do not establish general mathematical reasoning capability.
