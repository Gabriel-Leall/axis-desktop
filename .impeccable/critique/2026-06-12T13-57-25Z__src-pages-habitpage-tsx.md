---
target: page de habits
total_score: 18
p0_count: 0
p1_count: 3
timestamp: 2026-06-12T13-57-25Z
slug: src-pages-habitpage-tsx
---

## Design Health Score

| #         |                       Heuristic |     Score | Key Issue                                                                                                                       |
| --------- | ------------------------------: | --------: | ------------------------------------------------------------------------------------------------------------------------------- |
| 1         |     Visibility of System Status |         2 | Progress and loading skeletons exist, but action success/failure is mostly invisible. `HabitPage` does not render store errors. |
| 2         |       Match System / Real World |         2 | The model is useful, but labels like "Execution Queue", "Monthly Signal", "Minimum" and "Focus lock" add translation work.      |
| 3         |        User Control and Freedom |         2 | Cancel and edit paths exist, but archive is immediate and there is no undo for archive/delete/logging.                          |
| 4         |       Consistency and Standards |         2 | Broad i18n usage, but core visible strings remain hardcoded in English.                                                         |
| 5         |                Error Prevention |         2 | Invalid custom days are blocked and delete confirms, but destructive flows lack reversible recovery.                            |
| 6         |  Recognition Rather Than Recall |         2 | Main actions are visible, but heatmap/state semantics are not explained.                                                        |
| 7         |      Flexibility and Efficiency |         2 | Per-habit actions are fast, but there are no visible accelerators, bulk paths, or keyboard-first shortcuts.                     |
| 8         | Aesthetic and Minimalist Design |         2 | Clean baseline, but too many rounded cards, tiny uppercase labels, pills, and blur surfaces compete equally.                    |
| 9         |                  Error Recovery |         1 | Failed loads/actions are not explained in-page with actionable recovery.                                                        |
| 10        |          Help and Documentation |         1 | Empty states exist, but no contextual help for Minimum, Pause, Recover, heatmaps, or focus lock.                                |
| **Total** |                                 | **18/40** | **Poor to low acceptable: solid foundation, but clarity, recovery, and accessibility need work.**                               |

## Anti-Patterns Verdict

This does not read as obvious AI-generated UI, but it has a "tasteful default product UI" risk. The repeated pattern of rounded card, subtle border, tiny uppercase label, muted text, and backdrop blur appears across the header metrics, queue, focus habit, quick summary, overview cards, and stats panels. It is restrained, but too uniform.

The bigger AI-slop tell is copy. "Disciplined Momentum", "Execution Queue", "Monthly Signal", "Weekday Pressure Map", and "Focus lock" sound more branded than operational. For a solo productivity user, the page should answer "what remains today?" faster than it names concepts.

Deterministic scan was unavailable because `detect.mjs` failed with `Error: bundled detector not found.` Source-level evidence still confirmed hardcoded labels, missing accessible selected/pressed states, color-only state cues, excessive visible choices, destructive-action risks, and reduced-motion gaps.

No reliable visual overlay is available. Browser visualization was skipped because no local app was running on likely ports and the repo instruction says not to start a dev server without asking.

## Overall Impression

The habits page has a good product skeleton: today-first tabs, useful progress summaries, a nuanced habit model, skeleton loading, and empty states. The largest opportunity is to turn it from a "habit operations dashboard" into a calmer daily cockpit. Today should make the next action obvious, then reveal nuance only when needed.

## What's Working

1. The page is task-oriented. The Today tab, top progress metrics, and visible New Habit action create a clear first surface.
2. Empty and loading states are present, which gives the feature a baseline of production care.
3. The habit states are humane. Done, minimum, paused, and recovered are more forgiving than a binary streak tracker, but the UI needs to teach the model.

## Priority Issues

### [P1] The primary habit row is overloaded

Why it matters: A Today row exposes Complete, Minimum, Pause, habit selection, frequency, heatmap, streak, state, and Edit. That breaks the user's single-focus moment. The primary daily task becomes a small control panel.

