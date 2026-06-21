use super::*;

pub(super) fn read_all_notes(root: &Path) -> Result<Vec<Note>, String> {
    let mut notes = Vec::new();
    let layout = VaultLayout::standard();

    fn walk(
        root: &Path,
        dir: &Path,
        layout: &VaultLayout,
        out: &mut Vec<Note>,
    ) -> Result<(), String> {
        let entries =
            std::fs::read_dir(dir).map_err(|e| format!("Failed to list notes directory: {e}"))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
            let path = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|e| format!("Failed to read entry type: {e}"))?;

            if file_type.is_dir() {
                let dir_name = entry.file_name();
                let dir_name = dir_name.to_string_lossy();
                let is_top_level_lifecycle_dir =
                    path.parent() == Some(root) && layout.is_lifecycle_dir_name(&dir_name);
                if layout.is_internal_dir_name(&dir_name) || is_top_level_lifecycle_dir {
                    continue;
                }
                walk(root, &path, layout, out)?;
                continue;
            }

            if file_type.is_file()
                && path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("md"))
                    .unwrap_or(false)
            {
                out.push(note_from_file(root, &path)?);
            }
        }

        Ok(())
    }

    walk(root, root, &layout, &mut notes)?;
    notes.sort_by(|a, b| parse_iso_or_epoch(&b.updated_at).cmp(&parse_iso_or_epoch(&a.updated_at)));
    Ok(notes)
}

pub(super) fn read_notes_in_vault_dir(root: &Path, dir_name: &str) -> Result<Vec<Note>, String> {
    let dir_path = resolve_note_path(root, dir_name)?;
    if !dir_path.exists() {
        return Ok(Vec::new());
    }

    let mut notes = Vec::new();
    let layout = VaultLayout::standard();

    fn walk(
        root: &Path,
        dir: &Path,
        layout: &VaultLayout,
        out: &mut Vec<Note>,
    ) -> Result<(), String> {
        let entries =
            std::fs::read_dir(dir).map_err(|e| format!("Failed to list notes directory: {e}"))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
            let path = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|e| format!("Failed to read entry type: {e}"))?;

            if file_type.is_dir() {
                let name = entry.file_name();
                if !layout.is_internal_dir_name(&name.to_string_lossy()) {
                    walk(root, &path, layout, out)?;
                }
                continue;
            }

            if file_type.is_file()
                && path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("md"))
                    .unwrap_or(false)
            {
                out.push(note_from_file(root, &path)?);
            }
        }

        Ok(())
    }

    walk(root, &dir_path, &layout, &mut notes)?;

    notes.sort_by(|a, b| parse_iso_or_epoch(&b.updated_at).cmp(&parse_iso_or_epoch(&a.updated_at)));
    Ok(notes)
}

pub(super) fn read_workspace_tree(
    root: &Path,
    workspace: NotesWorkspace,
) -> Result<NoteWorkspaceTree, String> {
    let mut metadata = load_vault_metadata(root)?;
    let directory = resolve_note_path(root, workspace.directory_name())?;
    let items = read_tree_items(root, &directory, &mut metadata)?;
    metadata.persist_if_dirty()?;

    Ok(NoteWorkspaceTree { workspace, items })
}

pub(super) fn read_tree_items(
    root: &Path,
    directory: &Path,
    metadata: &mut VaultMetadata,
) -> Result<Vec<NoteTreeItem>, String> {
    let mut folders = Vec::new();
    let mut notes = Vec::new();
    let layout = VaultLayout::standard();

    for entry in std::fs::read_dir(directory)
        .map_err(|e| format!("Failed to list notes tree directory: {e}"))?
    {
        let entry = entry.map_err(|e| format!("Failed to read notes tree entry: {e}"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to read notes tree entry type: {e}"))?;
        let name = entry.file_name().to_string_lossy().to_string();

        if file_type.is_dir() {
            if layout.is_internal_dir_name(&name) {
                continue;
            }
            folders.push((name, path));
            continue;
        }

        if file_type.is_file()
            && path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
        {
            notes.push((name, path));
        }
    }

    folders.sort_by(|left, right| left.0.to_lowercase().cmp(&right.0.to_lowercase()));
    notes.sort_by(|left, right| left.0.to_lowercase().cmp(&right.0.to_lowercase()));

    let mut items = Vec::with_capacity(folders.len() + notes.len());
    for (name, path) in folders {
        let children = read_tree_items(root, &path, metadata)?;
        items.push(NoteTreeItem::Folder {
            path: relative_note_path(root, &path)?,
            name,
            children,
        });
    }
    for (_, path) in notes {
        let note = note_from_file_with_metadata(root, &path, metadata)?;
        items.push(NoteTreeItem::Note {
            note: summary_from_note(&note),
        });
    }

    Ok(items)
}
