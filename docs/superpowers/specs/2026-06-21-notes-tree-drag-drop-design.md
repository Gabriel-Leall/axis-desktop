# Notes Tree Drag And Drop Design

## Goal

Implement issue #63: move an Inbox note or folder by dragging it onto another
Inbox folder, while preserving stable IDs, the active editor, and the existing
safe vault-mutation contract.

## Scope

- Use the existing `@dnd-kit/core` dependency and the existing
  `moveTreeItem` store action.
- Start a drag from any part of a note or folder row.
- Allow drops only onto Inbox folders.
- A valid drop makes the source item a direct child of the target folder. This
  feature does not reorder siblings or persist a custom visual sort order.
- Open a collapsed target folder after a 600 ms hover delay.
- Keep Archive and Trash read-only as drag destinations.
- Preserve the right-click menu as the accessible alternative for all moves.

## Architecture

`NotesExplorerTree` owns short-lived drag interaction state only: active item,
current target, hover timer, and temporary expanded folders. It never derives
an absolute filesystem path or calls Tauri directly.

A pure domain helper validates a potential drop from stable item references and
the current workspace tree. It rejects a note target, a non-Inbox workspace,
the source folder itself, and any descendant folder. A valid result contains the
Inbox-relative destination folder path.

On drop, the tree sends the existing `moveTreeItem(item, destinationFolder)`
intent upward. The notes store remains the transaction boundary: it flushes an
edited note, calls the typed Tauri command, reloads the authoritative workspace
tree, retains a surviving stable selection, and restores the tree/search/
selection snapshot on failure.

## User Feedback

- Valid targets receive the Notes paper-theme destination highlight.
- Invalid targets receive a blocked state and do not accept a drop.
- `DragOverlay` displays the dragged item title/name without duplicating tree
  structure.
- A failed backend move leaves the editor mounted, restores prior tree state,
  and shows the existing localized lifecycle-error snackbar.

## Testing

- Unit tests: valid Inbox target, note target rejection, lifecycle workspace
  rejection, self/descendant folder rejection, and optimistic tree projection.
- Component tests: note/folder drag intent, visual target states, Trash
  restore-only behavior, 600 ms temporary expansion, and no context-menu
  regression.
- Page/store tests: valid drop calls `moveTreeItem`; a failed command preserves
  tree and selection; editor remains mounted throughout a move.

## Non-Goals

- Manual ordering between sibling notes/folders.
- Dragging into Archive or Trash.
- Cross-vault drag and drop.
- Replacing keyboard or context-menu move actions.
