//! Notes domain commands.
//!
//! Local-file markdown notes with metadata extraction.

use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::{BTreeMap, HashSet};
use std::path::{Component, Path, PathBuf};
use std::sync::LazyLock;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;
use uuid::Uuid;

use crate::commands::preferences;
use crate::types::AppPreferences;

const DEFAULT_VAULT_DIR_NAME: &str = "Axis_Notes";
const INBOX_DIR: &str = "inbox";
const ARCHIVE_DIR: &str = "archive";
const TRASH_DIR: &str = "trash";
const VAULT_METADATA_DIR: &str = ".axis-notes";
const VAULT_MANIFEST_FILE: &str = "manifest.json";
const VAULT_SIDECARS_DIR: &str = "sidecars";
const VAULT_CACHE_DIR: &str = "cache";
const VAULT_CONFIG_DIR: &str = "config";
const VAULT_METADATA_SCHEMA_VERSION: u32 = 2;
const SEARCH_MAX_RESULTS: usize = 80;
const WELCOME_NOTE_RELATIVE_PATH: &str = "inbox/Comece aqui/Bem-vindo ao Axis.md";
const WELCOME_NOTE_CONTENT: &str = "# Bem-vindo ao Axis\n\nSuas notas locais ficam no seu vault do Axis. Esta pasta e sua: voce pode criar notas soltas em Entrada, organizar projetos em pastas e abrir o vault no Explorer ou Finder quando quiser.\n\n## Como usar Notes\n\n- Escreva em Markdown e mantenha seus arquivos no seu computador.\n- Entrada e sua area ativa; Arquivo e Lixeira sao estados para organizar o que ja nao esta em uso.\n- Use a barra lateral para navegar pelas pastas e encontrar suas notas.\n\n## Anotacoes\n\nEm breve, voce podera selecionar um trecho para deixar uma anotacao privada nele. Ela tambem ficara salva apenas no seu vault.\n";

