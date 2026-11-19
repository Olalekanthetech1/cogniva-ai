# Cogniva — Mobile and Web Product Experience

**Status:** Proposed product experience and information architecture. This is a design specification, not a claim that these screens or capabilities are already implemented.
**Product direction:** Mobile-first, responsive, global, adaptive and evidence-driven.
**Brand promise:** Understand More. Think Better.

## 1. Product experience principles

1. **Learning starts immediately.** After sign-up and email verification, ask one optional institution question, then take the learner to Home. A full academic profile is never a prerequisite for starting.
2. **The tutor is central, not the entire product.** A prominent Home composer makes it easy to ask a question, while Learn organises courses and skills and Tutor provides the dedicated tutoring workspace.
3. **Home adapts to the learner.** A new student sees a useful first-session entry point. A returning student sees genuine resumable work and learning areas derived from their activity.
4. **The learner's work is the source of truth.** Courses, skills, activity, progress and recommendations must come from persisted student-owned records and actual evidence.
5. **One place for each job.** Subject and topic discovery belong in Learn, not in a duplicate Home section. The Tutor tab remains a persistent destination for active and previous tutoring sessions. The Tutor start form and active conversation must display a consistent, concise notice that Cogniva is AI-powered and can make mistakes in explanations, calculations, and feedback; learners should verify important answers.
6. **Show only working capabilities.** A control must not imply that upload, subject discovery, tutoring, analytics or another function is available until its end-to-end behaviour is implemented and tested.
7. **Mobile and web share one product model.** The information architecture, account data and action semantics stay consistent while layout adapts to screen size.

## 2. First-run journey

1. The student creates an account and verifies their email address.
2. Cogniva asks one optional question: **Which institution do you attend?**
3. The student may select an actual catalogue result, report that the institution is not listed, or skip and continue as an independent learner.
4. Cogniva saves only information actually supplied and preserves its verification state.
5. Every path leads directly to Home.

No faculty, department, programme, qualification, year of study, semester or credit-system questionnaire is required before the first learning session. These details can be added later in Profile or when they materially help organise a learning task.

## 3. Mobile Home — adaptive learning dashboard

The supplied conceptual mobile mockup is the visual foundation. Retain its welcoming greeting, prominent learning composer, resumable work, personal learning areas and five-destination bottom navigation, with the refinements below.

### 3.1 Greeting and profile access

At the top:
- Show a time-appropriate greeting only when the learner's local time zone is known; otherwise use a neutral greeting.
- Include a profile shortcut.
- Keep this region compact so the main learning action remains visually dominant.

### 3.2 Primary learning composer

Heading: **What would you like to learn?**

Use a prominent composer with an input such as **Ask your AI tutor…**. It should support the primary learning flow:
- Ask a question.
- Work through a problem.
- Begin learning a topic.

Provide contextual actions beneath or beside the composer:
- **Add material** — visible as an active action only when authenticated upload, processing, ambiguity handling, student confirmation and deletion are implemented end-to-end.
- **Browse learning** — navigate to the Learn destination for course, subject and topic discovery. Do not create a second Explore subjects destination on Home.

The composer is the most visually prominent control on Home. Submitting a prompt must create or resume a real tutoring/learning session, persist the learner's input and show truthful loading, success and failure states. It must never substitute a canned answer when an AI provider or database is unavailable.

### 3.3 Continue learning

Show this section only when the signed-in student has a genuine resumable session or course.

Each item must use persisted student-owned data, for example:
- actual course or topic title;
- last active concept or learning point, when recorded;
- a clear **Resume learning** action.

A returning learner may see the most relevant active item first. Do not invent a last session, course name, topic, timestamp or recommendation.

For a new learner with no history, omit the section and use the available space for a clear first-session prompt rather than an empty or fabricated card.

### 3.4 Your learning — courses and skills

