---
target: QuickPane
total_score: 18
p0_count: 0
p1_count: 3
timestamp: 2026-06-13T14-51-22Z
slug: src-components-quick-pane-quickpaneapp-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---:|---:|---|
| 1 | Visibility of System Status | 2 | Saving exists, but success disappears immediately and error/help share the same cramped slot. |
| 2 | Match System / Real World | 2 | Prefix capture is powerful, but `task:`, `note:`, `event:` reads like parser syntax rather than a polished capture tool. |
| 3 | User Control and Freedom | 2 | Escape and blur dismiss exist, but there is no visible close, no undo, and blur dismissal can feel abrupt. |
| 4 | Consistency and Standards | 2 | It resembles command palette patterns, but the window proportions break expected command-bar polish. |
| 5 | Error Prevention | 2 | Parser catches empty/unknown prefixes, but the UI does little to prevent prefix mistakes before submit. |
| 6 | Recognition Rather Than Recall | 1 | Users must remember prefixes and shortcut behavior from dense helper text. |
| 7 | Flexibility and Efficiency | 3 | Keyboard-first capture is strong; Shift+Enter is useful for power users. |
| 8 | Aesthetic and Minimalist Design | 1 | The 72px pane is visually overpacked, with clipped text and two competing footer messages. |
| 9 | Error Recovery | 2 | Draft is preserved on persist failure, but the error appears in a low-visibility footer region. |
| 10 | Help and Documentation | 1 | Help is present but compressed, jargon-heavy, and not contextual to the current prefix. |
| **Total** |  | **18/40** | **Poor: strong interaction idea, weak presentation and discoverability.** |

## Anti-Patterns Verdict

**LLM assessment**: This does not look like generic AI slop in the usual card-grid sense. It has the opposite problem: it looks unfinished, like a debug command strip squeezed into a production surface. The screenshot reads as a cropped terminal overlay rather than a deliberate quick-capture pane. For a product whose design context says focused, clear, controlled, the current surface is too cramped to feel trustworthy.

The biggest tell is proportion. `src-tauri/src/commands/quick_pane.rs` creates a `500x72` window, while `QuickPaneApp.tsx` renders a `text-lg` input, `gap-3`, `px-5 py-4`, and a footer that can wrap. The math does not fit. The screenshot confirms clipping and cramped footer text.

**Deterministic scan**: unavailable. `node C:\Users\Gabriel\.agents\skills\impeccable\scripts\detect.mjs --json src/components/quick-pane/QuickPaneApp.tsx` failed with `Error: bundled detector not found.`

**Visual overlays**: no reliable overlay was produced. The user supplied a direct screenshot of the QuickPane, and the source code/window configuration explains the visual failure. Fallback signal: screenshot + `QuickPaneApp.tsx` + `quick_pane.rs` size/position code.

## Overall Impression

The core concept is good: global keyboard capture, typed prefixes, Enter to save, Shift+Enter to save and open. The surface itself is under-designed. It should feel like a precise Raycast-style capture instrument; right now it feels like a cramped status bar.

The single biggest opportunity is to redesign the pane as a real command surface with enough height, a stronger input hierarchy, and contextual guidance that changes as the user types.

## What's Working

1. **Keyboard-first interaction is correct.** Enter and Shift+Enter map well to a fast capture workflow.
2. **Typed prefixes are efficient for repeat users.** `task:`, `note:`, `habit:` can be fast once learned.
3. **Draft preservation on persist failure is the right instinct.** The error copy says the draft remains, which protects trust.

## Priority Issues

### [P1] The window is too short for its own content

**Why it matters**: The screenshot shows clipping and a compressed footer. A quick capture tool must feel instant and controlled; clipped UI makes the whole app feel fragile.

**Fix**: Increase the quick pane window height from `72` to roughly `112-128`, or reduce the UI to a true one-row command bar. Do not keep the current two-row content inside 72px. Align Rust window size and React layout as one component contract.

**Suggested command**: `impeccable adapt QuickPane`

### [P1] The helper text overloads the smallest part of the surface

**Why it matters**: The footer tries to teach supported prefixes and keyboard behavior at the same time. On 500px width it wraps, competes with the shortcut hint, and becomes noise.

**Fix**: Replace the full "Supported..." sentence with contextual guidance. Examples: show `task` as a selected mode chip, then show `Type note: to capture a note` only when the field is empty, or move supported prefixes behind a small `?`/popover. Keep the footer to one concept.

**Suggested command**: `impeccable clarify QuickPane`

### [P1] Prefix syntax is powerful but not discoverable

**Why it matters**: First-time users see parser syntax, not a product affordance. They may not understand whether `task:` is literal, optional, required, or just an example.

**Fix**: Visually separate mode from content. Options: a leading mode pill (`Task`) that changes when the user types `note:`, or a compact command menu triggered by `/` or `:`. Keep typed prefixes for experts, but give novices a visible model.

**Suggested command**: `impeccable clarify QuickPane`

### [P2] Error and saving feedback are too quiet

**Why it matters**: A global capture tool disappears immediately on success, so failure feedback must be unmistakable. A red footer message in a 72px panel is easy to miss.

**Fix**: Add an `aria-live` status region and a dedicated inline error row when needed. On success, either briefly show a compact confirmation before dismissal or use a main-window toast/event feedback after dismissal.

**Suggested command**: `impeccable harden QuickPane`

### [P2] The visual entrance has no presence

**Why it matters**: The pane appears as a thin dark strip. It does not claim focus or feel like a premium capture moment. The user has to visually hunt for the input.

**Fix**: Position it closer to the upper third of the active monitor or give the centered pane more vertical mass. Use a crisp border, restrained shadow/elevation, and a clear input baseline. Motion should be short: 120-180ms opacity/translate, no bounce.

**Suggested command**: `impeccable layout QuickPane`

## Persona Red Flags

**Alex (Power User)**: The core keyboard path is promising, but the dense footer wastes visual space after the first use. Alex wants the pane to vanish into muscle memory: type, Enter, done. Current UI keeps teaching every time and pays for that with clipping.

**Jordan (First-Timer)**: `task: Plan release notes` is ambiguous. Jordan may type exactly that without understanding the prefix model, or may wonder what happens without a prefix. The supported-prefix sentence is technically informative but visually too compressed to teach calmly.

**Sam (Accessibility-Dependent User)**: The input has no explicit label or `aria-describedby` relationship to the helper/error text. Error changes are not announced via `aria-live`. The helper text is small and low-contrast in the screenshot, which risks low-vision readability.

**Project-specific persona, Solo Focus Worker**: This user summons QuickPane mid-flow from another app. The pane should reduce interruption cost. Current clipping and dense explanatory footer increase interruption cost: the user must parse UI instead of dumping the thought.

## Minor Observations

- `Shift+Enter saves and opens` should name what opens, or change to `Shift+Enter saves and opens in Axis`.
- Portuguese strings are longer and will worsen footer wrapping.
- The pane has no visible mode/state for "task vs note vs event" after the parser recognizes a prefix.
- Single-line input is fine for quick capture, but long pasted text needs a controlled horizontal-scroll or expanded state.
- Dismiss-on-blur is expected for quick panes, but it should not erase visible errors or drafts.

## Questions to Consider

1. Should QuickPane be an expert command bar or a novice-friendly capture card?
2. Is prefix syntax the primary model, or should mode selection be visible and prefixes become an accelerator?
3. Should success be silent dismissal, or should the app show a confirmation after capture?
4. What should the pane feel like when it appears: Raycast command palette, Notion quick capture, or Axis-specific "focus capture"?
