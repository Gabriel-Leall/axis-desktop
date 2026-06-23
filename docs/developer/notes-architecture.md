# Notes Architecture

This document defines the current local-only notes architecture: how the vault
is stored on disk, how notes move through lifecycle states, and which layer owns
each responsibility.

## Scope

Axis notes are local files owned by the user. The current architecture does not
include cloud sync, remote vaults, account-based notes, multi-device conflict
resolution, or Obsidian/Notion import/export.

Use this document as the domain contract for changes in Notes Page, widgets,
Preferences, and the Rust vault commands.

## Physical Vault

The default vault is created automatically on first use at:

```text
Documents/Axis_Notes/
+-- inbox/
+   +-- Comece aqui/
+       +-- Bem-vindo ao Axis.md
+-- archive/
+-- trash/
+-- .axis-notes/
    +-- manifest.json
    +-- sidecars/
    +-- cache/
    +-- config/
```

The user can choose another absolute vault path in Settings. Axis validates the
new path, creates any missing vault directories, persists the active path in
`preferences.json` as `notes_vault_path`, and keeps existing notes in the old
vault. Changing the vault path is a switch, not a migration.

After a successful vault switch, the frontend may offer an explicit migration
prompt for the previous vault path. The default safe action is copy. Move is a
separate user action and must never happen as part of changing the active vault
path.

If `notes_vault_path` is not set, Axis resolves the active vault to the default
`Documents/Axis_Notes` path.

Only a newly created default vault receives the welcome note. An existing vault
is never populated or modified merely by being opened.

## Vault Directory Contract

The backend contract lives in `VaultLayout` in
`src-tauri/src/commands/notes.rs`. Do not duplicate directory names in frontend
code or unrelated Rust modules.

Current top-level directories:

- `inbox/` stores active user notes and is the default destination for created
  notes.
- `archive/` stores notes removed from the active workspace but preserved for
  later restoration.
- `trash/` stores deleted notes before any future permanent deletion feature.
- `.axis-notes/` stores Axis-owned vault metadata and must not appear as user
  content.

Current metadata directories:

- `.axis-notes/manifest.json` records internal vault metadata schema, the
  stable UUID for each Markdown path, and the welcome-note ID. It is preserved
  after creation and is the authority for note IDs when files move or rename.
- `.axis-notes/sidecars/` is reserved for per-note structured metadata.
- `.axis-notes/cache/` is reserved for derived, rebuildable data.
- `.axis-notes/config/` is reserved for vault-scoped settings.

## Note Lifecycle

All filesystem operations go through typed Tauri commands implemented in
`src-tauri/src/commands/notes.rs`.

Create:

- `create_note` writes an empty Markdown file into `inbox/` when the caller
  has not supplied body content. Its default file name is `Untitled.md` and
  collisions receive a unique file name.
- `create_note` may target an existing Inbox subfolder. Folder creation remains
  Inbox-only and the backend rejects archive, trash, missing, or unsafe paths.
- The file stem is the note title shown by Axis. Markdown content, including a
  leading `# Heading`, is only the note body and never changes the file name.
- File names are generated from the requested title and made unique before
  writing.

Update and rename:

- `update_note` changes Markdown file content.
- `rename_note` changes the note file path while preserving the note data.
- Renaming never rewrites the Markdown body. It changes the file-backed title
  while headings remain ordinary document structure.
- Note IDs remain stable UUIDs when a file is renamed or moved between lifecycle
  directories. The Markdown path is a property of the note, not its identity.

Archive:

- `archive_note` moves a note into `archive/`.
- Archived notes are excluded from active notes list and active search.

Delete:

- `delete_note` moves a note into `trash/`.
- This is reversible and must not be presented as permanent deletion.

Restore:

- `restore_note` moves a note from `archive/` or `trash/` back to `inbox/`.
- Restore chooses a unique destination file name if a collision exists.

Permanent delete:

- Permanent deletion is intentionally not exposed today.
- Add it only with explicit UX, retention, undo/recovery expectations, tests,
  and documentation.

## Folder and Tree-Item Lifecycle