#[derive(Debug, Clone, Copy)]
pub(crate) struct VaultLayout {
    required_dirs: [&'static str; 4],
    internal_dirs: [&'static str; 1],
    metadata_dirs: [&'static str; 3],
}

impl VaultLayout {
    /// Defines the physical vault contract used by all notes file operations.
    pub(crate) fn standard() -> Self {
        Self {
            required_dirs: [INBOX_DIR, ARCHIVE_DIR, TRASH_DIR, VAULT_METADATA_DIR],
            internal_dirs: [VAULT_METADATA_DIR],
            metadata_dirs: [VAULT_SIDECARS_DIR, VAULT_CACHE_DIR, VAULT_CONFIG_DIR],
        }
    }

    pub(crate) fn required_dirs(&self) -> [&'static str; 4] {
        self.required_dirs
    }

    pub(crate) fn metadata_dirs(&self) -> [&'static str; 3] {
        self.metadata_dirs
    }

    pub(crate) fn is_internal_dir_name(&self, name: &str) -> bool {
        self.internal_dirs.contains(&name) || name.starts_with('.')
    }

    pub(crate) fn is_lifecycle_dir_name(&self, name: &str) -> bool {
        matches!(name, ARCHIVE_DIR | TRASH_DIR)
    }
}

static TAG_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?:^|\s)#([A-Za-z][\w\-/]*)").expect("invalid tag regex"));
static WIKILINK_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]").expect("invalid wikilink regex")
});
static FRONTMATTER_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^---\n[\s\S]*?\n---\n?").expect("invalid frontmatter regex"));
static FENCED_CODE_BLOCK_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?m)(^|\n)```[^\n]*\n[\s\S]*?\n```[ \t]*").expect("invalid fenced block regex")
});
static INLINE_CODE_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"`[^`\n]*`").expect("invalid inline code regex"));
static MD_LINK_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"\[[^\]]+\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)"#)
        .expect("invalid markdown link regex")
});
static URI_SCHEME_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-zA-Z][a-zA-Z\d+.-]*:").expect("invalid uri scheme regex"));

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct Note {
    pub id: String,
    pub path: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub word_count: i32,
    pub tags: Vec<String>,
    pub wiki_links: Vec<String>,
    pub has_attachments: bool,
    pub excerpt: String,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct NoteSummary {
    pub id: String,
    pub path: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub word_count: i32,
    pub tags: Vec<String>,
    pub wiki_links: Vec<String>,
    pub has_attachments: bool,
    pub excerpt: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateNoteInput {
    pub title: Option<String>,
    pub content: Option<String>,
    pub folder: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateNotesFolderInput {
    pub parent_path: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct RenameNotesFolderInput {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum NotesTreeItemRef {
    Note { id: String },
    Folder { path: String },
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct MoveNotesTreeItemInput {
    pub item: NotesTreeItemRef,
    pub destination_folder: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct UpdateNoteInput {
    pub id: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct RenameNoteInput {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct NoteVaultInfo {
    pub path: String,
    pub is_default: bool,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NotesWorkspace {
    Inbox,
    Archive,
    Trash,
}

impl NotesWorkspace {
    fn directory_name(self) -> &'static str {
        match self {
            Self::Inbox => INBOX_DIR,
            Self::Archive => ARCHIVE_DIR,
            Self::Trash => TRASH_DIR,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum NoteTreeItem {
    Folder {
        path: String,
        name: String,
        children: Vec<NoteTreeItem>,
    },
    Note {
        note: NoteSummary,
    },
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct NoteWorkspaceTree {
    pub workspace: NotesWorkspace,
    pub items: Vec<NoteTreeItem>,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NoteVaultMigrationMode {
    Copy,
    Move,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct MigrateNotesVaultInput {
    pub source_path: String,
    pub mode: NoteVaultMigrationMode,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct NoteVaultMigrationResult {
    pub source_path: String,
    pub destination_path: String,
    pub mode: NoteVaultMigrationMode,
    pub notes_migrated: u32,
    pub metadata_files_migrated: u32,
    pub conflicts: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct VaultManifest {
    schema_version: u32,
    application: String,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    note_ids_by_path: BTreeMap<String, String>,
    #[serde(default)]
    welcome_note_id: Option<String>,
}

struct VaultMetadata {
    manifest_path: PathBuf,
    manifest: VaultManifest,
    dirty: bool,
}

impl VaultMetadata {
    fn id_for_path(&mut self, path: &str) -> String {
        if let Some(id) = self.manifest.note_ids_by_path.get(path) {
            return id.clone();
        }

        let id = Uuid::new_v4().to_string();
        self.manifest
            .note_ids_by_path
            .insert(path.to_string(), id.clone());
        self.dirty = true;
        id
    }

    fn path_for_id(&self, id: &str) -> Option<&str> {
        self.manifest
            .note_ids_by_path
            .iter()
            .find_map(|(path, candidate)| (candidate == id).then_some(path.as_str()))
    }

    fn rebind_path(&mut self, source_path: &str, destination_path: &str) {
        let id = self
            .manifest
            .note_ids_by_path
            .remove(source_path)
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        self.manifest
            .note_ids_by_path
            .insert(destination_path.to_string(), id);
        self.dirty = true;
    }

    fn set_welcome_note_id(&mut self, id: String) {
        if self.manifest.welcome_note_id.as_deref() != Some(id.as_str()) {
            self.manifest.welcome_note_id = Some(id);
            self.dirty = true;
        }
    }

    fn bind_id_to_path(&mut self, path: &str, id: &str) {
        if self.manifest.note_ids_by_path.get(path) != Some(&id.to_string()) {
            self.manifest
                .note_ids_by_path
                .insert(path.to_string(), id.to_string());
            self.dirty = true;
        }
    }

    fn persist_if_dirty(&mut self) -> Result<(), String> {
        if !self.dirty {
            return Ok(());
        }

        self.manifest.schema_version = VAULT_METADATA_SCHEMA_VERSION;
        self.manifest.updated_at = now_iso_string();
        let content = serde_json::to_string_pretty(&self.manifest)
            .map_err(|e| format!("Failed to serialize notes vault manifest: {e}"))?;
        write_atomic(&self.manifest_path, &content)?;
        self.dirty = false;
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum VaultMigrationFileKind {
    Note,
    Metadata,
}

#[derive(Debug, Clone)]
struct VaultMigrationFile {
    source_abs: PathBuf,
    relative_path: String,
    kind: VaultMigrationFileKind,
}

fn notes_root(app: &AppHandle) -> Result<PathBuf, String> {
    let documents_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to get documents directory: {e}"))?;
    let preferences = preferences::load_preferences_from_disk(app)?;
    let notes_dir = resolve_vault_root_from_preferences(&documents_dir, &preferences)?;

    ensure_vault_structure(&notes_dir)?;

    Ok(notes_dir)
}

fn default_vault_path_from_documents(documents_dir: &Path) -> PathBuf {
    documents_dir.join(DEFAULT_VAULT_DIR_NAME)
}

fn resolve_vault_root_from_preferences(
    documents_dir: &Path,
    preferences: &AppPreferences,
) -> Result<PathBuf, String> {
    let root = preferences
        .notes_vault_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| default_vault_path_from_documents(documents_dir));

    if preferences
        .notes_vault_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .is_some()
        && !root.is_absolute()
    {
        return Err("Configured notes vault path must be absolute".to_string());
    }

    Ok(root)
}

fn ensure_vault_structure(root: &Path) -> Result<(), String> {
    if root.exists() && !root.is_dir() {
        return Err("Selected notes vault path is not a directory".to_string());
    }

    let is_new_vault = !root.exists();

    let layout = VaultLayout::standard();
    for dir in layout.required_dirs() {
        std::fs::create_dir_all(root.join(dir))
            .map_err(|e| format!("Failed to create notes vault directory: {e}"))?;
    }

    ensure_vault_metadata_area(root)?;

    if is_new_vault {
        seed_welcome_note(root)?;
    }

    Ok(())
}

fn ensure_vault_metadata_area(root: &Path) -> Result<(), String> {
    let metadata_root = root.join(VAULT_METADATA_DIR);
    ensure_not_symlink(&metadata_root, "Notes vault metadata directory")?;

    let layout = VaultLayout::standard();
    for dir in layout.metadata_dirs() {
        let metadata_dir = metadata_root.join(dir);
        ensure_not_symlink(&metadata_dir, "Notes vault metadata subdirectory")?;
        std::fs::create_dir_all(&metadata_dir)
            .map_err(|e| format!("Failed to create notes metadata directory: {e}"))?;
        ensure_not_symlink(&metadata_dir, "Notes vault metadata subdirectory")?;
    }

    let manifest_path = metadata_root.join(VAULT_MANIFEST_FILE);
    ensure_not_symlink(&manifest_path, "Notes vault manifest")?;
    if manifest_path.exists() {
        if !manifest_path.is_file() {
            return Err(format!(
                "Notes vault manifest path is not a file: {}",
                manifest_path.display()
            ));
        }
        return Ok(());
    }

    let now = now_iso_string();
    let manifest = VaultManifest {
        schema_version: VAULT_METADATA_SCHEMA_VERSION,
        application: "axis-desktop".to_string(),
        created_at: now.clone(),
        updated_at: now,
        note_ids_by_path: BTreeMap::new(),
        welcome_note_id: None,
    };
    let content = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize notes vault manifest: {e}"))?;

    write_atomic(&manifest_path, &content)?;
    Ok(())
}

fn load_vault_metadata(root: &Path) -> Result<VaultMetadata, String> {
    let manifest_path = root.join(VAULT_METADATA_DIR).join(VAULT_MANIFEST_FILE);
    ensure_not_symlink(&manifest_path, "Notes vault manifest")?;

    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read notes vault manifest: {e}"))?;
    let manifest = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse notes vault manifest: {e}"))?;

    Ok(VaultMetadata {
        manifest_path,
        manifest,
        dirty: false,
    })
}

fn seed_welcome_note(root: &Path) -> Result<(), String> {
    let welcome_path = root
        .join(INBOX_DIR)
        .join("Comece aqui")
        .join("Bem-vindo ao Axis.md");

    if !welcome_path.exists() {
        let parent = welcome_path
            .parent()
            .ok_or_else(|| "Invalid welcome note path".to_string())?;
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create welcome note folder: {e}"))?;
        write_atomic(&welcome_path, WELCOME_NOTE_CONTENT)?;
    }

    let mut metadata = load_vault_metadata(root)?;
    let path = relative_note_path(root, &welcome_path)?;
    let id = metadata.id_for_path(&path);
    metadata.set_welcome_note_id(id);
    metadata.persist_if_dirty()?;
    let welcome_id = metadata
        .manifest
        .welcome_note_id
        .clone()
        .ok_or_else(|| "Welcome note ID was not persisted".to_string())?;
    seed_welcome_annotation(root, &welcome_id)
}

fn ensure_not_symlink(path: &Path, context: &str) -> Result<(), String> {
    match std::fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(format!(
            "{context} must not be a symlink: {}",
            path.display()
        )),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to inspect {context}: {error}")),
    }
}

fn default_notes_vault_root(app: &AppHandle) -> Result<PathBuf, String> {
    let documents_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to get documents directory: {e}"))?;
    Ok(default_vault_path_from_documents(&documents_dir))
}

fn vault_info_from_path(path: &Path, is_default: bool) -> NoteVaultInfo {
    NoteVaultInfo {
        path: path.to_string_lossy().to_string(),
        is_default,
    }
}

fn active_vault_info(app: &AppHandle) -> Result<NoteVaultInfo, String> {
    let preferences = preferences::load_preferences_from_disk(app)?;
    let root = notes_root(app)?;
    let is_default = preferences
        .notes_vault_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .is_none();

    Ok(vault_info_from_path(&root, is_default))
}

fn normalize_rel_path(input: &str) -> String {
    input.replace('\\', "/")
}

fn is_safe_relative_path(path: &str) -> bool {
    if path.is_empty() || path.starts_with('/') || path.contains(':') {
        return false;
    }

    let path_obj = Path::new(path);
    !path_obj.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    })
}

fn resolve_note_path(root: &Path, rel_path: &str) -> Result<PathBuf, String> {
    let normalized = normalize_rel_path(rel_path);
    if !is_safe_relative_path(&normalized) {
        return Err(format!("Unsafe note path: {rel_path}"));
    }

    let abs = root.join(&normalized);
    let canonical_root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    let canonical_parent = abs
        .parent()
        .unwrap_or(root)
        .canonicalize()
        .unwrap_or_else(|_| root.to_path_buf());

    if !canonical_parent.starts_with(&canonical_root) {
        return Err(format!("Path escapes notes root: {rel_path}"));
    }

    Ok(abs)
}

fn relative_note_path(root: &Path, abs_path: &Path) -> Result<String, String> {
    abs_path
        .strip_prefix(root)
        .map_err(|e| format!("Failed to compute relative note path: {e}"))
        .map(|path| path.to_string_lossy().replace('\\', "/"))
}

fn resolve_note_path_by_id(
    root: &Path,
    metadata: &mut VaultMetadata,
    id: &str,
) -> Result<PathBuf, String> {
    if let Some(path) = metadata.path_for_id(id) {
        return resolve_note_path(root, path);
    }

    // Older renderer state used the vault-relative path as the note ID. Resolve
    // that safe legacy form once and immediately bind it to a stable UUID.
    let abs = resolve_note_path(root, id)?;
    if !abs.is_file() {
        return Err("Note not found".to_string());
    }
    let path = relative_note_path(root, &abs)?;
    metadata.id_for_path(&path);
    Ok(abs)
}

fn now_iso_string() -> String {
    let now = std::time::SystemTime::now();
    let datetime: chrono::DateTime<chrono::Utc> = now.into();
    datetime.to_rfc3339()
}

fn strip_code_content(body: &str) -> String {
    let no_fenced = FENCED_CODE_BLOCK_PATTERN.replace_all(body, "$1 ");
    INLINE_CODE_PATTERN.replace_all(&no_fenced, " ").to_string()
}

fn extract_tags(body: &str) -> Vec<String> {
    let stripped = strip_code_content(body);
    let mut set = HashSet::new();

    for caps in TAG_PATTERN.captures_iter(&stripped) {
        if let Some(tag_match) = caps.get(1) {
            set.insert(tag_match.as_str().trim().to_lowercase());
        }
    }

    let mut tags: Vec<String> = set.into_iter().collect();
    tags.sort();
    tags
}

fn extract_wikilinks(body: &str) -> Vec<String> {
    let stripped = strip_code_content(body);
    let mut set = HashSet::new();

    for caps in WIKILINK_PATTERN.captures_iter(&stripped) {
        if let Some(link_match) = caps.get(1) {
            set.insert(link_match.as_str().trim().to_string());
        }
    }

    let mut links: Vec<String> = set.into_iter().collect();
    links.sort();
    links
}

fn has_attachments(body: &str) -> bool {
    let stripped = strip_code_content(body);
    let asset_exts = [
        ".apng", ".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp", ".pdf", ".aac",
        ".flac", ".m4a", ".mp3", ".ogg", ".wav", ".m4v", ".mov", ".mp4", ".ogv", ".webm",
    ];

    for caps in MD_LINK_PATTERN.captures_iter(&stripped) {
        let mut href = caps
            .get(1)
            .map(|m| m.as_str().trim().to_string())
            .unwrap_or_default();

        if href.starts_with('<') && href.ends_with('>') && href.len() >= 2 {
            href = href[1..href.len() - 1].to_string();
        }

        if href.is_empty() || href.starts_with('#') || href.starts_with("//") {
            continue;
        }

        if URI_SCHEME_PATTERN.is_match(&href) {
            continue;
        }

        let clean = href
            .split('#')
            .next()
            .unwrap_or(&href)
            .split('?')
            .next()
            .unwrap_or(&href)
            .to_lowercase();

        if asset_exts.iter().any(|ext| clean.ends_with(ext)) {
            return true;
        }
    }

    false
}

fn build_excerpt(body: &str) -> String {
    let without_frontmatter = FRONTMATTER_PATTERN.replace(body, "");
    let stripped = strip_code_content(&without_frontmatter);

    let text = Regex::new(r"!\[[^\]]*\]\([^)]*\)")
        .expect("invalid image regex")
        .replace_all(&stripped, " ")
        .to_string();
    let text = Regex::new(r"\[([^\]]+)\]\([^)]*\)")
        .expect("invalid link regex")
        .replace_all(&text, "$1")
        .to_string();
    let text = Regex::new(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
        .expect("invalid wikilink excerpt regex")
        .replace_all(&text, "$1")
        .to_string();
    let text = Regex::new(r"(?m)^#{1,6}\s+")
        .expect("invalid heading strip regex")
        .replace_all(&text, "")
        .to_string();
    let text = Regex::new(r"[*_~>]+")
        .expect("invalid markdown punctuation regex")
        .replace_all(&text, "")
        .to_string();
    let collapsed = Regex::new(r"\s+")
        .expect("invalid whitespace regex")
        .replace_all(&text, " ")
        .trim()
        .to_string();

    collapsed.chars().take(220).collect()
}

fn count_words(content: &str) -> i32 {
    content.split_whitespace().count() as i32
}

fn resolve_note_title(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|title| !title.trim().is_empty())
        .unwrap_or("Untitled")
        .to_string()
}

fn new_note_content(content: Option<String>) -> String {
    content.unwrap_or_default()
}

fn parse_iso_or_epoch(value: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.timestamp_millis())
        .unwrap_or(0)
}

fn note_from_file(root: &Path, abs_path: &Path) -> Result<Note, String> {
    let mut metadata = load_vault_metadata(root)?;
    let note = note_from_file_with_metadata(root, abs_path, &mut metadata)?;
    metadata.persist_if_dirty()?;
    Ok(note)
}

fn note_from_file_with_metadata(
    root: &Path,
    abs_path: &Path,
    metadata: &mut VaultMetadata,
) -> Result<Note, String> {
    let rel = relative_note_path(root, abs_path)?;

    let file_metadata =
        std::fs::metadata(abs_path).map_err(|e| format!("Failed to read note metadata: {e}"))?;
    let content = std::fs::read_to_string(abs_path)
        .map_err(|e| format!("Failed to read note content: {e}"))?;

    let created_at = file_metadata
        .created()
        .map(|v| {
            let dt: chrono::DateTime<chrono::Utc> = v.into();
            dt.to_rfc3339()
        })
        .unwrap_or_else(|_| now_iso_string());

    let updated_at = file_metadata
        .modified()
        .map(|v| {
            let dt: chrono::DateTime<chrono::Utc> = v.into();
            dt.to_rfc3339()
        })
        .unwrap_or_else(|_| created_at.clone());

    let title = resolve_note_title(&rel);

    Ok(Note {
        id: metadata.id_for_path(&rel),
        path: rel,
        title,
        content: content.clone(),
        created_at,
        updated_at,
        word_count: count_words(&content),
        tags: extract_tags(&content),
        wiki_links: extract_wikilinks(&content),
        has_attachments: has_attachments(&content),
        excerpt: build_excerpt(&content),
    })
}

fn summary_from_note(note: &Note) -> NoteSummary {
    NoteSummary {
        id: note.id.clone(),
        path: note.path.clone(),
        title: note.title.clone(),
        content: note.content.clone(),
        created_at: note.created_at.clone(),
        updated_at: note.updated_at.clone(),
        word_count: note.word_count,
        tags: note.tags.clone(),
        wiki_links: note.wiki_links.clone(),
        has_attachments: note.has_attachments,
        excerpt: note.excerpt.clone(),
    }
}

fn ensure_md_filename(input: &str) -> String {
    let trimmed = input.trim();
    let sanitized: String = trimmed
        .chars()
        .filter(|ch| !matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .collect();

    let base = if sanitized.is_empty() {
        "Untitled".to_string()
    } else {
        sanitized
    };

    if base.to_lowercase().ends_with(".md") {
        base
    } else {
        format!("{base}.md")
    }
}

#[path = "notes/tree.rs"]
mod tree;
use tree::*;
#[cfg(test)]
fn tree_contains_path(tree: &NoteWorkspaceTree, expected_path: &str) -> bool {
    fn contains(items: &[NoteTreeItem], expected_path: &str) -> bool {
        items.iter().any(|item| match item {
            NoteTreeItem::Folder { path, children, .. } => {
                path == expected_path || contains(children, expected_path)
            }
            NoteTreeItem::Note { note } => note.path == expected_path,
        })
    }

    contains(&tree.items, expected_path)
}

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let temp_path = path.with_extension("tmp");
    std::fs::write(&temp_path, content).map_err(|e| format!("Failed to write temp file: {e}"))?;

    if let Err(rename_err) = std::fs::rename(&temp_path, path) {
        if let Err(remove_err) = std::fs::remove_file(&temp_path) {
            log::warn!("Failed to remove temp file after rename failure: {remove_err}");
        }
        return Err(format!("Failed to finalize file: {rename_err}"));
    }

    Ok(())
}

fn note_top_level_dir_name(rel_path: &str) -> Option<String> {
    normalize_rel_path(rel_path)
        .split('/')
        .next()
        .filter(|part| !part.is_empty())
        .map(ToString::to_string)
}

fn next_unique_path(root: &Path, folder: &str, base_file_name: &str) -> Result<PathBuf, String> {
    let mut idx = 1;
    let folder_path = resolve_note_path(root, folder)?;
    std::fs::create_dir_all(&folder_path)
        .map_err(|e| format!("Failed to create note folder: {e}"))?;

    let base = Path::new(base_file_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string();

    loop {
        let candidate = if idx == 1 {
            format!("{base}.md")
        } else {
            format!("{base} {idx}.md")
        };

        let abs = folder_path.join(candidate);
        if !abs.exists() {
            return Ok(abs);
        }
        idx += 1;
    }
}

fn create_note_at_path(
    root: &Path,
    folder: &str,
    title: Option<String>,
    content: Option<String>,
) -> Result<NoteSummary, String> {
    let folder_path = resolve_inbox_folder(root, folder)?;
    let folder = relative_note_path(root, &folder_path)?;
    let content = new_note_content(content);
    let file_title = title.unwrap_or_else(|| "Untitled".to_string());
    let base_name = ensure_md_filename(&file_title);
    let abs = next_unique_path(root, &folder, &base_name)?;

    write_atomic(&abs, &content)?;
    Ok(summary_from_note(&note_from_file(root, &abs)?))
}

#[path = "notes/lifecycle.rs"]
mod lifecycle;
use lifecycle::*;

#[path = "notes/annotations.rs"]
mod annotations;
use annotations::*;

fn move_note_to_vault_dir(root: &Path, id: &str, destination_dir: &str) -> Result<Note, String> {
    let mut metadata = load_vault_metadata(root)?;
    let src_abs = resolve_note_path_by_id(root, &mut metadata, id)?;
    let source_path = relative_note_path(root, &src_abs)?;

    if note_top_level_dir_name(&source_path).as_deref() == Some(destination_dir) {
        let note = note_from_file_with_metadata(root, &src_abs, &mut metadata)?;
        metadata.persist_if_dirty()?;
        return Ok(note);
    }

    let file_name = src_abs
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid note path".to_string())?;
    let target_abs = next_unique_path(root, destination_dir, file_name)?;

    std::fs::rename(&src_abs, &target_abs).map_err(|e| format!("Failed to move note: {e}"))?;
    let target_path = relative_note_path(root, &target_abs)?;
    metadata.rebind_path(&source_path, &target_path);
    let note = note_from_file_with_metadata(root, &target_abs, &mut metadata)?;
    metadata.persist_if_dirty()?;
    Ok(note)
}

fn collect_vault_migration_files(root: &Path) -> Result<Vec<VaultMigrationFile>, String> {
    let mut files = Vec::new();

    for dir in [INBOX_DIR, ARCHIVE_DIR, TRASH_DIR] {
        collect_vault_migration_files_in_dir(root, dir, VaultMigrationFileKind::Note, &mut files)?;
    }

    for dir in [VAULT_SIDECARS_DIR, VAULT_CONFIG_DIR] {
        let metadata_dir = format!("{VAULT_METADATA_DIR}/{dir}");
        collect_vault_migration_files_in_dir(
            root,
            &metadata_dir,
            VaultMigrationFileKind::Metadata,
            &mut files,
        )?;
    }

    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(files)
}

fn collect_vault_migration_files_in_dir(
    root: &Path,
    relative_dir: &str,
    kind: VaultMigrationFileKind,
    out: &mut Vec<VaultMigrationFile>,
) -> Result<(), String> {
    let base_dir = resolve_note_path(root, relative_dir)?;
    if !base_dir.exists() {
        return Ok(());
    }

    fn walk(
        root: &Path,
        dir: &Path,
        kind: VaultMigrationFileKind,
        out: &mut Vec<VaultMigrationFile>,
    ) -> Result<(), String> {
        let entries = std::fs::read_dir(dir)
            .map_err(|e| format!("Failed to list notes vault migration directory: {e}"))?;
        for entry in entries {
            let entry =
                entry.map_err(|e| format!("Failed to read migration directory entry: {e}"))?;
            let path = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|e| format!("Failed to inspect migration file type: {e}"))?;

            if file_type.is_symlink() {
                return Err(format!(
                    "Notes vault migration does not support symlinks: {}",
                    path.display()
                ));
            }

            if file_type.is_dir() {
                walk(root, &path, kind, out)?;
                continue;
            }

            if file_type.is_file() {
                let relative_path = path
                    .strip_prefix(root)
                    .map_err(|e| format!("Failed to compute migration file path: {e}"))?
                    .to_str()
                    .ok_or_else(|| {
                        format!(
                            "Notes vault migration file path is not valid UTF-8: {}",
                            path.display()
                        )
                    })?
                    .replace('\\', "/");
                out.push(VaultMigrationFile {
                    source_abs: path,
                    relative_path,
                    kind,
                });
            }
        }

        Ok(())
    }

    walk(root, &base_dir, kind, out)
}

fn rollback_copied_migration_files(paths: &[PathBuf]) {
    for path in paths.iter().rev() {
        if let Err(error) = std::fs::remove_file(path) {
            log::warn!(
                "Failed to rollback copied notes vault migration file {}: {error}",
                path.display()
            );
        }
    }
}

fn preserve_migrated_note_ids(
    source_root: &Path,
    destination_root: &Path,
    files: &[VaultMigrationFile],
) -> Result<(), String> {
    let source_metadata = load_vault_metadata(source_root)?;
    let mut destination_metadata = load_vault_metadata(destination_root)?;

    for file in files {
        if file.kind != VaultMigrationFileKind::Note {
            continue;
        }

        if let Some(id) = source_metadata
            .manifest
            .note_ids_by_path
            .get(&file.relative_path)
        {
            destination_metadata.bind_id_to_path(&file.relative_path, id);
        }
    }

    destination_metadata.persist_if_dirty()
}

fn is_default_welcome_note(file: &VaultMigrationFile) -> bool {
    if file.kind != VaultMigrationFileKind::Note || file.relative_path != WELCOME_NOTE_RELATIVE_PATH
    {
        return false;
    }

    std::fs::read_to_string(&file.source_abs)
        .map(|content| content == WELCOME_NOTE_CONTENT)
        .unwrap_or(false)
}

fn is_default_welcome_annotation_sidecar(source_root: &Path, file: &VaultMigrationFile) -> bool {
    if file.kind != VaultMigrationFileKind::Metadata {
        return false;
    }

    let Ok(metadata) = load_vault_metadata(source_root) else {
        return false;
    };
    let Some(welcome_note_id) = metadata.manifest.welcome_note_id else {
        return false;
    };
    let expected_sidecar_path =
        format!("{VAULT_METADATA_DIR}/{VAULT_SIDECARS_DIR}/{welcome_note_id}.json");
    if file.relative_path != expected_sidecar_path {
        return false;
    }

    let welcome_is_default = std::fs::read_to_string(source_root.join(WELCOME_NOTE_RELATIVE_PATH))
        .map(|content| content == WELCOME_NOTE_CONTENT)
        .unwrap_or(false);
    if !welcome_is_default {
        return false;
    }

    let Some(sidecar) = std::fs::read_to_string(&file.source_abs)
        .ok()
        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
    else {
        return false;
    };
    let Some(annotations) = sidecar["annotations"].as_array() else {
        return false;
    };
    let Some(annotation) = annotations.first() else {
        return false;
    };

    sidecar["note_id"].as_str() == Some(welcome_note_id.as_str())
        && annotations.len() == 1
        && annotation["quote"].as_str() == Some(WELCOME_ANNOTATION_QUOTE)
        && annotation["text"].as_str() == Some(WELCOME_ANNOTATION_TEXT)
        && annotation["state"].as_str() == Some("active")
        && annotation["anchor_status"].as_str() == Some("anchored")
}

fn migrate_notes_vault_contents(
    source_root: &Path,
    destination_root: &Path,
    mode: NoteVaultMigrationMode,
) -> Result<NoteVaultMigrationResult, String> {
    if !source_root.is_absolute() {
        return Err("Source notes vault path must be absolute".to_string());
    }

    if !destination_root.is_absolute() {
        return Err("Destination notes vault path must be absolute".to_string());
    }

    if !source_root.is_dir() {
        return Err("Source notes vault path is not a directory".to_string());
    }

    ensure_vault_structure(source_root)?;
    ensure_vault_structure(destination_root)?;

    let canonical_source = source_root
        .canonicalize()
        .map_err(|e| format!("Failed to inspect source notes vault: {e}"))?;
    let canonical_destination = destination_root
        .canonicalize()
        .map_err(|e| format!("Failed to inspect destination notes vault: {e}"))?;

    if canonical_source == canonical_destination {
        return Err("Source and destination notes vaults must be different".to_string());
    }

    let files: Vec<VaultMigrationFile> = collect_vault_migration_files(source_root)?
        .into_iter()
        // A fresh destination already owns this app-provided note. A user edit
        // changes its content, so it remains a normal migration candidate.
        .filter(|file| {
            !is_default_welcome_note(file)
                && !is_default_welcome_annotation_sidecar(source_root, file)
        })
        .collect();
    let conflicts: Vec<String> = files
        .iter()
        .filter(|file| destination_root.join(&file.relative_path).exists())
        .map(|file| file.relative_path.clone())
        .collect();

    if !conflicts.is_empty() {
        return Err(format!(
            "Notes vault migration has file conflicts: {}",
            conflicts.join(", ")
        ));
    }

    let notes_migrated = files
        .iter()
        .filter(|file| file.kind == VaultMigrationFileKind::Note)
        .count() as u32;
    let metadata_files_migrated = files
        .iter()
        .filter(|file| file.kind == VaultMigrationFileKind::Metadata)
        .count() as u32;
    let mut copied_paths = Vec::new();

    for file in &files {
        let destination_abs = destination_root.join(&file.relative_path);
        if let Some(parent) = destination_abs.parent() {
            if let Err(error) = std::fs::create_dir_all(parent) {
                rollback_copied_migration_files(&copied_paths);
                return Err(format!(
                    "Failed to create migration destination folder: {error}"
                ));
            }
        }

        if let Err(error) = std::fs::copy(&file.source_abs, &destination_abs) {
            rollback_copied_migration_files(&copied_paths);
            return Err(format!(
                "Failed to copy notes vault migration file {}: {error}",
                file.relative_path
            ));
        }
        copied_paths.push(destination_abs);
    }

    if let Err(error) = preserve_migrated_note_ids(source_root, destination_root, &files) {
        rollback_copied_migration_files(&copied_paths);
        return Err(error);
    }

    if mode == NoteVaultMigrationMode::Move {
        for file in &files {
            std::fs::remove_file(&file.source_abs).map_err(|e| {
                format!(
                    "Failed to remove source notes vault file after copy {}: {e}",
                    file.relative_path
                )
            })?;
        }
    }

    Ok(NoteVaultMigrationResult {
        source_path: source_root.to_string_lossy().to_string(),
        destination_path: destination_root.to_string_lossy().to_string(),
        mode,
        notes_migrated,
        metadata_files_migrated,
        conflicts: Vec::new(),
    })
}

fn move_note_to_lifecycle_dir(
    root: &Path,
    id: &str,
    destination_dir: &str,
) -> Result<Note, String> {
    let layout = VaultLayout::standard();
    if !layout.is_lifecycle_dir_name(destination_dir) {
        return Err("Invalid lifecycle destination".to_string());
    }

    move_note_to_vault_dir(root, id, destination_dir)
}

fn restore_note_to_inbox(root: &Path, id: &str) -> Result<Note, String> {
    let layout = VaultLayout::standard();
    let mut metadata = load_vault_metadata(root)?;
    let abs = resolve_note_path_by_id(root, &mut metadata, id)?;
    let path = relative_note_path(root, &abs)?;
    let top_level_dir = note_top_level_dir_name(&path);

    if top_level_dir
        .as_deref()
        .is_some_and(|dir| layout.is_lifecycle_dir_name(dir))
    {
        metadata.persist_if_dirty()?;
        return move_note_to_vault_dir(root, id, INBOX_DIR);
    }

    let note = note_from_file_with_metadata(root, &abs, &mut metadata)?;
    metadata.persist_if_dirty()?;
    Ok(note)
}

#[tauri::command]
#[specta::specta]
pub async fn get_notes(app: AppHandle) -> Result<Vec<NoteSummary>, String> {
    let root = notes_root(&app)?;
    let notes = read_all_notes(&root)?;
    let summaries: Vec<NoteSummary> = notes
        .into_iter()
        .map(|note| summary_from_note(&note))
        .collect();
    Ok(summaries)
}

#[tauri::command]
#[specta::specta]
pub async fn get_notes_workspace_tree(
    app: AppHandle,
    workspace: NotesWorkspace,
) -> Result<NoteWorkspaceTree, String> {
    let root = notes_root(&app)?;
    read_workspace_tree(&root, workspace)
}

#[tauri::command]
#[specta::specta]
pub async fn get_archived_notes(app: AppHandle) -> Result<Vec<NoteSummary>, String> {
    let root = notes_root(&app)?;
    let notes = read_notes_in_vault_dir(&root, ARCHIVE_DIR)?;
    let summaries: Vec<NoteSummary> = notes
        .into_iter()
        .map(|note| summary_from_note(&note))
        .collect();
    Ok(summaries)
}

#[tauri::command]
#[specta::specta]
pub async fn get_trashed_notes(app: AppHandle) -> Result<Vec<NoteSummary>, String> {
    let root = notes_root(&app)?;
    let notes = read_notes_in_vault_dir(&root, TRASH_DIR)?;
    let summaries: Vec<NoteSummary> = notes
        .into_iter()
        .map(|note| summary_from_note(&note))
        .collect();
    Ok(summaries)
}

#[tauri::command]
#[specta::specta]
pub async fn get_note(app: AppHandle, id: String) -> Result<Note, String> {
    let root = notes_root(&app)?;
    let mut metadata = load_vault_metadata(&root)?;
    let abs = resolve_note_path_by_id(&root, &mut metadata, &id)?;
    let note = note_from_file_with_metadata(&root, &abs, &mut metadata)?;
    metadata.persist_if_dirty()?;
    Ok(note)
}

#[tauri::command]
#[specta::specta]
pub async fn create_note(app: AppHandle, input: CreateNoteInput) -> Result<NoteSummary, String> {
    let root = notes_root(&app)?;
    let folder = input.folder.as_deref().unwrap_or(INBOX_DIR);
    create_note_at_path(&root, folder, input.title, input.content)
}

#[tauri::command]
#[specta::specta]
pub async fn create_notes_folder(
    app: AppHandle,
    input: CreateNotesFolderInput,
) -> Result<(), String> {
    let root = notes_root(&app)?;
    create_notes_folder_at_path(&root, &input.parent_path, &input.name)
}

#[tauri::command]
#[specta::specta]
pub async fn rename_notes_folder(
    app: AppHandle,
    input: RenameNotesFolderInput,
) -> Result<(), String> {
    let root = notes_root(&app)?;
    rename_notes_folder_at_path(&root, &input.path, &input.name)
}

#[tauri::command]
#[specta::specta]
pub async fn move_notes_tree_item(
    app: AppHandle,
    input: MoveNotesTreeItemInput,
) -> Result<(), String> {
    let root = notes_root(&app)?;
    move_notes_tree_item_at_path(&root, input.item, &input.destination_folder)
}

#[tauri::command]
#[specta::specta]
pub async fn archive_notes_tree_item(app: AppHandle, item: NotesTreeItemRef) -> Result<(), String> {
    let root = notes_root(&app)?;
    move_tree_item_to_lifecycle_dir(&root, item, ARCHIVE_DIR)
}

#[tauri::command]
#[specta::specta]
pub async fn trash_notes_tree_item(app: AppHandle, item: NotesTreeItemRef) -> Result<(), String> {
    let root = notes_root(&app)?;
    move_tree_item_to_lifecycle_dir(&root, item, TRASH_DIR)
}

#[tauri::command]
#[specta::specta]
pub async fn restore_notes_tree_item(app: AppHandle, item: NotesTreeItemRef) -> Result<(), String> {
    let root = notes_root(&app)?;
    restore_notes_tree_item_to_inbox(&root, item)
}

#[tauri::command]
#[specta::specta]
pub async fn update_note(app: AppHandle, input: UpdateNoteInput) -> Result<Note, String> {
    let root = notes_root(&app)?;
    let mut metadata = load_vault_metadata(&root)?;
    let abs = resolve_note_path_by_id(&root, &mut metadata, &input.id)?;

    write_atomic(&abs, &input.content)?;
    let note = note_from_file_with_metadata(&root, &abs, &mut metadata)?;
    metadata.persist_if_dirty()?;
    Ok(note)
}

#[tauri::command]
#[specta::specta]
pub async fn rename_note(app: AppHandle, input: RenameNoteInput) -> Result<Note, String> {
    let root = notes_root(&app)?;
    let mut metadata = load_vault_metadata(&root)?;
    let src_abs = resolve_note_path_by_id(&root, &mut metadata, &input.id)?;
    let source_path = relative_note_path(&root, &src_abs)?;

    let new_filename = ensure_md_filename(&input.title);
    let target_abs = src_abs
        .parent()
        .ok_or_else(|| "Invalid note path".to_string())?
        .join(new_filename);

    if target_abs != src_abs {
        if target_abs.exists() {
            return Err("A note with this name already exists".to_string());
        }
        std::fs::rename(&src_abs, &target_abs)
            .map_err(|e| format!("Failed to rename note: {e}"))?;
        let target_path = relative_note_path(&root, &target_abs)?;
        metadata.rebind_path(&source_path, &target_path);
    }

    let note = note_from_file_with_metadata(&root, &target_abs, &mut metadata)?;
    metadata.persist_if_dirty()?;
    Ok(note)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_note(app: AppHandle, id: String) -> Result<NoteSummary, String> {
    let root = notes_root(&app)?;
    let note = move_note_to_lifecycle_dir(&root, &id, TRASH_DIR)?;
    Ok(summary_from_note(&note))
}

#[tauri::command]
#[specta::specta]
pub async fn archive_note(app: AppHandle, id: String) -> Result<NoteSummary, String> {
    let root = notes_root(&app)?;
    let note = move_note_to_lifecycle_dir(&root, &id, ARCHIVE_DIR)?;
    Ok(summary_from_note(&note))
}

#[tauri::command]
#[specta::specta]
pub async fn restore_note(app: AppHandle, id: String) -> Result<NoteSummary, String> {
    let root = notes_root(&app)?;
    let note = restore_note_to_inbox(&root, &id)?;
    Ok(summary_from_note(&note))
}

#[tauri::command]
#[specta::specta]
pub async fn list_note_annotations(
    app: AppHandle,
    note_id: String,
) -> Result<Vec<NoteAnnotation>, String> {
    let root = notes_root(&app)?;
    list_note_annotations_for_note(&root, &note_id)
}

#[tauri::command]
#[specta::specta]
pub async fn create_note_annotation(
    app: AppHandle,
    input: CreateNoteAnnotationInput,
) -> Result<NoteAnnotation, String> {
    let root = notes_root(&app)?;
    create_note_annotation_at_range(&root, &input.note_id.clone(), input)
}

#[tauri::command]
#[specta::specta]
pub async fn update_note_annotation_text(
    app: AppHandle,
    input: UpdateNoteAnnotationTextInput,
) -> Result<NoteAnnotation, String> {
    let root = notes_root(&app)?;
    update_note_annotation_text_at_path(&root, input)
}

#[tauri::command]
#[specta::specta]
pub async fn resolve_note_annotation(
    app: AppHandle,
    input: NoteAnnotationRefInput,
) -> Result<NoteAnnotation, String> {
    let root = notes_root(&app)?;
    set_note_annotation_state_at_path(&root, input, NoteAnnotationState::Resolved)
}

#[tauri::command]
#[specta::specta]
pub async fn reopen_note_annotation(
    app: AppHandle,
    input: NoteAnnotationRefInput,
) -> Result<NoteAnnotation, String> {
    let root = notes_root(&app)?;
    set_note_annotation_state_at_path(&root, input, NoteAnnotationState::Active)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_note_annotation(
    app: AppHandle,
    input: NoteAnnotationRefInput,
) -> Result<(), String> {
    let root = notes_root(&app)?;
    delete_note_annotation_at_path(&root, input)
}

#[tauri::command]
#[specta::specta]
pub async fn reposition_note_annotation(
    app: AppHandle,
    input: RepositionNoteAnnotationInput,
) -> Result<NoteAnnotation, String> {
    let root = notes_root(&app)?;
    reposition_note_annotation_at_range(&root, input)
}

#[tauri::command]
#[specta::specta]
pub async fn search_notes(app: AppHandle, query: String) -> Result<Vec<Note>, String> {
    let trimmed = query.trim().to_lowercase();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let root = notes_root(&app)?;
    let mut notes = read_all_notes(&root)?;

    notes.retain(|note| {
        if note.title.to_lowercase().contains(&trimmed) {
            return true;
        }
        if note.content.to_lowercase().contains(&trimmed) {
            return true;
        }
        if note
            .tags
            .iter()
            .any(|tag| tag.to_lowercase().contains(&trimmed))
        {
            return true;
        }
        note.wiki_links
            .iter()
            .any(|link| link.to_lowercase().contains(&trimmed))
    });

    if notes.len() > SEARCH_MAX_RESULTS {
        notes.truncate(SEARCH_MAX_RESULTS);
    }

    Ok(notes)
}

#[tauri::command]
#[specta::specta]
pub async fn get_notes_vault_info(app: AppHandle) -> Result<NoteVaultInfo, String> {
    active_vault_info(&app)
}

#[tauri::command]
#[specta::specta]
pub async fn set_notes_vault_path(app: AppHandle, path: String) -> Result<NoteVaultInfo, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Notes vault path cannot be empty".to_string());
    }

    let root = PathBuf::from(trimmed);
    if !root.is_absolute() {
        return Err("Notes vault path must be absolute".to_string());
    }

    ensure_vault_structure(&root)?;

    let mut app_preferences = preferences::load_preferences_from_disk(&app)?;
    app_preferences.notes_vault_path = Some(root.to_string_lossy().to_string());
    preferences::save_preferences_to_disk(&app, &app_preferences)?;

    Ok(vault_info_from_path(&root, false))
}

#[tauri::command]
#[specta::specta]
pub async fn reset_notes_vault_path(app: AppHandle) -> Result<NoteVaultInfo, String> {
    let root = default_notes_vault_root(&app)?;
    ensure_vault_structure(&root)?;

    let mut app_preferences = preferences::load_preferences_from_disk(&app)?;
    app_preferences.notes_vault_path = None;
    preferences::save_preferences_to_disk(&app, &app_preferences)?;

    Ok(vault_info_from_path(&root, true))
}

#[tauri::command]
#[specta::specta]
pub async fn migrate_notes_vault(
    app: AppHandle,
    input: MigrateNotesVaultInput,
) -> Result<NoteVaultMigrationResult, String> {
    let source_path = input.source_path.trim();
    if source_path.is_empty() {
        return Err("Source notes vault path cannot be empty".to_string());
    }

    let source_root = PathBuf::from(source_path);
    if !source_root.is_absolute() {
        return Err("Source notes vault path must be absolute".to_string());
    }

    let destination_root = notes_root(&app)?;
    migrate_notes_vault_contents(&source_root, &destination_root, input.mode)
}

#[tauri::command]
#[specta::specta]
pub async fn open_notes_vault_folder(app: AppHandle) -> Result<(), String> {
    let info = active_vault_info(&app)?;
    app.opener()
        .open_path(info.path, None::<&str>)
        .map_err(|e| format!("Failed to open notes folder: {e}"))
}

#[cfg(test)]
#[path = "notes/tests.rs"]
mod tests;
