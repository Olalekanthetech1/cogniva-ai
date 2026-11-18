# Adaptive tutor reliability layer

**Status:** Implemented in the tutor response path; awaiting CI review and production verification.

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

The parser does not use eval or execute learner text. It enforces expression length, token count, and numeric bounds. It applies precision-aware rounding tolerance.

When it detects an incorrect numeric claim in a tutor response, Cogniva replaces that response with a correction based on the computed value before saving it. When a learner challenges an earlier claim, Cogniva independently checks whether the tutor or learner is correct: it corrects a wrong tutor claim, or explains why a verified tutor result stands when the learner's reported value differs. This check can find an unresolved numeric claim even when later tutor messages repeated the same question. The response metadata records whether the answer came from the configured provider or the deterministic verifier, plus any upstream provider evidence.

## Evidence boundary

This is not a general theorem prover, symbolic algebra system, or subject-wide fact checker. It deliberately ignores unsupported notation and expressions it cannot parse. It does not independently verify non-numeric scientific, historical, or factual claims. For those, the adaptive prompt requires the tutor to distinguish supported reasoning from uncertainty rather than claiming verification it has not performed.

No provider routing preference, database schema, mastery status, learner progress, or benchmark result is changed by this layer.

## Regression coverage

The native Node test suite covers square-root verification, arithmetic and trigonometric parsing, incorrect and correctly rounded claims, a learner correcting an earlier tutor error, explicit worked-answer requests, repeated-question adaptation, learner arithmetic diagnosis, and unsupported expressions.
