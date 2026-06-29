# Notes Annotations Anchors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add private local annotations anchored to selected Markdown ranges, persisted in per-note sidecars.

**Architecture:** Keep Markdown files as source of truth and store Axis-owned annotation metadata in `.axis-notes/sidecars/<note-id>.json`. The backend owns durable schema and atomic writes; frontend owns selection UX, editor highlighting, and annotation panel state. Anchor movement is implemented first as pure TypeScript/Rust-testable logic, then wired into CodeMirror transaction mapping and backend reconciliation.

**Tech Stack:** Tauri v2 Rust commands with `tauri-specta`, React 19, Zustand, CodeMirror 6, Vitest, Rust unit tests.

---

### Task 1: Anchor Domain

**Files:**

- Create: `src/lib/notes-annotations.ts`
- Test: `src/lib/notes-annotations.test.ts`

- [ ] Write failing tests for mapping anchor ranges through insert/delete edits.
- [ ] Write failing tests for reconciling missing anchors by quote and context.
- [ ] Implement pure helpers for range mapping and reconciliation.

### Task 2: Backend Sidecars

**Files:**

- Create: `src-tauri/src/commands/notes/annotations.rs`
- Modify: `src-tauri/src/commands/notes.rs`
- Modify: `src-tauri/src/bindings.rs`
- Test: `src-tauri/src/commands/notes/tests.rs`

- [ ] Add Rust tests for sidecar schema, atomic persistence, create/list/update lifecycle, lost anchors, reposition, and seed idempotency.
- [ ] Implement typed annotation structs and sidecar read/write helpers.
- [ ] Add typed Tauri commands for list, create, update text, resolve, reopen, delete, and reposition.
- [ ] Register commands in `bindings.rs`.

### Task 3: Store Integration

**Files:**

- Modify: `src/store/notes-store.ts`
- Modify: `src/store/notes-store.test.ts`
- Modify: `src/lib/tauri-bindings.ts`

- [ ] Add tests for loading annotations with the selected note.
- [ ] Add tests for creating only from a non-empty range and preserving state on command failure.
- [ ] Wire typed commands through Zustand selectors/actions.

### Task 4: CodeMirror Highlighting

**Files:**

- Create: `src/components/notes/editor/markdown-annotation-extension.ts`
- Modify: `src/components/notes/editor/markdown-editor-runtime.ts`
- Modify: `src/components/notes/editor/MarkdownLiveEditor.tsx`
- Test: `src/components/notes/editor/markdown-annotation-extension.test.ts`

- [ ] Add tests for decoration ranges and selection payloads.
- [ ] Add annotation mark decorations and transaction range updates.
- [ ] Expose selection/create/select callbacks without making React control every keystroke.

### Task 5: Notes Panel UI

**Files:**

- Create: `src/components/notes/NotesAnnotationsPanel.tsx`
- Modify: `src/pages/NotesPage.tsx`
- Modify: `locales/en.json`
- Modify: `locales/pt-BR.json`
- Test: `src/pages/NotesPage.test.tsx`

- [ ] Add a right panel collapsed by default.
- [ ] Open the panel after creating or selecting an annotation.
- [ ] Support navigate, resolve, reopen, delete, and reposition lost anchors.

### Task 6: Docs and Validation

**Files:**

- Modify: `docs/developer/notes-architecture.md`

- [ ] Document sidecar contract and local-only annotation behavior.
- [ ] Run targeted Vitest and Rust tests.
- [ ] Run typecheck/lint; run broader checks if the known formatting baseline allows it.
- [ ] Commit, push, open PR ready for review, request CodeRabbit, evaluate actionable feedback, then merge.
