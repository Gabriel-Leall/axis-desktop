# Notes Split Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a session-only split workspace so Notes can show and edit two independent notes side by side.

**Architecture:** Keep the physical vault and note persistence unchanged. Add page-local split-pane UI state in `NotesPage` because split layout is not persisted and belongs to the current workspace session. Reuse the existing store actions and render one `EditorArea` per open pane, with annotations bound to the active pane only.

**Tech Stack:** React 19, Zustand, CodeMirror editor component, Vitest, Testing Library, Tailwind CSS.

---

### Task 1: Capture Split Workspace Behavior With Tests

**Files:**

- Modify: `src/pages/NotesPage.test.tsx`

- [ ] Add failing tests for opening a note beside the current note from the tree context menu.
- [ ] Add failing tests for normal tree click replacing the active pane only.
- [ ] Add failing tests for closing the secondary pane.
- [ ] Add failing tests for lifecycle actions targeting the active pane.
- [ ] Run: `bun run vitest run src/pages/NotesPage.test.tsx`
- [ ] Expected before implementation: tests fail because split UI does not exist.

### Task 2: Add Split Pane State and Actions

**Files:**

- Modify: `src/pages/NotesPage.tsx`

- [ ] Add page-local state for `activePaneId`, `secondaryNoteId`, and compact visible pane.
- [ ] Add `openNoteBeside(noteId)`, `closeSecondaryPane()`, and `selectNoteForActivePane(noteId)` handlers.
- [ ] Keep normal tree selection routed to the active pane.
- [ ] Keep `selectedNoteId` in the store as the primary navigation target for compatibility.
- [ ] Run: `bun run vitest run src/pages/NotesPage.test.tsx`
- [ ] Expected: tests still fail until UI controls are wired.

### Task 3: Render Two Editor Surfaces

**Files:**

- Modify: `src/pages/NotesPage.tsx`
- Modify: `locales/en.json`
- Modify: `locales/pt-BR.json`

- [ ] Render primary and secondary `EditorArea` instances when `secondaryNoteId` is open.
- [ ] Add a visible active-pane treatment.
- [ ] Add toolbar action "Open beside" and secondary pane close action.
- [ ] Add tree context menu action "Open beside".
- [ ] Add responsive classes so narrow layouts show one pane at a time with a Left/Right switch.
- [ ] Run: `bun run vitest run src/pages/NotesPage.test.tsx`
- [ ] Expected: split behavior tests pass.

### Task 4: Bind Annotations to Active Pane

**Files:**

- Modify: `src/pages/NotesPage.tsx`
- Modify: `src/hooks/use-notes-annotations-controller.ts` only if the current hook cannot be reused cleanly.

- [ ] Ensure annotations load from the active note.
- [ ] Ensure selecting/focusing a pane makes it the annotation owner.
- [ ] Keep one right-side annotations panel.
- [ ] Run: `bun run vitest run src/pages/NotesPage.test.tsx src/store/notes-store.test.ts`
- [ ] Expected: all relevant tests pass.

### Task 5: Documentation and Validation

**Files:**

- Modify: `docs/developer/notes-architecture.md`

- [ ] Document the split workspace as session-only UI state.
- [ ] Run: `bun run typecheck`
- [ ] Run: `bun run lint`
- [ ] Run: `bunx react-doctor --diff main --fail-on warning --no-score`
- [ ] Run: `bun run vitest run src/pages/NotesPage.test.tsx src/store/notes-store.test.ts`
- [ ] If feasible, run `bun run check:all`; if format baseline fails, record it explicitly.
- [ ] Commit, push, open ready PR, request CodeRabbit review, handle actionable comments, then merge.
