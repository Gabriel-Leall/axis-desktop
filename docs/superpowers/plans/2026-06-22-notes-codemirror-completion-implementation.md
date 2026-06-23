# Notes CodeMirror Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete issue #59 with the remaining Markdown commands, live-preview behavior, selection safety, tests, and documentation.

**Architecture:** Keep `MarkdownLiveEditor` as the imperative CodeMirror bridge. Keep Markdown command transformations in `markdown-editor-commands.ts` and syntax-aware presentation in `markdown-live-preview.ts`. The Notes store remains responsible for debounced persistence; Preview remains Toast UI Viewer-only.

**Tech Stack:** React 19, TypeScript, CodeMirror 6, Vitest, Zustand, Tauri v2.

---

### Task 1: Complete Markdown command domain

**Files:**
- Modify: `src/components/notes/editor/markdown-editor-commands.ts`
- Modify: `src/components/notes/editor/markdown-editor-commands.test.ts`

- [x] **Step 1: Write failing command tests**

Add table cases for `link`, `checklist`, `quote`, `divider`, `codeBlock`, and
`date`. Verify selection positions for a wrapped link and block cursor
placement. Verify slash insertions include every `MarkdownCommand`.

- [x] **Step 2: Run command tests to verify they fail**

Run: `bun run test:run -- src/components/notes/editor/markdown-editor-commands.test.ts`

Expected: failures for absent `link` command and incomplete command mappings.

- [x] **Step 3: Implement minimal command transformations and keymaps**

Add `link` to `MarkdownCommand`. Generate dynamic date insertion from local
calendar components. Add CodeMirror keymaps for bullet list, checklist, link,
and code block. Keep all slash entries derived from the same command insertion
domain.

- [x] **Step 4: Run command tests to verify they pass**

Run: `bun run test:run -- src/components/notes/editor/markdown-editor-commands.test.ts`

Expected: PASS.

### Task 2: Finish marker presentation and external selection handling

**Files:**
- Modify: `src/components/notes/editor/markdown-live-preview.ts`
- Modify: `src/components/notes/editor/markdown-live-preview.test.ts`
- Modify: `src/components/notes/editor/MarkdownLiveEditor.tsx`
- Modify: `src/components/notes/editor/MarkdownLiveEditor.test.tsx`

- [x] **Step 1: Write failing marker and selection tests**

Cover emphasis, link, heading, list, and task marker ranges at syntax
boundaries. Add component behavior that rerenders a shorter external document
while a selection exists and expects the selection to be clamped rather than
reset blindly.

- [x] **Step 2: Run focused tests to verify failures**

Run: `bun run test:run -- src/components/notes/editor/markdown-live-preview.test.ts src/components/notes/editor/MarkdownLiveEditor.test.tsx`

Expected: failures for marker coverage and selection preservation.

- [x] **Step 3: Implement syntax-derived markers and clamped replacement selection**

Use CodeMirror syntax node ranges for marker visibility. During external
document replacement, dispatch the document change with the current selection
clamped to the replacement document length. Keep `applyingExternalValueRef`
enabled so no autosave callback is emitted.

- [x] **Step 4: Run focused tests to verify they pass**

Run: `bun run test:run -- src/components/notes/editor/markdown-live-preview.test.ts src/components/notes/editor/MarkdownLiveEditor.test.tsx`

Expected: PASS.

### Task 3: Cover user-facing editor behavior

**Files:**
- Modify: `src/pages/NotesPage.test.tsx`
- Modify: `src/store/notes-store.test.ts`

- [x] **Step 1: Write page/store tests**

Add a Preview keyboard-input assertion proving no `updateNote` call occurs.
Add a long Markdown update through the editor callback and assert the store
still debounces persistence instead of synchronously writing each change.

- [x] **Step 2: Run focused tests against the existing debounce contract**

Run: `bun run test:run -- src/pages/NotesPage.test.tsx src/store/notes-store.test.ts`

Expected: failure until the tests are correctly wired to the existing editor
and debounced store contract.

- [x] **Step 3: Confirm no integration adjustment is required**

If tests expose wiring gaps, pass the existing editor callback through without
adding a second document state. Do not alter Preview into an editable surface.

- [x] **Step 4: Run focused tests to verify they pass**

Run: `bun run test:run -- src/pages/NotesPage.test.tsx src/store/notes-store.test.ts`

Expected: PASS.

### Task 4: Document and verify completion

**Files:**
- Modify: `docs/developer/notes-architecture.md`
- Modify: `docs/superpowers/plans/2026-06-22-notes-codemirror-completion-implementation.md`

- [x] **Step 1: Document the completed command and renderer boundary**

State that command transformations emit persisted Markdown, CodeMirror owns
live edit state and decorations, the store owns debounce persistence, and
Toast UI only renders read-only Preview.

- [x] **Step 2: Run full verification**

Run: `bun run typecheck && bun run lint && bun run test:run`

Run: `cargo fmt --manifest-path src-tauri/Cargo.toml --check && cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings && cargo test --manifest-path src-tauri/Cargo.toml --lib`

Run: `bunx react-doctor --diff main --verbose --fail-on warning`

Expected: all commands pass. Record the known repository-wide `format:check`
debt separately if `bun run check:all` stops only there.

- [ ] **Step 3: Commit implementation**

Run: `git add <only issue-59 files> && git commit -m "feat(notes): complete CodeMirror markdown workflow"`