Fix: Make Complete the dominant row action. Move Minimum and Pause into a compact secondary menu or reveal-on-focus area. Move Edit to the focused detail panel. Add a visible selected/focused state when the habit name is clicked.

Suggested command: `impeccable layout src/pages/HabitPage.tsx`

### [P1] State semantics are underexplained and partly color-dependent

Why it matters: Minimum, Paused, Recovered, Missed, and Done are meaningful distinctions, but the visible system relies on color, opacity, outline, and short labels. The heatmap has ARIA/title text, but no visible legend.

Fix: Add a compact legend near heatmaps. Use text, icons, or pattern cues in addition to color. Rename "Minimum" to something more explicit, such as "Minimum effort" or "Minimum version".

Suggested command: `impeccable clarify src/pages/HabitPage.tsx`

### [P1] Error recovery is effectively invisible

Why it matters: The store can fail and rollback, but the page does not render `error`. A user can click Complete, Archive, or Delete and see a state change fail without a clear explanation or retry.

Fix: Subscribe to the store error and render an inline error banner near the affected surface. Preserve the modal on destructive failures. Add retry/revert affordances for optimistic log actions.

Suggested command: `impeccable harden src/pages/HabitPage.tsx`

### [P2] Accessibility state is visually present but not programmatically explicit

Why it matters: Segmented tabs, habit state buttons, frequency buttons, custom weekday buttons, and color swatches show selected state visually but do not expose `aria-selected`, `aria-pressed`, or equivalent state consistently. Progress bars lack `role="progressbar"` and value attributes.

Fix: Convert the tab group to proper tab semantics or add accessible pressed/selected state. Add `aria-pressed` to toggle-like buttons. Add progressbar roles and values. Give color swatches human-readable names and selected state.

Suggested command: `impeccable audit src/pages/HabitPage.tsx`

### [P2] Localization and product copy are inconsistent

Why it matters: The page uses translations but hardcodes weekdays, frequency labels, "Edit", "Archive", "Delete", "d run", "days", `en-US`, and the native delete confirmation. This breaks the app's i18n contract and makes the page feel unfinished in Portuguese.

Fix: Route all visible strings through locale keys. Replace `window.confirm` with the app dialog pattern. Use i18n language for date formatting in both `HabitPage` and `HeatMap`.

Suggested command: `impeccable harden src/pages/HabitPage.tsx`

## Persona Red Flags

### Alex, power user

Alex can mark individual habits quickly, but there is no visible keyboard path for complete next habit, pause selected habit, create habit, or switch focused habit. With many habits, the row-by-row clicking becomes repetitive. There is no bulk path or acceleration layer.

### Sam, accessibility-dependent user

Sam gets ARIA labels on heatmap cells, which is a good start, but visible meaning still depends on color and opacity. The segmented tabs are just buttons with active styling. Toggle-like controls do not consistently expose pressed or selected state. Progress bars are visual only.

### Jordan, first-timer

Jordan understands New Habit, but will hesitate at Execution Queue, Minimum, Monthly Signal, Focus lock, and Recover. The page does not explain how Minimum or Pause affect streaks and progress, so the safest path is guessing.

### Maya, solo productivity user

Maya checks Axis throughout the day for control. The current page gives her useful data, but also asks her to process analytics, focus state, recovery, streaks, and multiple actions before answering the core question: what remains today?

## Minor Observations

- The decorative radial background is subtle, but still pulls the page toward generic dashboard atmosphere.
- The card radius and repeated `rounded-2xl` treatment make the page softer and less precise than the stated White Glacial direction.
- The overview grid repeats a card pattern that may become monotonous with many habits.
- The 30-day heatmap can get visually dense in narrow cards.
- CSS transitions and hover scale are not gated by reduced-motion settings.
- Archive has no confirmation, no undo, and no visible explanation of where archived habits go.

## Questions to Consider

1. What if Today had one dominant question: what remains before the day is closed?
2. Does Minimum need to be a top-level row action, or is it an exception path?
3. Would the page feel more premium if half the cards disappeared?
4. Is "Disciplined Momentum" serving the user, or branding a private routine too heavily?
5. Should recovery and streaks feel supportive instead of scoreboard-like?
