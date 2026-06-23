# Notes CodeMirror Completion Design

## Goal

Complete issue #59 by extending the existing CodeMirror 6 editor without
changing the local Markdown vault contract or introducing a second editor layer.

## Boundaries

- Markdown files remain the only user-content source of truth.
- `EditorState` remains the operational state while editing; React does not
  control the document on each keystroke.
- Toast UI remains only in the read-only Preview renderer.
- Split workspace and persistent annotations remain separate issues.

## Editor Commands

`markdown-editor-commands.ts` remains the single command domain. It will expose
valid Markdown insertions for bold, italic, inline code, headings, bullet and
ordered lists, checklists, links, quotes, dividers, code blocks, and local
calendar dates. Keymaps and slash autocomplete both consume these insertions so
their output cannot drift.

Link commands use `[selected text](url)` and leave the selection on `url`.
Collapsed selections use `link` as the label. Block commands insert at the
current line and leave the cursor at the first editable position.

## Live Preview And Synchronization

The existing syntax-tree `ViewPlugin` continues to generate decorations only
for visible ranges. It will hide semantic markers when the selection does not
touch their syntax span and reveal only the active construct while editing.

External document replacement preserves the active selection when it remains in
bounds. When the replacement is shorter, the selection is clamped to the valid
document range. The view remains mounted during note navigation and every
replacement avoids triggering the user-edit callback.

## Verification

Tests will cover command insertion and cursor placement, slash insertion,
marker visibility at selection boundaries, external synchronization, strict
read-only Preview behavior, autosave delegation, and a long document update.
The final gate includes TypeScript, lint, frontend tests, Rust checks, and React
Doctor. Documentation will explicitly describe the editor/runtime/renderer
boundary.
