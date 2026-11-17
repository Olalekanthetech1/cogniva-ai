# Cogniva — Mobile and Web Product Experience

**Status:** Proposed product experience and information architecture. This is a design specification, not a claim that these screens or capabilities are already implemented.
**Product direction:** Mobile-first, responsive, global, and evidence-driven.
**Brand promise:** Understand More. Think Better.

## 1. Design principles

1. **Learning starts immediately.** After sign-up and email verification, ask one optional institution question, then take the learner to Home. Do not make a full academic profile a prerequisite.
2. **One learning entry point.** Questions, problems and topics should all lead into a guided learning workflow.
3. **Resume real work.** Continue-learning content must come from persisted sessions or courses belonging to the signed-in student.
4. **Personalise from evidence.** Learning areas, progress and recommendations must reflect real learner activity and recorded evidence.
5. **Show only working capabilities.** A control must not imply that upload, subject discovery, tutoring, progress analytics or another function is available until its end-to-end behaviour is implemented and tested.
6. **Keep mobile and web consistent.** Both experiences share the same information architecture and account data; layout adapts to screen size rather than creating two different products.

## 2. First-run journey

1. The student creates an account and verifies their email address.
2. Cogniva asks: **Which institution do you attend?**
3. The student may select an actual catalogue result, report that the institution is not listed, or skip and continue as an independent learner.
4. Cogniva saves only the information actually supplied and its verification state.
5. The student lands on Home.

No faculty, department, programme, qualification, year of study, semester or credit-system questionnaire is required before the first learning session. These details can be added later in Profile or when a learner organises a specific course.

## 3. Mobile Home screen

The supplied conceptual mobile mockup is the visual reference for this screen. Its structure is retained below.

### 3.1 Greeting and profile access

At the top:
- Show a time-appropriate greeting when the learner's local time zone is known; otherwise use a neutral greeting.
- Include a profile shortcut.
- Keep the greeting secondary to the main learning action.

### 3.2 Primary learning card

Heading: **What would you like to learn?**

Supporting copy: **Ask a question, upload a problem or explore a topic.**

The card contains:
- A prominent question/tutor entry field, such as **Ask your AI tutor…**.
- An **Upload problem** action for supported image/document inputs.
- An **Explore subjects** action that opens only a real, data-backed subject discovery experience.

The question field should be the most visually prominent action. A submitted question should create or resume an actual tutoring session, with clear progress and failure states. Upload must not be displayed as active until private upload, processing, ambiguity handling and student confirmation are supported. Subject exploration must not invent subjects or advertise unsupported subject capabilities.

### 3.3 Continue learning

Show this section only when the signed-in student has a genuine resumable learning session or course.

Each item should use persisted data, for example:
- actual course or topic title;
- last active learning point, such as the last session topic;
- a clear **Resume learning** action.

Do not insert sample cards such as Engineering Mathematics or fabricated last-session details. For a new learner with no history, omit the section or replace it with a truthful first-session prompt.

### 3.4 Your learning areas

Show learning areas that the student has actually selected, started or studied. Each card links to a real subject/course view.

- Do not seed fixed Mathematics, Physics, Chemistry or Computing cards for every student.
- Do not infer interest from institution, programme or location.
- If there are no learning areas yet, use an honest empty state or omit the section until the learner starts something.
- Distinguish a student's personal learning area from an institution's official course catalogue entry.

### 3.5 Mobile bottom navigation

The proposed primary navigation contains five destinations:

| Destination | Responsibility |
|---|---|
| Home | Learning entry point, resumable work and personal learning areas |
| Learn | Courses, topics, subject discovery and organised learning |
| Tutor | Guided AI tutoring sessions and conversation history |
| Progress | Evidence-backed activity, skill development and mastery information |
| Profile | Account, optional academic context, institution selection and preferences |

Use a persistent bottom navigation on narrow/mobile screens. Clearly identify the active destination and retain accessible labels, not icons alone.

A destination should be exposed as active only when it has a working route and meaningful content. Do not ship empty navigation tabs that imply unfinished features are live.