The Notes explorer renders the physical workspace tree and routes all
right-click actions through typed Tauri commands. The frontend may identify a
tree item by a stable note ID or a vault-relative folder path, but it must never
derive an absolute filesystem path.

Normal organization is Inbox-only:

- `create_notes_folder` creates a child folder only inside `inbox/`.
- `rename_notes_folder` renames Inbox folders only.
- `move_notes_tree_item` moves a note or folder only to an existing Inbox
  folder.
- Archive and Trash are lifecycle workspaces, not normal organization roots.
  They expose restore and trash actions only when valid for the item's current
  state.

Archive, trash, and restore accept both notes and folders. Moving a folder
applies to its whole Markdown subtree, preserves manifest-owned note UUIDs, and
rebinds every descendant path atomically. A target collision, a path outside
the vault, an Inbox-rule violation, or a move into the folder's own descendant
is rejected before the filesystem changes. If metadata persistence fails after
a filesystem move, the command restores the source directory and leaves the
previous manifest mapping intact.

The Zustand store flushes a pending editor save before any tree mutation. It
then reloads the backend's authoritative workspace tree on success, keeping a
selected stable note ID only when it remains visible. On command failure it
retains the previous tree, search state, and selection. The context menu closes
before opening a create, rename, or move dialog so Radix focus restoration does
not conflict with the dialog focus trap.

Tree drag and drop:

- The explorer lets the user begin a drag from any Inbox note or folder row.
- Only existing Inbox folders are valid targets. A drop makes the source a
  direct child of that folder; it does not reorder siblings.
- The frontend validates targets from the physical tree before sending the
  existing moveTreeItem intent. It rejects note targets, Archive, Trash, the
  source folder, its descendants, and no-op moves to the current parent.
- A valid collapsed destination opens after 600 ms of hover. The editor stays
  mounted while the store performs its durable operation.
- Context-menu move remains the accessible alternative. Drag failure is shown
  through the existing localized lifecycle snackbar while the store retains its
  previous tree and selection snapshot.

Vault migration:

- `migrate_notes_vault` copies or moves notes from a source vault into the
  active vault.
- The destination is always the currently active vault resolved by the backend.
- The source must be an absolute local path and must differ from the active
  vault.
- File conflicts are detected before any copy or move starts.
- The migration preserves `inbox/`, `archive/`, `trash/`, and applicable
  `.axis-notes/sidecars/` and `.axis-notes/config/` files.
- `.axis-notes/cache/` and `.axis-notes/manifest.json` are not migrated because
  the cache is rebuildable and the destination vault owns its own manifest.
- Manifest-owned UUID mappings for migrated notes are copied into the
  destination manifest, so note identity and future sidecar references survive
  a local vault migration.
- In move mode, source files are removed only after all files have been copied
  to the destination.

## Backend Responsibilities

The Rust notes command layer owns the durable contract:

- Resolve the active vault path from preferences or the default documents path.
- Create and validate the vault structure.
- Keep `.axis-notes/` reserved for Axis metadata.
- Prevent path traversal or filesystem escapes from the active vault.
- Read active, archived, and trashed notes as recursive physical trees from
  their respective directories.
- Move notes between lifecycle directories.
- Copy or move notes from a previous local vault into the active local vault
  only through the explicit migration command.
- Open the active vault folder through the operating system.
- Expose typed command results through generated Tauri bindings.

Frontend code should not infer note file paths, create vault folders directly,
or mutate notes outside the typed command layer.

## Store Responsibilities

`src/store/notes-store.ts` is the UI state boundary for the notes domain.

The store owns:

- `vaultInfo` and `vaultError` for the active local vault state.
- `workspaceView`, currently `inbox`, `archive`, or `trash`.
- The recursive workspace tree, its flattened notes for editor/search behavior,
  search results, selected note, selected tag, and loading flags.
- Debounced save flushing before lifecycle moves or vault switches.
- Optimistic remove and rollback for archive/delete.
- Resetting selection and filters when the active vault changes.

Important store entrypoints:

- `loadNotes()` loads vault info and a recursive physical tree for the current
  workspace.
