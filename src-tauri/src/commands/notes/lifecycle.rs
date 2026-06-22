use super::*;

pub(super) fn create_notes_folder_at_path(
    root: &Path,
    parent_path: &str,
    name: &str,
) -> Result<(), String> {
    let normalized_parent = normalize_rel_path(parent_path);
    if normalized_parent != INBOX_DIR && !normalized_parent.starts_with(&format!("{INBOX_DIR}/")) {
        return Err("Folders can only be created inside Inbox".to_string());
    }

    let trimmed_name = validated_folder_name(name)?;

    let parent_abs = resolve_note_path(root, &normalized_parent)?;
    if !parent_abs.is_dir() {
        return Err("Destination folder does not exist".to_string());
    }

    let destination = parent_abs.join(trimmed_name);
    if destination.exists() {
        return Err("A folder with this name already exists".to_string());
    }

    std::fs::create_dir(&destination).map_err(|e| format!("Failed to create notes folder: {e}"))
}

pub(super) fn validated_folder_name(name: &str) -> Result<&str, String> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty()
        || trimmed_name.contains('/')
        || trimmed_name.contains('\\')
        || trimmed_name == "."
        || trimmed_name == ".."
        || Path::new(trimmed_name).components().count() != 1
    {
        return Err("Folder name must be a single non-empty path segment".to_string());
    }

    Ok(trimmed_name)
}

pub(super) fn resolve_inbox_folder(root: &Path, folder_path: &str) -> Result<PathBuf, String> {
    let normalized = normalize_rel_path(folder_path);
    if normalized != INBOX_DIR && !normalized.starts_with(&format!("{INBOX_DIR}/")) {
        return Err("Normal moves are only allowed inside Inbox".to_string());
    }

    let folder = resolve_note_path(root, &normalized)?;
    if !folder.is_dir() {
        return Err("Destination folder does not exist".to_string());
    }

    Ok(folder)
}

pub(super) fn move_note_to_inbox_folder(
    root: &Path,
    id: &str,
    destination_folder: &str,
) -> Result<Note, String> {
    let mut metadata = load_vault_metadata(root)?;
    let source = resolve_note_path_by_id(root, &mut metadata, id)?;
    let source_path = relative_note_path(root, &source)?;

    if note_top_level_dir_name(&source_path).as_deref() != Some(INBOX_DIR) {
        return Err("Only Inbox notes can be moved into an Inbox folder".to_string());
    }

    let destination_folder = resolve_inbox_folder(root, destination_folder)?;
    let file_name = source
        .file_name()
        .ok_or_else(|| "Invalid note path".to_string())?;
    let destination = destination_folder.join(file_name);

    if destination == source {
        return note_from_file_with_metadata(root, &source, &mut metadata);
    }
    if destination.exists() {
        return Err("A note with this name already exists in the destination folder".to_string());
    }

    std::fs::rename(&source, &destination).map_err(|e| format!("Failed to move note: {e}"))?;
    let destination_path = relative_note_path(root, &destination)?;
    metadata.rebind_path(&source_path, &destination_path);

    if let Err(error) = metadata.persist_if_dirty() {
        if let Err(rollback_error) = std::fs::rename(&destination, &source) {
            return Err(format!(
                "Failed to persist note move metadata: {error}; rollback also failed: {rollback_error}"
            ));
        }
        return Err(format!("Failed to persist note move metadata: {error}"));
    }

    note_from_file_with_metadata(root, &destination, &mut metadata)
}

pub(super) fn move_folder_to_inbox_folder(
    root: &Path,
    source_folder: &str,
    destination_folder: &str,
) -> Result<(), String> {
    let source = resolve_inbox_folder(root, source_folder)?;
    let destination_parent = resolve_inbox_folder(root, destination_folder)?;
    let source_path = relative_note_path(root, &source)?;

    if source_path == INBOX_DIR {
        return Err("The Inbox root cannot be moved".to_string());
    }

    let canonical_source = source
        .canonicalize()
        .map_err(|e| format!("Failed to inspect source folder: {e}"))?;
    let canonical_destination_parent = destination_parent
        .canonicalize()
        .map_err(|e| format!("Failed to inspect destination folder: {e}"))?;
    if canonical_destination_parent.starts_with(&canonical_source) {
        return Err("A folder cannot be moved into itself or one of its descendants".to_string());
    }

    let folder_name = source
        .file_name()
        .ok_or_else(|| "Invalid source folder path".to_string())?;
    move_folder_to_path(root, &source, &destination_parent.join(folder_name))
}