## 4. Desktop and large-screen experience

The desktop experience should preserve the same five destinations and learning priorities while using available horizontal space.

Recommended layout:
- A persistent left navigation rail for Home, Learn, Tutor, Progress and Profile.
- A central content column for the current task and the primary learning composer.
- A secondary column, when useful, for genuine resumable sessions, learning areas or contextual information.
- A responsive top area for greeting, account/profile access and page-level actions.

On medium screens, collapse the secondary column before making the main learning entry point cramped. On narrow screens, switch to the mobile bottom-navigation composition. Avoid simply stretching mobile cards across a very wide monitor.

The desktop Home should contain the same logical regions as mobile:
1. Greeting/profile access.
2. Primary learning entry.
3. Continue learning, when persisted activity exists.
4. Personal learning areas, when real data exists.

The locations and widths may change, but labels, data ownership, navigation destinations and action semantics should remain consistent across form factors.

## 5. Core screen responsibilities

### Home
A concise launchpad for new learning and resuming real work. It should not become a static dashboard full of invented recommendations.

### Learn
A place to create, organise and revisit learning areas, courses and topic outlines. Generated outlines must be marked as proposed until the learner reviews them. Institution curricula require official supporting sources and validity dates.

### Tutor
The guided Socratic learning experience: one meaningful step at a time, attempts before evaluation where appropriate, progressive hints, explanations of why, and resumable sessions. The tutor must not silently advance when a learner asks for clarification.

### Progress
Evidence-backed learning history and Knowledge Component progress. Any mastery estimate must communicate its evidence and uncertainty; a language model's unsupported assertion is not proof of mastery. Until the evidence model exists, show only real activity that can be measured reliably.

### Profile
Account and preferences, plus optional academic context. The learner can select/change an institution, report an institution not listed, or remain independent. Any self-reported institution remains distinct from a verified catalogue record.

## 6. Data and interaction contracts

Every visible component must have a defined data source and empty/error/loading behaviour.

| UI element | Required source of truth | ZeroMock rule |
|---|---|---|
| Greeting | Authenticated profile and known local time zone, if available | Never invent a name or infer an exact location |
| Institution | Selected catalogue record or explicitly self-reported value | Preserve verification state; never imply accreditation from a directory match |
| Tutor entry | Real tutoring-session creation/resume API | Show provider or persistence failures; no canned AI response |
| Upload problem | Real authenticated upload and processing workflow | Do not simulate upload or extraction progress |
| Explore subjects | Available subject catalogue/capability registry | Empty catalogue is an honest empty state |
| Continue learning | Student-owned persisted sessions/courses | Never show sample or other students' data |
| Learning areas | Student's actual selected/started learning records | No global hard-coded subject cards |
| Progress | Recorded attempts, assessment evidence and versioned estimates | No fabricated mastery percentages or streaks |

Use account-scoped queries and enforce student ownership on the server. The UI must not be treated as the security boundary.

## 7. Accessibility and responsive behaviour

- Support keyboard navigation and visible focus states on web.
- Give icon-only controls accessible names; mobile bottom navigation must include visible text labels.
- Maintain readable text, sufficient contrast, touch-friendly controls and clear validation messages.
- Reflow content without horizontal scrolling at common phone widths.
- Preserve the learner's in-progress input during recoverable errors.
- Provide useful empty, loading, unavailable and retry states without presenting simulated work as completed.
- Respect reduced-motion preferences and avoid relying on colour alone to communicate state.

## 8. Delivery order

1. Finalise and review the screen and navigation architecture.
2. Reduce first-run onboarding to the optional institution selector and route all paths to Home.
3. Implement the responsive Home shell using only currently available, real data.
4. Implement the primary learning entry and session persistence.
5. Add upload, subject exploration, course organisation, Tutor, Progress and adaptive learning as separately tested capabilities.
6. Validate mobile and desktop layouts, accessibility, ownership boundaries and error states.

The mockup is a target structure, not a reason to expose unfinished controls. Each area becomes visible as a working capability is delivered.
