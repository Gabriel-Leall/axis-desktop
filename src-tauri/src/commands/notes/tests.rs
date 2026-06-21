use super::*;
use std::sync::atomic::{AtomicU64, Ordering};

static TEMP_DIR_COUNTER: AtomicU64 = AtomicU64::new(0);

fn test_vault_root(prefix: &str) -> PathBuf {
    let suffix = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system time should be after epoch")
        .as_nanos();
    let pid = std::process::id();
    let counter = TEMP_DIR_COUNTER.fetch_add(1, Ordering::Relaxed);

    std::env::temp_dir().join(format!("{prefix}-{pid}-{counter}-{suffix}"))
}

#[cfg(unix)]
fn create_dir_symlink(original: &Path, link: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(original, link)
}

#[cfg(windows)]
fn create_dir_symlink(original: &Path, link: &Path) -> std::io::Result<()> {
    std::os::windows::fs::symlink_dir(original, link)
}

#[cfg(not(any(unix, windows)))]
fn create_dir_symlink(_original: &Path, _link: &Path) -> std::io::Result<()> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "symlink tests are not supported on this platform",
    ))
}

#[cfg(unix)]
fn create_file_symlink(original: &Path, link: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(original, link)
}

#[cfg(windows)]
fn create_file_symlink(original: &Path, link: &Path) -> std::io::Result<()> {
    std::os::windows::fs::symlink_file(original, link)
}

#[cfg(not(any(unix, windows)))]
fn create_file_symlink(_original: &Path, _link: &Path) -> std::io::Result<()> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "symlink tests are not supported on this platform",
    ))
}

#[test]
fn extracts_tags_ignoring_code_blocks() {
    let body = "# Title\n#work\n`#inline`\n```ts\n#hidden\n```\n#project";
    let tags = extract_tags(body);
    assert_eq!(tags, vec!["project".to_string(), "work".to_string()]);
}

#[test]
fn extracts_wikilinks_with_alias() {
    let body = "See [[Roadmap]] and [[Project Plan|plan]].";
    let links = extract_wikilinks(body);
    assert_eq!(
        links,
        vec!["Project Plan".to_string(), "Roadmap".to_string()]
    );
}

#[test]
fn builds_excerpt_from_markdown_body() {
    let body = "# Main title\n\nSome **rich** text with [[Wiki Link]].";
    let excerpt = build_excerpt(body);
    assert!(excerpt.contains("Some rich text with Wiki Link"));
    assert!(!excerpt.contains('#'));
}

#[test]
fn default_vault_path_uses_visible_axis_notes_folder() {
    let documents = Path::new("Documents");
    let path = default_vault_path_from_documents(documents);

    assert_eq!(path, documents.join("Axis_Notes"));
}

#[test]
fn vault_layout_declares_required_and_internal_directories() {
    let layout = VaultLayout::standard();

    assert_eq!(
        layout.required_dirs(),
        [INBOX_DIR, ARCHIVE_DIR, TRASH_DIR, VAULT_METADATA_DIR]
    );
    assert_eq!(
        layout.metadata_dirs(),
        [VAULT_SIDECARS_DIR, VAULT_CACHE_DIR, VAULT_CONFIG_DIR]
    );
    assert!(layout.is_internal_dir_name(VAULT_METADATA_DIR));
    assert!(!layout.is_internal_dir_name(INBOX_DIR));
    assert!(!layout.is_internal_dir_name(ARCHIVE_DIR));
    assert!(!layout.is_internal_dir_name(TRASH_DIR));
}