Replace fixed subject tiles with two meaningful entry points:
- **Courses** — the learner's actual created, selected or source-grounded courses and learning outlines.
- **Skills** — Cogniva Knowledge Components and skills connected to the learner's courses, sessions or demonstrated activity, once that capability is implemented.

These are entry points into Learn and its course/skill views, not a duplicate subject-discovery feature. Content inside each view must be personal, real and traceable to its source.

Rules:
- Do not seed Mathematics, Physics, Chemistry, Computing or any other fixed subject cards for every learner.
- Do not infer interests from institution, programme, country or location.
- A generated course outline must be marked as proposed until the learner reviews it.
- Do not present generated content as an official institutional curriculum without authoritative supporting evidence and a validity period.
- If a learner has no courses or skills yet, show a truthful empty state and a clear route to start learning or browse Learn.
- Distinguish a learner's personal learning area from an institution's official course catalogue entry.

### 3.5 Adaptive Home states

Home is a state-aware dashboard, not a fixed list of cards.

**New learner / no learning history**
- Greeting and profile access.
- Prominent learning composer.
- Browse learning entry to Learn.
- A concise first-session invitation.
- No Continue learning card, fabricated activity, fixed subject grid, mastery percentage or unsupported recommendation.

**Returning learner**
- Greeting and learning composer remain available.
- Continue learning shows genuine resumable sessions/courses.
- Your learning shows real courses and skill areas.
- A recommended next step may appear only when the adaptive engine can explain it using recorded attempts, reviewed Knowledge Component mappings and a versioned estimate. Otherwise omit it.

**Learner with incomplete or unavailable data**
- Show the portions supported by available records.
- Explain a real service or data error where necessary.
- Do not replace missing data with sample content or pretend that loading completed.

### 3.6 Mobile bottom navigation

Use five persistent destinations:

| Destination | Responsibility |
|---|---|
| Home | Adaptive learning entry, genuine resumable work and personal learning snapshot |
| Learn | Course library, subjects, topics, course outlines and Knowledge Component/skill views |
| Tutor | Dedicated guided tutoring workspace, active sessions and conversation history |
| Progress | Evidence-backed activity, skill development and mastery information |
| Profile | Account, optional academic context, institution choice and preferences |

Use a persistent bottom navigation on narrow/mobile screens. Clearly identify the active destination and show accessible text labels, not icons alone.

A destination should be exposed as active only when it has a working route and meaningful content. Do not ship empty navigation tabs that imply unfinished capabilities are live.

## 4. Desktop and large-screen experience

Preserve the same five destinations and adaptive Home logic while using the available horizontal space.

Recommended layout:
- A persistent left navigation rail for Home, Learn, Tutor, Progress and Profile.
- A central content column for the current page and primary learning composer.
- A secondary column, when useful, for genuine resumable work, personal courses/skills or grounded next-step context.
- A compact top area for greeting, account/profile access and page-level actions.

On medium screens, collapse the secondary column before making the main learning entry point cramped. On narrow screens, switch to the mobile bottom-navigation composition. Avoid simply stretching mobile cards across a wide monitor.

Desktop Home has the same logical regions as mobile:
1. Greeting/profile access.
2. Primary learning composer.
3. Continue learning, only when real resumable work exists.
4. Your learning — courses and skills based on actual student records.
5. A recommended next step only when the evidence and adaptive explanation exist.

The arrangement and widths may change, but labels, data ownership, navigation destinations and action semantics remain consistent across form factors.

## 5. Core destination responsibilities

### Home
An adaptive launchpad: a new learner can begin immediately; a returning learner can resume genuine work and see their learning areas. It is not a static dashboard populated with generic recommendations.

### Learn
The single place to discover and organise subjects, topics, courses and learning outlines. It also exposes the learner's Knowledge Component/skill structure as that capability becomes available. Generated outlines must be labelled as proposed until reviewed. Institution curricula require official supporting sources and validity dates.

### Tutor
The dedicated guided Socratic workspace. Teach one meaningful step at a time; request learner attempts where appropriate; provide progressive hints and explanations of why; and preserve resumable sessions. Clarification must not silently advance the learner.

