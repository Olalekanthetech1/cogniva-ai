# Cogniva User Interface and Responsive Experience

**Status:** Proposed product design baseline  
**Scope:** Student-facing responsive web application and mobile experience  
**Design principle:** Mobile-first information architecture with a purpose-built desktop composition.

This document records the mobile home-screen reference supplied for Cogniva and the complementary desktop web proposal. These are design references, not evidence that the corresponding screens are implemented.

## 1. Product experience

Cogniva should feel like a calm, focused learning environment. The interface should make it easy to begin a question, upload a difficult problem, explore a subject, or resume a previous learning session.

The experience must support guided understanding rather than encourage answer-copying. The AI tutor should remain accessible from the main navigation and from relevant learning contexts.

## 2. Mobile home reference

The supplied mobile concept establishes these home-screen sections, in this order:

1. **Welcome area:** time-appropriate greeting, short learning-oriented message, and profile access.
2. **Tutor entry:** prominent prompt asking what the student wants to learn, with a text entry point.
3. **Quick actions:** upload a problem and explore subjects.
4. **Continue learning:** resume the most relevant active or recent learning session, when one exists.
5. **Learning areas:** subject shortcuts such as Mathematics, Physics, Chemistry, and Computing. The displayed set must be based on available catalogue data or student choices, not fabricated records.
6. **Bottom navigation:** Home, Learn, Tutor, Progress, and Profile.

### Mobile interaction requirements

- Keep the primary tutor entry prominent and reachable.
- Use a two-column grid for quick actions and subject shortcuts where viewport width permits; collapse to one column on narrow screens.
- Keep bottom navigation available on the core student areas, with active-state indication and safe-area spacing.
- Preserve readable text, touch targets, keyboard access, and clear upload progress/error states.
- On small screens, avoid horizontal scrolling for core navigation or main learning content.

## 3. Desktop web proposal

The desktop proposal adapts the same information architecture instead of enlarging the mobile screen.

### Layout regions

**Left sidebar**
- Cogniva brand and tagline.
- Primary navigation: Home, Learn, Tutor, Progress, Profile.
- Secondary navigation near the bottom: Help and Settings.
- Persistent active-page indication.

**Top utility bar**
- Search across subjects and topics, with a clear route into asking the tutor.
- Notifications, where enabled.
- Student profile menu.

**Main learning workspace**
- Welcome banner.
- Primary tutor composer with prompt, problem-upload action, and subject exploration action.
- Continue-learning card with the session title, last active topic, and resume action.
- Learning-area cards arranged in a responsive grid.

**Contextual right column**
- Optional learning overview or study context panel.
- Only show metrics or progress when derived from real student activity and stored learning records.
- Collapse below the main workspace on medium screens; omit or move into Progress when space is constrained.

### Desktop interaction requirements

- Sidebar navigation remains stable while the main content scrolls.
- Keyboard users can reach every action and see visible focus.
- Tutor composer supports text entry, upload, and subject/topic entry without forcing a navigation detour.
- Cards have clear titles and actions; the full card must not create ambiguous nested click targets.
- Search results and tutor suggestions must distinguish catalogue-backed data from generated explanations.
- The desktop right column is supplementary and must never contain invented streaks, percentages, mastery scores, or activity.

## 4. Responsive behavior

- **Small mobile:** single-column content; compact header; bottom navigation; stacked cards.
- **Large mobile / tablet:** two-column action and subject grids when the content remains readable; navigation may adapt to available width.
- **Desktop:** persistent sidebar, utility bar, flexible main column, and optional contextual side panel.
- **Wide desktop:** increase whitespace and content width rather than stretching individual controls indefinitely.

Exact breakpoints should be selected during implementation and validated on real devices. Avoid designing around one fixed device size.

## 5. Visual language

The supplied mobile concept and desktop proposal use:
- Warm off-white / light neutral surfaces.
- Soft gray cards with subtle separation.
- Deep charcoal text.
- Muted sage-green as an accent and active-state color.
- Simple line icons.
- Rounded card corners and generous spacing.

Visual styling must preserve sufficient contrast and not use color alone to communicate state.

## 6. Data integrity and ZeroMock requirements

The mockups are conceptual references. They do not authorize hardcoded student activity or demo data in production.

- A continue-learning card appears only when a real resumable session exists.
- Learning-area cards come from configured catalogue records or the student's actual selections.
- Progress summaries must be calculated from persisted, auditable events and mastery evidence.
- Empty states should explain what the student can do next without pretending records exist.
- Greeting text may use the student's local time only when that information is available reliably.
- Loading, empty, unavailable, and error states must be explicit; never display pretend processing or fabricated success.

## 7. Implementation sequence

1. Establish shared design tokens and accessible primitives in the UI package.
2. Build the responsive application shell and navigation.
3. Implement the mobile home layout against the supplied reference.
4. Implement the desktop layout as a deliberate composition using the same shared components and information architecture.
5. Connect sections to authenticated student data and real academic catalogue records.
6. Add viewport, keyboard, screen-reader, and empty/error-state tests.

**Acceptance criterion:** The mobile and desktop experiences should feel like two intentional presentations of the same Cogniva product, with consistent terminology, capabilities, and data—not two separate applications.