#[test]
fn ensure_vault_structure_creates_required_directories() {
    let root = test_vault_root("axis-notes-vault-test");

    ensure_vault_structure(&root).expect("vault structure should be created");

    assert!(root.join("inbox").is_dir());
    assert!(root.join("archive").is_dir());
    assert!(root.join("trash").is_dir());
    assert!(root.join(".axis-notes").is_dir());

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn ensure_vault_structure_creates_metadata_manifest_and_reserved_subdirs() {
    let root = test_vault_root("axis-notes-metadata-test");

    ensure_vault_structure(&root).expect("vault structure should be created");

    let metadata_root = root.join(VAULT_METADATA_DIR);
    let manifest_path = metadata_root.join(VAULT_MANIFEST_FILE);
    let manifest: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&manifest_path).expect("manifest should be readable"),
    )
    .expect("manifest should be valid JSON");

    assert!(metadata_root.join(VAULT_SIDECARS_DIR).is_dir());
    assert!(metadata_root.join(VAULT_CACHE_DIR).is_dir());
    assert!(metadata_root.join(VAULT_CONFIG_DIR).is_dir());
    assert_eq!(manifest["schema_version"], VAULT_METADATA_SCHEMA_VERSION);
    assert_eq!(manifest["application"], "axis-desktop");
    assert!(manifest["created_at"]
        .as_str()
        .is_some_and(|v| !v.is_empty()));
    assert!(manifest["updated_at"]
        .as_str()
        .is_some_and(|v| !v.is_empty()));

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn ensure_empty_vault_seeds_welcome_note_with_stable_id() {
    let root = test_vault_root("axis-notes-welcome-seed-test");

    ensure_vault_structure(&root).expect("vault structure should be created");

    let welcome_path = root
        .join(INBOX_DIR)
        .join("Comece aqui")
        .join("Bem-vindo ao Axis.md");
    assert!(welcome_path.is_file());

    let content = std::fs::read_to_string(&welcome_path).expect("welcome note should be readable");
    assert!(content.contains("notas locais"));

    let manifest_path = root.join(VAULT_METADATA_DIR).join(VAULT_MANIFEST_FILE);
    let manifest: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(manifest_path).expect("manifest should be readable"),
    )
    .expect("manifest should be valid JSON");
    let welcome_id = manifest["welcome_note_id"]
        .as_str()
        .expect("welcome note should have a stable ID");
    assert_eq!(
        manifest["note_ids_by_path"]["inbox/Comece aqui/Bem-vindo ao Axis.md"].as_str(),
        Some(welcome_id)
    );

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn ensure_existing_vault_never_receives_welcome_content() {
    let root = test_vault_root("axis-notes-existing-vault-test");
    let inbox = root.join(INBOX_DIR);
    std::fs::create_dir_all(&inbox).expect("inbox should be creatable");
    std::fs::write(inbox.join("existing.md"), "# Existing")
        .expect("existing note should be writable");

    ensure_vault_structure(&root).expect("vault structure should be created");

    assert!(!root.join(INBOX_DIR).join("Comece aqui").exists());

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn note_file_uses_a_manifest_owned_stable_id() {
    let root = test_vault_root("axis-notes-stable-id-test");
    ensure_vault_structure(&root).expect("vault structure should be created");
    let note_path = root.join(INBOX_DIR).join("plan.md");
    std::fs::write(&note_path, "# Plan").expect("note fixture should be writable");

    let first = note_from_file(&root, &note_path).expect("first read should succeed");
    let second = note_from_file(&root, &note_path).expect("second read should succeed");

    assert_ne!(first.id, first.path);
    assert_eq!(first.id, second.id);

    let manifest: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(root.join(VAULT_METADATA_DIR).join(VAULT_MANIFEST_FILE))
            .expect("manifest should be readable"),
    )
    .expect("manifest should be valid JSON");
    assert_eq!(
        manifest["note_ids_by_path"]["inbox/plan.md"].as_str(),
        Some(first.id.as_str())
    );

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn ensure_vault_structure_preserves_existing_metadata_manifest() {
    let root = test_vault_root("axis-notes-existing-metadata-test");
    let metadata_root = root.join(VAULT_METADATA_DIR);
    std::fs::create_dir_all(&metadata_root).expect("metadata root should be creatable");
    let manifest_path = metadata_root.join(VAULT_MANIFEST_FILE);
    let existing_manifest = r#"{"schema_version":1,"application":"axis-desktop","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"}"#;
    std::fs::write(&manifest_path, existing_manifest).expect("manifest should be writable");

    ensure_vault_structure(&root).expect("vault structure should be completed");

    assert_eq!(
        std::fs::read_to_string(&manifest_path).expect("manifest should be readable"),
        existing_manifest
    );

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn ensure_vault_structure_rejects_manifest_path_that_is_not_a_file() {
    let root = test_vault_root("axis-notes-invalid-manifest-test");
    let manifest_path = root.join(VAULT_METADATA_DIR).join(VAULT_MANIFEST_FILE);
    std::fs::create_dir_all(&manifest_path).expect("manifest path directory should be created");

    let result = ensure_vault_structure(&root);

    assert!(result.is_err());

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn ensure_vault_structure_rejects_metadata_root_that_is_not_a_directory() {
    let root = test_vault_root("axis-notes-invalid-metadata-root-test");
    std::fs::create_dir_all(&root).expect("test vault root should be creatable");
    std::fs::write(root.join(VAULT_METADATA_DIR), "not a directory")
        .expect("metadata root file should be writable");

    let result = ensure_vault_structure(&root);

    assert!(result.is_err());

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn ensure_vault_structure_rejects_metadata_root_symlink_escape() {
    let root = test_vault_root("axis-notes-symlink-metadata-root-test");
    let external = test_vault_root("axis-notes-symlink-metadata-external-test");
    std::fs::create_dir_all(&root).expect("test vault root should be creatable");
    std::fs::create_dir_all(&external).expect("external directory should be creatable");

    if create_dir_symlink(&external, &root.join(VAULT_METADATA_DIR)).is_err() {
        std::fs::remove_dir_all(root).expect("test vault should be removable");
        std::fs::remove_dir_all(external).expect("external directory should be removable");
        return;
    }

    let result = ensure_vault_structure(&root);

    assert!(result
        .expect_err("metadata symlink should be rejected")
        .contains("must not be a symlink"));

    std::fs::remove_dir_all(root).expect("test vault should be removable");
    std::fs::remove_dir_all(external).expect("external directory should be removable");
}

#[test]
fn ensure_vault_structure_rejects_manifest_symlink_escape() {
    let root = test_vault_root("axis-notes-symlink-manifest-test");
    let external = test_vault_root("axis-notes-symlink-manifest-external-test");
    let metadata_root = root.join(VAULT_METADATA_DIR);
    std::fs::create_dir_all(&metadata_root).expect("metadata root should be creatable");
    std::fs::create_dir_all(&external).expect("external directory should be creatable");
    let external_manifest = external.join(VAULT_MANIFEST_FILE);
    std::fs::write(&external_manifest, "{}").expect("external manifest should be writable");

    if create_file_symlink(&external_manifest, &metadata_root.join(VAULT_MANIFEST_FILE)).is_err() {
        std::fs::remove_dir_all(root).expect("test vault should be removable");
        std::fs::remove_dir_all(external).expect("external directory should be removable");
        return;
    }

    let result = ensure_vault_structure(&root);

    assert!(result
        .expect_err("manifest symlink should be rejected")
        .contains("must not be a symlink"));

    std::fs::remove_dir_all(root).expect("test vault should be removable");
    std::fs::remove_dir_all(external).expect("external directory should be removable");
}

#[test]
fn ensure_vault_structure_rejects_metadata_subdirectory_symlink_escape() {
    let root = test_vault_root("axis-notes-symlink-subdir-test");
    let external = test_vault_root("axis-notes-symlink-subdir-external-test");
    let metadata_root = root.join(VAULT_METADATA_DIR);
    std::fs::create_dir_all(&metadata_root).expect("metadata root should be creatable");
    std::fs::create_dir_all(&external).expect("external directory should be creatable");

    if create_dir_symlink(&external, &metadata_root.join(VAULT_SIDECARS_DIR)).is_err() {
        std::fs::remove_dir_all(root).expect("test vault should be removable");
        std::fs::remove_dir_all(external).expect("external directory should be removable");
        return;
    }

    let result = ensure_vault_structure(&root);

    assert!(result
        .expect_err("metadata subdirectory symlink should be rejected")
        .contains("must not be a symlink"));

    std::fs::remove_dir_all(root).expect("test vault should be removable");
    std::fs::remove_dir_all(external).expect("external directory should be removable");
}

#[test]
fn read_all_notes_ignores_vault_internal_metadata_dir() {
    let root = test_vault_root("axis-notes-read-test");
    ensure_vault_structure(&root).expect("vault structure should be created");

    std::fs::write(root.join("inbox").join("visible.md"), "# Visible")
        .expect("visible note should be writable");
    std::fs::write(root.join(".axis-notes").join("hidden.md"), "# Hidden")
        .expect("metadata note should be writable");
    std::fs::write(
        root.join(".axis-notes")
            .join(VAULT_SIDECARS_DIR)
            .join("hidden-sidecar.md"),
        "# Hidden sidecar",
    )
    .expect("metadata sidecar should be writable");

    let notes = read_all_notes(&root).expect("notes should be readable");

    assert_eq!(notes.len(), 2);
    assert!(notes.iter().any(|note| note.path == "inbox/visible.md"));
    assert!(notes
        .iter()
        .any(|note| note.path == WELCOME_NOTE_RELATIVE_PATH));

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn read_all_notes_excludes_archive_and_trash_from_active_listing() {
    let root = test_vault_root("axis-notes-lifecycle-list-test");
    ensure_vault_structure(&root).expect("vault structure should be created");

    std::fs::write(root.join("inbox").join("visible.md"), "# Visible")
        .expect("visible note should be writable");
    std::fs::write(root.join("archive").join("archived.md"), "# Archived")
        .expect("archived note should be writable");
    std::fs::write(root.join("trash").join("trashed.md"), "# Trashed")
        .expect("trashed note should be writable");

    let notes = read_all_notes(&root).expect("notes should be readable");

    assert_eq!(notes.len(), 2);
    assert!(notes.iter().any(|note| note.path == "inbox/visible.md"));
    assert!(notes
        .iter()
        .any(|note| note.path == WELCOME_NOTE_RELATIVE_PATH));

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn read_notes_in_vault_dir_lists_archive_and_trash_independently() {
    let root = test_vault_root("axis-notes-lifecycle-dir-list-test");
    ensure_vault_structure(&root).expect("vault structure should be created");

    std::fs::write(root.join("inbox").join("visible.md"), "# Visible")
        .expect("visible note should be writable");
    std::fs::write(root.join("archive").join("archived.md"), "# Archived")
        .expect("archived note should be writable");
    std::fs::write(root.join("trash").join("trashed.md"), "# Trashed")
        .expect("trashed note should be writable");

    let archived_notes =
        read_notes_in_vault_dir(&root, ARCHIVE_DIR).expect("archive notes should be readable");
    let trashed_notes =
        read_notes_in_vault_dir(&root, TRASH_DIR).expect("trash notes should be readable");

    assert_eq!(archived_notes.len(), 1);
    assert_eq!(archived_notes[0].path, "archive/archived.md");
    assert_eq!(trashed_notes.len(), 1);
    assert_eq!(trashed_notes[0].path, "trash/trashed.md");

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn read_notes_in_vault_dir_includes_nested_note_paths() {
    let root = test_vault_root("axis-notes-nested-workspace-test");
    ensure_vault_structure(&root).expect("vault structure should be created");
    let nested = root.join(INBOX_DIR).join("projects").join("axis");
    std::fs::create_dir_all(&nested).expect("nested folder should be creatable");
    std::fs::write(root.join(INBOX_DIR).join("root.md"), "# Root")
        .expect("root note should be writable");
    std::fs::write(nested.join("plan.md"), "# Plan").expect("nested note should be writable");

    let notes =
        read_notes_in_vault_dir(&root, INBOX_DIR).expect("workspace notes should be readable");
    let paths: Vec<&str> = notes.iter().map(|note| note.path.as_str()).collect();

    assert!(paths.contains(&"inbox/root.md"));
    assert!(paths.contains(&"inbox/projects/axis/plan.md"));

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn workspace_tree_keeps_physical_folder_nesting_and_stable_note_ids() {
    let root = test_vault_root("axis-notes-tree-test");
    ensure_vault_structure(&root).expect("vault structure should be created");
    let project = root.join(INBOX_DIR).join("projects").join("axis");
    std::fs::create_dir_all(&project).expect("project folder should be creatable");
    std::fs::write(root.join(INBOX_DIR).join("root.md"), "# Root")
        .expect("root note should be writable");
    std::fs::write(project.join("plan.md"), "# Plan").expect("nested note should be writable");
    std::fs::write(
        root.join(VAULT_METADATA_DIR)
            .join(VAULT_SIDECARS_DIR)
            .join("hidden.md"),
        "# Hidden",
    )
    .expect("internal fixture should be writable");

    let tree = read_workspace_tree(&root, NotesWorkspace::Inbox)
        .expect("workspace tree should be readable");

    assert_eq!(tree.workspace, NotesWorkspace::Inbox);
    assert_eq!(tree.items.len(), 3);
    assert!(
        matches!(tree.items.first(), Some(NoteTreeItem::Folder { name, .. }) if name == "Comece aqui")
    );
    assert!(
        matches!(tree.items.get(1), Some(NoteTreeItem::Folder { name, .. }) if name == "projects")
    );
    assert!(
        matches!(tree.items.get(2), Some(NoteTreeItem::Note { note }) if note.path == "inbox/root.md" && note.id != note.path)
    );
    assert!(!tree_contains_path(&tree, ".axis-notes/sidecars/hidden.md"));
    assert!(tree_contains_path(&tree, "inbox/projects/axis/plan.md"));

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn move_note_to_lifecycle_dir_preserves_note_in_destination() {
    let root = test_vault_root("axis-notes-lifecycle-move-test");
    ensure_vault_structure(&root).expect("vault structure should be created");
    let source = root.join("inbox").join("plan.md");
    std::fs::write(&source, "# Plan").expect("source note should be writable");

    let moved = move_note_to_lifecycle_dir(&root, "inbox/plan.md", ARCHIVE_DIR)
        .expect("note should move to archive");

    assert!(!source.exists());
    assert!(root.join("archive").join("plan.md").is_file());
    assert_eq!(moved.path, "archive/plan.md");

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn restore_note_to_inbox_uses_unique_path_without_overwriting() {
    let root = test_vault_root("axis-notes-lifecycle-restore-test");
    ensure_vault_structure(&root).expect("vault structure should be created");
    std::fs::write(root.join("inbox").join("plan.md"), "# Existing")
        .expect("existing note should be writable");
    std::fs::write(root.join("trash").join("plan.md"), "# Restored")
        .expect("trashed note should be writable");

    let restored = restore_note_to_inbox(&root, "trash/plan.md")
        .expect("trashed note should restore to inbox");

    assert_eq!(restored.path, "inbox/plan 2.md");
    assert_eq!(
        std::fs::read_to_string(root.join("inbox").join("plan 2.md"))
            .expect("restored note should be readable"),
        "# Restored"
    );
    assert!(!root.join("trash").join("plan.md").exists());

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn copy_notes_vault_contents_preserves_notes_and_metadata_without_removing_source() {
    let source = test_vault_root("axis-notes-migration-copy-source-test");
    let destination = test_vault_root("axis-notes-migration-copy-destination-test");
    ensure_vault_structure(&source).expect("source vault should be created");
    ensure_vault_structure(&destination).expect("destination vault should be created");
    std::fs::create_dir_all(source.join("inbox").join("projects"))
        .expect("nested source folder should be creatable");
    std::fs::write(
        source.join("inbox").join("projects").join("plan.md"),
        "# Plan",
    )
    .expect("nested note should be writable");
    std::fs::write(source.join("archive").join("old.md"), "# Old")
        .expect("archived note should be writable");
    std::fs::write(source.join("trash").join("removed.md"), "# Removed")
        .expect("trashed note should be writable");
    std::fs::create_dir_all(
        source
            .join(VAULT_METADATA_DIR)
            .join(VAULT_SIDECARS_DIR)
            .join("a"),
    )
    .expect("sidecar subfolder should be creatable");
    std::fs::write(
        source
            .join(VAULT_METADATA_DIR)
            .join(VAULT_SIDECARS_DIR)
            .join("a")
            .join("plan.json"),
        "{}",
    )
    .expect("sidecar metadata should be writable");
    std::fs::write(
        source
            .join(VAULT_METADATA_DIR)
            .join(VAULT_CACHE_DIR)
            .join("cache.json"),
        "{}",
    )
    .expect("cache metadata should be writable");

    let result = migrate_notes_vault_contents(&source, &destination, NoteVaultMigrationMode::Copy)
        .expect("vault contents should copy");

    assert_eq!(result.notes_migrated, 3);
    assert_eq!(result.metadata_files_migrated, 1);
    assert_eq!(result.conflicts, Vec::<String>::new());
    assert!(source
        .join("inbox")
        .join("projects")
        .join("plan.md")
        .is_file());
    assert!(destination
        .join("inbox")
        .join("projects")
        .join("plan.md")
        .is_file());
    assert!(destination.join("archive").join("old.md").is_file());
    assert!(destination.join("trash").join("removed.md").is_file());
    assert!(destination
        .join(VAULT_METADATA_DIR)
        .join(VAULT_SIDECARS_DIR)
        .join("a")
        .join("plan.json")
        .is_file());
    assert!(!destination
        .join(VAULT_METADATA_DIR)
        .join(VAULT_CACHE_DIR)
        .join("cache.json")
        .exists());

    std::fs::remove_dir_all(source).expect("source vault should be removable");
    std::fs::remove_dir_all(destination).expect("destination vault should be removable");
}

#[test]
fn move_notes_vault_contents_removes_source_files_after_copying() {
    let source = test_vault_root("axis-notes-migration-move-source-test");
    let destination = test_vault_root("axis-notes-migration-move-destination-test");
    ensure_vault_structure(&source).expect("source vault should be created");
    ensure_vault_structure(&destination).expect("destination vault should be created");
    std::fs::write(source.join("inbox").join("move-me.md"), "# Move")
        .expect("source note should be writable");
    std::fs::write(
        source
            .join(VAULT_METADATA_DIR)
            .join(VAULT_CONFIG_DIR)
            .join("local.json"),
        "{}",
    )
    .expect("config metadata should be writable");

    let result = migrate_notes_vault_contents(&source, &destination, NoteVaultMigrationMode::Move)
        .expect("vault contents should move");

    assert_eq!(result.notes_migrated, 1);
    assert_eq!(result.metadata_files_migrated, 1);
    assert!(!source.join("inbox").join("move-me.md").exists());
    assert!(!source
        .join(VAULT_METADATA_DIR)
        .join(VAULT_CONFIG_DIR)
        .join("local.json")
        .exists());
    assert!(destination.join("inbox").join("move-me.md").is_file());
    assert!(destination
        .join(VAULT_METADATA_DIR)
        .join(VAULT_CONFIG_DIR)
        .join("local.json")
        .is_file());

    std::fs::remove_dir_all(source).expect("source vault should be removable");
    std::fs::remove_dir_all(destination).expect("destination vault should be removable");
}

#[test]
fn migrate_notes_vault_contents_preserves_manifest_note_ids() {
    let source = test_vault_root("axis-notes-migration-ids-source-test");
    let destination = test_vault_root("axis-notes-migration-ids-destination-test");
    ensure_vault_structure(&source).expect("source vault should be created");
    ensure_vault_structure(&destination).expect("destination vault should be created");
    std::fs::write(source.join(INBOX_DIR).join("plan.md"), "# Plan")
        .expect("source note should be writable");

    let source_id = read_all_notes(&source)
        .expect("source notes should be readable")
        .into_iter()
        .find(|note| note.path == "inbox/plan.md")
        .expect("plan should be listed")
        .id;

    migrate_notes_vault_contents(&source, &destination, NoteVaultMigrationMode::Copy)
        .expect("vault contents should copy");

    let destination_id = read_all_notes(&destination)
        .expect("destination notes should be readable")
        .into_iter()
        .find(|note| note.path == "inbox/plan.md")
        .expect("migrated plan should be listed")
        .id;

    assert_eq!(destination_id, source_id);

    std::fs::remove_dir_all(source).expect("source vault should be removable");
    std::fs::remove_dir_all(destination).expect("destination vault should be removable");
}

#[test]
fn migrate_notes_vault_contents_rejects_conflicts_before_copying_any_file() {
    let source = test_vault_root("axis-notes-migration-conflict-source-test");
    let destination = test_vault_root("axis-notes-migration-conflict-destination-test");
    ensure_vault_structure(&source).expect("source vault should be created");
    ensure_vault_structure(&destination).expect("destination vault should be created");
    std::fs::write(source.join("inbox").join("plan.md"), "# Source")
        .expect("source note should be writable");
    std::fs::write(source.join("archive").join("old.md"), "# Old")
        .expect("source archived note should be writable");
    std::fs::write(destination.join("inbox").join("plan.md"), "# Destination")
        .expect("destination note should be writable");

    let error = migrate_notes_vault_contents(&source, &destination, NoteVaultMigrationMode::Copy)
        .expect_err("conflicting migration should fail");

    assert!(error.contains("file conflicts"));
    assert!(error.contains("inbox/plan.md"));
    assert_eq!(
        std::fs::read_to_string(destination.join("inbox").join("plan.md"))
            .expect("destination note should remain readable"),
        "# Destination"
    );
    assert!(!destination.join("archive").join("old.md").exists());
    assert!(source.join("inbox").join("plan.md").is_file());

    std::fs::remove_dir_all(source).expect("source vault should be removable");
    std::fs::remove_dir_all(destination).expect("destination vault should be removable");
}

#[test]
fn resolve_vault_root_prefers_configured_path() {
    let configured_path = std::env::temp_dir().join("Axis Vault");
    let preferences = AppPreferences {
        notes_vault_path: Some(configured_path.to_string_lossy().to_string()),
        ..AppPreferences::default()
    };

    let root = resolve_vault_root_from_preferences(Path::new("Documents"), &preferences)
        .expect("absolute configured vault path should resolve");

    assert_eq!(root, configured_path);
}

#[test]
fn resolve_vault_root_rejects_relative_configured_path() {
    let preferences = AppPreferences {
        notes_vault_path: Some("relative/vault".to_string()),
        ..AppPreferences::default()
    };

    let result = resolve_vault_root_from_preferences(Path::new("Documents"), &preferences);

    assert!(result.is_err());
}

#[test]
fn resolve_vault_root_falls_back_to_default_documents_path() {
    let preferences = AppPreferences::default();

    let root = resolve_vault_root_from_preferences(Path::new("Documents"), &preferences)
        .expect("default vault path should resolve");

    assert_eq!(root, Path::new("Documents").join(DEFAULT_VAULT_DIR_NAME));
}

#[test]
fn creates_a_folder_only_inside_the_inbox_workspace() {
    let root = test_vault_root("axis-notes-create-folder-test");
    ensure_vault_structure(&root).expect("vault structure should be created");

    create_notes_folder_at_path(&root, INBOX_DIR, "Projects")
        .expect("inbox folder creation should succeed");

    assert!(root.join(INBOX_DIR).join("Projects").is_dir());

    let error = create_notes_folder_at_path(&root, ARCHIVE_DIR, "Projects")
        .expect_err("archive must not allow normal folder creation");

    assert!(error.contains("Inbox"));
    assert!(create_notes_folder_at_path(&root, INBOX_DIR, "nested/Projects").is_err());
    assert!(create_notes_folder_at_path(&root, INBOX_DIR, "nested\\Projects").is_err());
    assert!(!root.join(ARCHIVE_DIR).join("Projects").exists());

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn moves_a_note_to_an_inbox_folder_without_changing_its_stable_id() {
    let root = test_vault_root("axis-notes-move-note-test");
    ensure_vault_structure(&root).expect("vault structure should be created");
    create_notes_folder_at_path(&root, INBOX_DIR, "Projects")
        .expect("projects folder should be created");
    std::fs::write(root.join(INBOX_DIR).join("draft.md"), "# Draft")
        .expect("fixture note should be writable");

    let note_id = read_all_notes(&root)
        .expect("notes should be readable")
        .into_iter()
        .find(|note| note.path == "inbox/draft.md")
        .expect("draft should be listed")
        .id;

    let moved = move_note_to_inbox_folder(&root, &note_id, "inbox/Projects")
        .expect("note should move into the inbox folder");

    assert_eq!(moved.id, note_id);
    assert_eq!(moved.path, "inbox/Projects/draft.md");
    assert!(!root.join(INBOX_DIR).join("draft.md").exists());
    assert!(root
        .join(INBOX_DIR)
        .join("Projects")
        .join("draft.md")
        .is_file());

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn moves_a_folder_subtree_without_changing_descendant_note_ids() {
    let root = test_vault_root("axis-notes-move-folder-test");
    ensure_vault_structure(&root).expect("vault structure should be created");
    std::fs::create_dir_all(root.join(INBOX_DIR).join("Projects").join("Axis"))
        .expect("source folder should be creatable");
    std::fs::write(
        root.join(INBOX_DIR)
            .join("Projects")
            .join("Axis")
            .join("plan.md"),
        "# Plan",
    )
    .expect("fixture note should be writable");

    let note_id = read_all_notes(&root)
        .expect("notes should be readable")
        .into_iter()
        .find(|note| note.path == "inbox/Projects/Axis/plan.md")
        .expect("plan should be listed")
        .id;

    move_folder_to_inbox_folder(&root, "inbox/Projects/Axis", INBOX_DIR)
        .expect("folder should move into inbox");

    assert!(root.join(INBOX_DIR).join("Axis").join("plan.md").is_file());
    assert!(!root.join(INBOX_DIR).join("Projects").join("Axis").exists());
    let moved_note_id = read_all_notes(&root)
        .expect("moved notes should be readable")
        .into_iter()
        .find(|note| note.path == "inbox/Axis/plan.md")
        .expect("moved plan should be listed")
        .id;
    assert_eq!(moved_note_id, note_id);

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn moves_a_folder_tree_item_into_an_inbox_destination() {
    let root = test_vault_root("axis-notes-move-tree-item-test");
    ensure_vault_structure(&root).expect("vault structure should be created");
    std::fs::create_dir_all(root.join(INBOX_DIR).join("Projects").join("Axis"))
        .expect("source folder should be creatable");

    move_notes_tree_item_at_path(
        &root,
        NotesTreeItemRef::Folder {
            path: "inbox/Projects/Axis".to_string(),
        },
        INBOX_DIR,
    )
    .expect("folder tree item should move");

    assert!(root.join(INBOX_DIR).join("Axis").is_dir());

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn archives_a_folder_subtree_without_changing_descendant_note_ids() {
    let root = test_vault_root("axis-notes-archive-folder-test");
    ensure_vault_structure(&root).expect("vault structure should be created");
    std::fs::create_dir_all(root.join(INBOX_DIR).join("Projects"))
        .expect("source folder should be creatable");
    std::fs::write(
        root.join(INBOX_DIR).join("Projects").join("plan.md"),
        "# Plan",
    )
    .expect("fixture note should be writable");

    let note_id = read_all_notes(&root)
        .expect("notes should be readable")
        .into_iter()
        .find(|note| note.path == "inbox/Projects/plan.md")
        .expect("plan should be listed")
        .id;

    move_tree_item_to_lifecycle_dir(
        &root,
        NotesTreeItemRef::Folder {
            path: "inbox/Projects".to_string(),
        },
        ARCHIVE_DIR,
    )
    .expect("folder should archive");

    assert!(root
        .join(ARCHIVE_DIR)
        .join("Projects")
        .join("plan.md")
        .is_file());
    assert!(!root.join(INBOX_DIR).join("Projects").exists());
    let archived_note_id = read_notes_in_vault_dir(&root, ARCHIVE_DIR)
        .expect("archived notes should be readable")
        .into_iter()
        .find(|note| note.path == "archive/Projects/plan.md")
        .expect("archived plan should be listed")
        .id;
    assert_eq!(archived_note_id, note_id);

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn restores_a_folder_subtree_to_inbox_without_changing_descendant_note_ids() {
    let root = test_vault_root("axis-notes-restore-folder-test");
    ensure_vault_structure(&root).expect("vault structure should be created");
    std::fs::create_dir_all(root.join(ARCHIVE_DIR).join("Projects"))
        .expect("archived folder should be creatable");
    std::fs::write(
        root.join(ARCHIVE_DIR).join("Projects").join("plan.md"),
        "# Plan",
    )
    .expect("fixture note should be writable");

    let note_id = read_notes_in_vault_dir(&root, ARCHIVE_DIR)
        .expect("archived notes should be readable")
        .into_iter()
        .find(|note| note.path == "archive/Projects/plan.md")
        .expect("archived plan should be listed")
        .id;

    restore_notes_tree_item_to_inbox(
        &root,
        NotesTreeItemRef::Folder {
            path: "archive/Projects".to_string(),
        },
    )
    .expect("folder should restore to inbox");

    assert!(root
        .join(INBOX_DIR)
        .join("Projects")
        .join("plan.md")
        .is_file());
    assert!(!root.join(ARCHIVE_DIR).join("Projects").exists());
    let restored_note_id = read_all_notes(&root)
        .expect("restored notes should be readable")
        .into_iter()
        .find(|note| note.path == "inbox/Projects/plan.md")
        .expect("restored plan should be listed")
        .id;
    assert_eq!(restored_note_id, note_id);

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}

#[test]
fn renames_an_inbox_folder_without_changing_descendant_note_ids() {
    let root = test_vault_root("axis-notes-rename-folder-test");
    ensure_vault_structure(&root).expect("vault structure should be created");
    std::fs::create_dir_all(root.join(INBOX_DIR).join("Projects"))
        .expect("source folder should be creatable");
    std::fs::write(
        root.join(INBOX_DIR).join("Projects").join("plan.md"),
        "# Plan",
    )
    .expect("fixture note should be writable");

    let note_id = read_all_notes(&root)
        .expect("notes should be readable")
        .into_iter()
        .find(|note| note.path == "inbox/Projects/plan.md")
        .expect("plan should be listed")
        .id;

    rename_notes_folder_at_path(&root, "inbox/Projects", "Work").expect("folder should rename");

    assert!(root.join(INBOX_DIR).join("Work").join("plan.md").is_file());
    assert!(!root.join(INBOX_DIR).join("Projects").exists());
    let renamed_note_id = read_all_notes(&root)
        .expect("renamed notes should be readable")
        .into_iter()
        .find(|note| note.path == "inbox/Work/plan.md")
        .expect("renamed plan should be listed")
        .id;
    assert_eq!(renamed_note_id, note_id);

    std::fs::remove_dir_all(root).expect("test vault should be removable");
}