### Progress
Evidence-backed learning history and Knowledge Component progress. Any mastery estimate must communicate its evidence, uncertainty and model/version. A language model's unsupported assertion is not proof of mastery. Until the evidence model exists, show only real activity that can be measured reliably.

### Profile
Account and preferences, plus optional academic context. The learner can select/change an institution, report an institution not listed, or remain independent. A self-reported institution remains distinct from a verified catalogue record.

## 6. Core learning loop

The central Cogniva experience should be expressed as:

**Ask → Understand → Practise → Demonstrate mastery → Progress**

- **Ask:** the learner enters a question, problem or topic through the Home composer.
- **Understand:** the Socratic tutor guides the learner through explanations, questions and progressive hints.
- **Practise:** the learner attempts relevant exercises targeted at the current concept and prerequisites.
- **Demonstrate mastery:** Cogniva gathers actual assessment evidence; it does not infer mastery from a conversation alone.
- **Progress:** Cogniva recommends advancing, reinforcing or reviewing a prerequisite only when evidence supports the recommendation, and explains why.

The loop is the product model, not a claim that every stage is already implemented.

## 7. Data and interaction contracts

Every visible component must have a defined source of truth and empty/error/loading behaviour.

| UI element | Required source of truth | ZeroMock rule |
|---|---|---|
| Greeting | Authenticated profile and known local time zone, if available | Never invent a name or infer an exact location |
| Institution | Selected catalogue record or explicitly self-reported value | Preserve verification state; do not imply accreditation from a directory match |
| Home composer | Real tutoring/session creation and persistence API | Show provider or persistence failures; no canned AI response |
| Add material | Real authenticated upload and processing workflow | Do not simulate upload or extraction progress |
| Browse learning | Working Learn route and available subject/course/topic sources | Do not duplicate or fabricate discovery data on Home |
| Continue learning | Student-owned persisted sessions/courses | Never show sample or another student's data |
| Courses | Student-owned course records and reviewed or clearly proposed outlines | Do not represent an unreviewed generated outline as official curriculum |
| Skills | Cogniva Knowledge Components, mappings and learner evidence | Do not invent skill mastery or unsupported skill relationships |
| Recommended next step | Versioned adaptive output grounded in attempts, KC mappings and uncertainty | Omit when the evidence or explanation is unavailable |
| Progress | Recorded attempts, assessment evidence and versioned estimates | No fabricated mastery percentages, streaks or achievements |

Use account-scoped queries and enforce student ownership on the server. The UI must not be treated as the security boundary.

## 8. Accessibility and responsive behaviour

- Support keyboard navigation and visible focus states on web.
- Give icon-only controls accessible names; mobile bottom navigation must include visible text labels.
- Maintain readable text, sufficient contrast, touch-friendly controls and clear validation messages.
- Reflow content without horizontal scrolling at common phone widths.
- Preserve the learner's in-progress input during recoverable errors.
- Provide useful empty, loading, unavailable and retry states without presenting simulated work as completed.
- Respect reduced-motion preferences and avoid relying on colour alone to communicate state.

## 9. Delivery order

1. Approve the mobile adaptive dashboard and responsive desktop information architecture.
2. Reduce first-run onboarding to the optional institution selector and route every path to Home.
3. Implement the responsive Home shell and its new-learner/returning-learner states using only currently available, real data.
4. Implement the Home learning composer and persisted tutoring-session entry.
5. Keep subject/topic discovery under Learn and retain Tutor as a dedicated bottom-navigation destination.
6. Add upload, course/skill organisation, Progress and adaptive next-step recommendations as separately tested capabilities.
7. Validate mobile and desktop layouts, accessibility, ownership boundaries and empty/error states.

The supplied mockup remains the visual foundation. The adaptive dashboard and navigation refinements above define the agreed product direction. Each area becomes visible as a working capability is delivered.