- `loadWidgetNotes()` is the dashboard/widget entrypoint and forces the inbox
  workspace.
- `setWorkspaceView()` changes between inbox, archive, and trash, clearing the
  active selection.
- `setVaultPath()` and `resetVaultPath()` change the active vault through typed
  backend commands.
- `pendingMigrationSourcePath` remembers the previous vault path after a
  successful switch so the UI can offer explicit copy/move actions without
  automatically migrating data.
- `migratePendingVault()` runs the explicit migration command, reloads active
  notes, and clears the pending migration prompt only after success.
- `createNote()`, `updateNote()`, `archiveNote()`, `deleteNote()`, and
  `restoreNote()` wrap the backend lifecycle commands.
- `createNote(content, folder?)` passes an optional existing Inbox folder to
  the typed backend command and inserts the returned note into that physical
  tree location.

Components should use store actions rather than calling notes vault commands
directly, except for isolated quick-entry flows that intentionally only create a
new note.

## Surface Responsibilities

Notes Page:

- Provides the full notes workspace.
- Lets the user navigate inbox, archive, and trash.
- Keeps inbox notes editable.
- Treats archive and trash as lifecycle views, not normal editing surfaces.
- Owns empty states, filter-aware feedback, and snackbar actions for note
  lifecycle operations.
- Offers the user-facing action to open the vault folder.
- Uses one imperative CodeMirror `EditorView` for the active writing surface.
  React does not control the document on every keystroke: document changes are
  sent to the store through the editor update listener, and note navigation
  replaces the document inside the existing view.
- Edit mode applies Markdown syntax-tree decorations only to visible ranges.
  Closed markers are hidden away from the active selection while semantic
  formatting remains visible. Preview is a strict read-only rendering path and
  has no editor save callback.
- Markdown command transformations emit ordinary persisted Markdown. The
  CodeMirror command extension provides matching keyboard shortcuts and slash
  commands for inline formatting, blocks, links, and local dates. Toast UI is
  used only to render the read-only Preview surface.
- External document replacement keeps the existing cursor or selection when
  its positions remain valid, otherwise clamps them to the replacement content.
  Such replacements never invoke the user-edit callback or create a save.

Dashboard notes widget:

- Provides quick capture and quick access to inbox notes.
- Uses `loadWidgetNotes()` so it does not expose archive or trash as editable
  widget content.
- Creates notes in the active vault inbox.
- Opens the full Notes Page for deeper editing.

Preferences notes pane:

- Shows the active vault path.
- Lets the user choose a different local folder.
- Lets the user reset to the default Axis vault path.
- Offers explicit copy/move actions from the previous vault after a successful
  vault switch.
- Lets the user open the active vault folder.
- Surfaces validation errors and keeps the previous valid vault when a new path
  is invalid.

Quick pane note capture:

- Creates a new note through the typed `createNote` command.
- Does not manage workspace lifecycle.
- May navigate to Notes Page after creating the note.

## Local-Only Boundaries

Axis currently assumes the vault is local and user-visible. That means:

- There is no remote source of truth.
- There is no sync scheduler.
- There is no merge/conflict model.
- There is no mobile or web access contract for notes.
- Import/export from Obsidian or Notion is a future product decision, not part
  of this vault contract.
- Moving or copying between local Axis vaults is local-only and does not create
  a remote source of truth.

Future work that changes these assumptions should update this document before
or alongside implementation.

## Implementation Rules

- Prefer extending `VaultLayout` over adding new hard-coded path checks.
- Keep user Markdown in note files and Axis-owned structured metadata under
  `.axis-notes/`.
- Treat archive and trash as lifecycle directories, not arbitrary folders.
- Render folders from the backend tree instead of deriving artificial date
  groups. Filtered search results may use a flat list so matching notes are not
  hidden by collapsed folders.
- Flush pending editor saves before moving or switching vaults.
- Do not migrate notes automatically when changing the active vault path.
- Detect migration conflicts before copying or moving any file.
- Use typed generated commands from `@/lib/tauri-bindings`.
- Add tests for filesystem lifecycle rules in Rust and store behavior in
  TypeScript when changing note lifecycle behavior.
