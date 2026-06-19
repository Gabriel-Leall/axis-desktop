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
Documents/Axis Notes/
+-- inbox/
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

If `notes_vault_path` is not set, Axis resolves the active vault to the default
`Documents/Axis Notes` path.

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

- `.axis-notes/manifest.json` records internal vault metadata schema and is
  preserved after creation.
- `.axis-notes/sidecars/` is reserved for per-note structured metadata.
- `.axis-notes/cache/` is reserved for derived, rebuildable data.
- `.axis-notes/config/` is reserved for vault-scoped settings.

## Note Lifecycle

All filesystem operations go through typed Tauri commands implemented in
`src-tauri/src/commands/notes.rs`.

Create:

- `create_note` writes a Markdown file into `inbox/`.
- The current implementation treats `folder` as non-routing input; new notes
  still land in `inbox/`.
- File names are generated from title/content and made unique before writing.

Update and rename:

- `update_note` changes Markdown file content.
- `rename_note` changes the note file path while preserving the note data.

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

## Backend Responsibilities

The Rust notes command layer owns the durable contract:

- Resolve the active vault path from preferences or the default documents path.
- Create and validate the vault structure.
- Keep `.axis-notes/` reserved for Axis metadata.
- Prevent path traversal or filesystem escapes from the active vault.
- Read active, archived, and trashed notes from their physical directories.
- Move notes between lifecycle directories.
- Open the active vault folder through the operating system.
- Expose typed command results through generated Tauri bindings.

Frontend code should not infer note file paths, create vault folders directly,
or mutate notes outside the typed command layer.

## Store Responsibilities

`src/store/notes-store.ts` is the UI state boundary for the notes domain.

The store owns:

- `vaultInfo` and `vaultError` for the active local vault state.
- `workspaceView`, currently `inbox`, `archive`, or `trash`.
- Active note lists, search results, selected note, selected tag, and loading
  flags.
- Debounced save flushing before lifecycle moves or vault switches.
- Optimistic remove and rollback for archive/delete.
- Resetting selection and filters when the active vault changes.

Important store entrypoints:

- `loadNotes()` loads vault info and notes for the current workspace.
- `loadWidgetNotes()` is the dashboard/widget entrypoint and forces the inbox
  workspace.
- `setWorkspaceView()` changes between inbox, archive, and trash, clearing the
  active selection.
- `setVaultPath()` and `resetVaultPath()` change the active vault through typed
  backend commands.
- `createNote()`, `updateNote()`, `archiveNote()`, `deleteNote()`, and
  `restoreNote()` wrap the backend lifecycle commands.

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

Future work that changes these assumptions should update this document before
or alongside implementation.

## Implementation Rules

- Prefer extending `VaultLayout` over adding new hard-coded path checks.
- Keep user Markdown in note files and Axis-owned structured metadata under
  `.axis-notes/`.
- Treat archive and trash as lifecycle directories, not arbitrary folders.
- Flush pending editor saves before moving or switching vaults.
- Use typed generated commands from `@/lib/tauri-bindings`.
- Add tests for filesystem lifecycle rules in Rust and store behavior in
  TypeScript when changing note lifecycle behavior.