pub(super) fn move_folder_to_path(
    root: &Path,
    source: &Path,
    destination: &Path,
) -> Result<(), String> {
    let source_path = relative_note_path(root, source)?;
    if destination.exists() {
        return Err("A folder with this name already exists in the destination folder".to_string());
    }

    let mut metadata = load_vault_metadata(root)?;
    // Assign mappings for markdown files that were not opened before this folder move.
    read_tree_items(root, source, &mut metadata)?;

    std::fs::rename(source, destination).map_err(|e| format!("Failed to move folder: {e}"))?;
    let destination_path = relative_note_path(root, destination)?;
    let source_prefix = format!("{source_path}/");
    let mapped_paths: Vec<String> = metadata
        .manifest
        .note_ids_by_path
        .keys()
        .filter(|path| path.starts_with(&source_prefix))
        .cloned()
        .collect();

    for path in mapped_paths {
        let suffix = path
            .strip_prefix(&source_prefix)
            .ok_or_else(|| "Failed to rebind moved folder note path".to_string())?;
        metadata.rebind_path(&path, &format!("{destination_path}/{suffix}"));
    }

    if let Err(error) = metadata.persist_if_dirty() {
        if let Err(rollback_error) = std::fs::rename(destination, source) {
            return Err(format!(
                "Failed to persist folder move metadata: {error}; rollback also failed: {rollback_error}"
            ));
        }
        return Err(format!("Failed to persist folder move metadata: {error}"));
    }

    Ok(())
}
pub(super) fn rename_notes_folder_at_path(
    root: &Path,
    folder_path: &str,
    name: &str,
) -> Result<(), String> {
    let source = resolve_inbox_folder(root, folder_path)?;
    let source_path = relative_note_path(root, &source)?;
    if source_path == INBOX_DIR {
        return Err("The Inbox root cannot be renamed".to_string());
    }

    let parent = source
        .parent()
        .ok_or_else(|| "Invalid source folder path".to_string())?;
    let destination = parent.join(validated_folder_name(name)?);
    if destination == source {
        return Ok(());
    }

    move_folder_to_path(root, &source, &destination)
}

pub(super) fn move_folder_to_lifecycle_dir(
    root: &Path,
    folder_path: &str,
    destination_dir: &str,
) -> Result<(), String> {
    let layout = VaultLayout::standard();
    if !layout.is_lifecycle_dir_name(destination_dir) {
        return Err("Invalid lifecycle destination".to_string());
    }

    let source = resolve_note_path(root, folder_path)?;
    if !source.is_dir() {
        return Err("Folder not found".to_string());
    }
    let source_path = relative_note_path(root, &source)?;
    let source_top_level = note_top_level_dir_name(&source_path)
        .ok_or_else(|| "Invalid source folder path".to_string())?;
    if !matches!(
        source_top_level.as_str(),
        INBOX_DIR | ARCHIVE_DIR | TRASH_DIR
    ) || source_path == source_top_level
    {
        return Err("Only folders inside a Notes workspace can change lifecycle".to_string());
    }
    if source_top_level == destination_dir {
        return Ok(());
    }

    let destination_parent = resolve_note_path(root, destination_dir)?;
    let folder_name = source
        .file_name()
        .ok_or_else(|| "Invalid source folder path".to_string())?;
    move_folder_to_path(root, &source, &destination_parent.join(folder_name))
}

pub(super) fn move_notes_tree_item_at_path(
    root: &Path,
    item: NotesTreeItemRef,
    destination_folder: &str,
) -> Result<(), String> {
    match item {
        NotesTreeItemRef::Note { id } => {
            move_note_to_inbox_folder(root, &id, destination_folder)?;
        }
        NotesTreeItemRef::Folder { path } => {
            move_folder_to_inbox_folder(root, &path, destination_folder)?;
        }
    }

    Ok(())
}

pub(super) fn move_tree_item_to_lifecycle_dir(
    root: &Path,
    item: NotesTreeItemRef,
    destination_dir: &str,
) -> Result<(), String> {
    match item {
        NotesTreeItemRef::Note { id } => {
            move_note_to_lifecycle_dir(root, &id, destination_dir)?;
        }
        NotesTreeItemRef::Folder { path } => {
            move_folder_to_lifecycle_dir(root, &path, destination_dir)?;
        }
    }

    Ok(())
}

pub(super) fn restore_folder_to_inbox(root: &Path, folder_path: &str) -> Result<(), String> {
    let source = resolve_note_path(root, folder_path)?;
    if !source.is_dir() {
        return Err("Folder not found".to_string());
    }

    let source_path = relative_note_path(root, &source)?;
    let source_top_level = note_top_level_dir_name(&source_path)
        .ok_or_else(|| "Invalid source folder path".to_string())?;
    if !matches!(source_top_level.as_str(), ARCHIVE_DIR | TRASH_DIR)
        || source_path == source_top_level
    {
        return Err("Only archived or trashed folders can be restored".to_string());
    }

    let inbox = resolve_note_path(root, INBOX_DIR)?;
    let folder_name = source
        .file_name()
        .ok_or_else(|| "Invalid source folder path".to_string())?;
    move_folder_to_path(root, &source, &inbox.join(folder_name))
}

pub(super) fn restore_notes_tree_item_to_inbox(
    root: &Path,
    item: NotesTreeItemRef,
) -> Result<(), String> {
    match item {
        NotesTreeItemRef::Note { id } => {
            restore_note_to_inbox(root, &id)?;
        }
        NotesTreeItemRef::Folder { path } => {
            restore_folder_to_inbox(root, &path)?;
        }
    }

    Ok(())
}

