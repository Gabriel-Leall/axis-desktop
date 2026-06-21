# Notes Workspace Evolution Design

## Status

Approved design for the local Notes vault, CodeMirror 6 live preview, and
persistent annotations. Implementation is tracked in GitHub issues #58, #59,
and #60. The future two-note workspace is #61 and requires a grill-me session
before implementation.

## Product Intent

Axis Notes is a local-first writing environment. Users own a visible vault on
their computer. The interface should feel like a compact file explorer beside
a paper-like writing surface, informed by ZenNotes without copying its visual
identity or application architecture.

The current ZenNotes implementation was reviewed at commit `ba98a6d`. Its
relevant principles are plain local Markdown files, CodeMirror 6, syntax-tree
driven decorations for live preview, lifecycle directories, and metadata that
does not replace note content. Axis adopts those principles within its Tauri
and local-only model.

## Vault Model

- A new vault creates `inbox/Comece aqui/Bem-vindo ao Axis.md` and keeps notes
  directly under `inbox/` valid.
- The welcome note explains Axis and Notes. It is the only note eligible for a
  seeded annotation example.
- `inbox/` contains user folders and notes. The Notes sidebar reflects this
  physical hierarchy and allows folders to collapse.
- `archive/` and `trash/` are lifecycle states, not normal creation areas.
  Archiving, trashing, and restoring a folder moves its entire subtree.
- The vault manifest owns stable note identifiers. A note ID never derives
  from a filename or path. Axis updates the manifest atomically when it moves
  or renames notes and folders.
- `.axis-notes/sidecars/` stores Axis metadata. It is intentionally excluded
  from the user-facing file tree.

## File Interactions

- Notes and folders support create, rename, move, archive, trash, and restore
  through a right-click context menu.
- A note's visible title is its Markdown file name without the `.md` suffix.
  Creating a note produces a unique `Untitled.md`-style file with an empty
  body; the title field renames that file through the typed backend command.
  The stable manifest UUID remains unchanged through the rename.
- The Markdown document is only the note body. Axis does not insert, remove,
  derive a title from, or synchronize a leading `# Heading`. Users may add
  headings anywhere in the body as ordinary Markdown structure.
- Dragging a note or folder onto an `inbox/` folder moves it on disk through a
  typed Tauri command. The command rejects vault escapes, duplicate targets,
  and moves that would create a folder cycle.
- Selection, editor state, and the Notes Page remain mounted while navigation
  changes. The editor must not use a React `key` that remounts it for each
  workspace or note selection.

## Writing Surface

- CodeMirror 6 is the editor engine. Its `EditorState` is the runtime editing
  state; a debounced save serializes only the Markdown body to the local note
  file.
- Markdown remains interoperable on disk. This does not make it a raw-text UI:
  a CodeMirror `ViewPlugin` uses the Markdown syntax tree and decorations to
  render immediately as transactions occur.
- Valid syntax becomes rich presentation as soon as it is completed. Examples:
  `# ` creates a heading, list and task prefixes render after completion, and
  `**text**` renders bold after its closing marker is entered.
- Only syntax being intentionally edited is revealed. The rest of the note
  remains live-rendered, with no blur, navigation, or mode change required.
- Edit mode is the live writing surface. Preview is rendered Markdown with no
  editable input or save path. The previous editor Split mode is removed.
- Initial editor commands support headings, bold, italic, lists, task lists,
  links, code blocks, quotes, dividers, date insertion, undo, and redo. The
  same blocks are available from a slash-command menu.

## Persistent Annotations

- Selecting text exposes an `Add annotation` action.
- Comments are private local records in
  `.axis-notes/sidecars/<stable-note-id>.json`. JSON matches the existing
  vault manifest, supports schema versions and atomic writes, and keeps
  document metadata out of the Markdown body.
- Each record has a generated UUID, text, open/resolved state, offsets, quoted
  text, prefix and suffix context, and timestamps. A comment's visible opening
  words are not its ID because they are editable and not guaranteed unique.
- CodeMirror maps anchors through each document transaction. Reconciliation
  uses the quote and surrounding context after external changes.
- An unresolvable annotation becomes a recoverable `lost anchor`. It remains
  visible in the comments panel until the user repositions or deletes it.
- The comments panel is collapsed by default. Creating or selecting a
  highlighted annotation opens the panel inside the Notes workspace on the
  right. It supports navigation, resolve, reopen, delete, and reposition.
- The welcome note receives one removable example annotation exactly once,
  using its stable ID recorded in the manifest. Existing, imported, and
  user-created notes never receive seeded annotations.

## Boundaries

- No cloud vault, collaboration, reply threads, remote authors, or sync.
- No permanent deletion, duplication, or folder creation in Archive or Trash.
- No media embeds, plugin compatibility layer, Vim mode, or import workflow
  in these issues.
- A two-note workspace is intentionally deferred to #61. It must be designed
  separately because it has independent pane, command-routing, responsiveness,
  and annotation-panel decisions.

## Verification

- Rust command tests cover path validation, cycles, collisions, atomic moves,
  lifecycle folder moves, stable IDs, sidecar preservation, and seed
  idempotency.
- TypeScript unit tests cover tree derivation, CodeMirror decorations,
  immediate Markdown transitions, slash commands, anchor mapping,
  reconciliation, and lost-anchor recovery.
- Component tests cover collapsing folders, context menus, drag targets,
  edit versus read-only preview, comment panel behavior, and the seeded
  annotation example.
- Each implementation updates `docs/developer/notes-architecture.md` when the
  durable vault contract changes.
