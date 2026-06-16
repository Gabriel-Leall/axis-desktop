//! Notes domain commands.
//!
//! Local-file markdown notes with metadata extraction.

use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};
use std::sync::LazyLock;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::commands::preferences;
use crate::types::AppPreferences;

const DEFAULT_VAULT_DIR_NAME: &str = "Axis Notes";
const INBOX_DIR: &str = "inbox";
const ARCHIVE_DIR: &str = "archive";
const TRASH_DIR: &str = "trash";
const VAULT_METADATA_DIR: &str = ".axis-notes";
const VAULT_MANIFEST_FILE: &str = "manifest.json";
const VAULT_SIDECARS_DIR: &str = "sidecars";
const VAULT_CACHE_DIR: &str = "cache";
const VAULT_CONFIG_DIR: &str = "config";
const VAULT_METADATA_SCHEMA_VERSION: u32 = 1;
const SEARCH_MAX_RESULTS: usize = 80;

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

#[derive(Debug, Serialize, Deserialize)]
struct VaultManifest {
    schema_version: u32,
    application: String,
    created_at: String,
    updated_at: String,
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

    let layout = VaultLayout::standard();
    for dir in layout.required_dirs() {
        std::fs::create_dir_all(root.join(dir))
            .map_err(|e| format!("Failed to create notes vault directory: {e}"))?;
    }

    ensure_vault_metadata_area(root)?;

    Ok(())
}

fn ensure_vault_metadata_area(root: &Path) -> Result<(), String> {
    let metadata_root = root.join(VAULT_METADATA_DIR);
    let layout = VaultLayout::standard();
    for dir in layout.metadata_dirs() {
        std::fs::create_dir_all(metadata_root.join(dir))
            .map_err(|e| format!("Failed to create notes metadata directory: {e}"))?;
    }

    let manifest_path = metadata_root.join(VAULT_MANIFEST_FILE);
    if manifest_path.exists() {
        if !manifest_path.is_file() {
            return Err("Notes vault manifest path is not a file".to_string());
        }
        return Ok(());
    }

    let now = now_iso_string();
    let manifest = VaultManifest {
        schema_version: VAULT_METADATA_SCHEMA_VERSION,
        application: "axis-desktop".to_string(),
        created_at: now.clone(),
        updated_at: now,
    };
    let content = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize notes vault manifest: {e}"))?;

    write_atomic(&manifest_path, &content)?;
    Ok(())
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

fn resolve_note_title(content: &str, path: &str) -> String {
    let first_non_empty = content
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or_default()
        .trim()
        .to_string();

    if first_non_empty.starts_with("# ") {
        return first_non_empty.trim_start_matches("# ").trim().to_string();
    }

    if !first_non_empty.is_empty() {
        return first_non_empty;
    }

    Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

fn parse_iso_or_epoch(value: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.timestamp_millis())
        .unwrap_or(0)
}

fn note_from_file(root: &Path, abs_path: &Path) -> Result<Note, String> {
    let rel = abs_path
        .strip_prefix(root)
        .map_err(|e| format!("Failed to compute relative note path: {e}"))?
        .to_string_lossy()
        .replace('\\', "/");

    let metadata =
        std::fs::metadata(abs_path).map_err(|e| format!("Failed to read note metadata: {e}"))?;
    let content = std::fs::read_to_string(abs_path)
        .map_err(|e| format!("Failed to read note content: {e}"))?;

    let created_at = metadata
        .created()
        .map(|v| {
            let dt: chrono::DateTime<chrono::Utc> = v.into();
            dt.to_rfc3339()
        })
        .unwrap_or_else(|_| now_iso_string());

    let updated_at = metadata
        .modified()
        .map(|v| {
            let dt: chrono::DateTime<chrono::Utc> = v.into();
            dt.to_rfc3339()
        })
        .unwrap_or_else(|_| created_at.clone());

    let title = resolve_note_title(&content, &rel);

    Ok(Note {
        id: rel.clone(),
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

fn read_all_notes(root: &Path) -> Result<Vec<Note>, String> {
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

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let temp_path = path.with_extension("tmp");
    std::fs::write(&temp_path, content)
        .map_err(|e| format!("Failed to write temp note file: {e}"))?;

    if let Err(rename_err) = std::fs::rename(&temp_path, path) {
        if let Err(remove_err) = std::fs::remove_file(&temp_path) {
            log::warn!("Failed to remove temp note file after rename failure: {remove_err}");
        }
        return Err(format!("Failed to finalize note file: {rename_err}"));
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

fn merge_title_body(title: &str, body: &str) -> String {
    let t = title.trim();
    let b = body.trim_start_matches('\n');

    if t.is_empty() && b.is_empty() {
        return String::new();
    }
    if t.is_empty() {
        return b.to_string();
    }
    if b.is_empty() {
        return format!("# {t}");
    }
    format!("# {t}\n\n{b}")
}

fn move_note_to_vault_dir(root: &Path, id: &str, destination_dir: &str) -> Result<Note, String> {
    let src_abs = resolve_note_path(root, id)?;
    if !src_abs.is_file() {
        return Err("Note not found".to_string());
    }

    if note_top_level_dir_name(id).as_deref() == Some(destination_dir) {
        return note_from_file(root, &src_abs);
    }

    let file_name = src_abs
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid note path".to_string())?;
    let target_abs = next_unique_path(root, destination_dir, file_name)?;

    std::fs::rename(&src_abs, &target_abs).map_err(|e| format!("Failed to move note: {e}"))?;
    note_from_file(root, &target_abs)
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
    let top_level_dir = note_top_level_dir_name(id);

    if top_level_dir
        .as_deref()
        .is_some_and(|dir| layout.is_lifecycle_dir_name(dir))
    {
        return move_note_to_vault_dir(root, id, INBOX_DIR);
    }

    let abs = resolve_note_path(root, id)?;
    if !abs.is_file() {
        return Err("Note not found".to_string());
    }
    note_from_file(root, &abs)
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
pub async fn get_note(app: AppHandle, id: String) -> Result<Note, String> {
    let root = notes_root(&app)?;
    let abs = resolve_note_path(&root, &id)?;
    if !abs.exists() {
        return Err("Note not found".to_string());
    }
    note_from_file(&root, &abs)
}

#[tauri::command]
#[specta::specta]
pub async fn create_note(app: AppHandle, input: CreateNoteInput) -> Result<NoteSummary, String> {
    let root = notes_root(&app)?;
    let _folder = input.folder.unwrap_or_else(|| INBOX_DIR.to_string());

    let content = match input.content {
        Some(existing) if !existing.trim().is_empty() => existing,
        _ => {
            let title = input
                .title
                .clone()
                .unwrap_or_else(|| "Untitled".to_string());
            merge_title_body(&title, "")
        }
    };

    let file_title = input
        .title
        .unwrap_or_else(|| resolve_note_title(&content, "Untitled.md"));
    let base_name = ensure_md_filename(&file_title);
    let abs = next_unique_path(&root, INBOX_DIR, &base_name)?;

    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create note parent folder: {e}"))?;
    }

    write_atomic(&abs, &content)?;
    let note = note_from_file(&root, &abs)?;
    Ok(summary_from_note(&note))
}

#[tauri::command]
#[specta::specta]
pub async fn update_note(app: AppHandle, input: UpdateNoteInput) -> Result<Note, String> {
    let root = notes_root(&app)?;
    let abs = resolve_note_path(&root, &input.id)?;
    if !abs.exists() {
        return Err("Note not found".to_string());
    }

    write_atomic(&abs, &input.content)?;
    let note = note_from_file(&root, &abs)?;
    Ok(note)
}

#[tauri::command]
#[specta::specta]
pub async fn rename_note(app: AppHandle, input: RenameNoteInput) -> Result<Note, String> {
    let root = notes_root(&app)?;
    let src_abs = resolve_note_path(&root, &input.id)?;
    if !src_abs.exists() {
        return Err("Note not found".to_string());
    }

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
    }

    let note = note_from_file(&root, &target_abs)?;
    Ok(note)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    let root = notes_root(&app)?;
    move_note_to_lifecycle_dir(&root, &id, TRASH_DIR)?;
    Ok(())
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
pub async fn open_notes_vault_folder(app: AppHandle) -> Result<(), String> {
    let info = active_vault_info(&app)?;
    app.opener()
        .open_path(info.path, None::<&str>)
        .map_err(|e| format!("Failed to open notes folder: {e}"))
}

#[cfg(test)]
mod tests {
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

        assert_eq!(path, documents.join("Axis Notes"));
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

        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].path, "inbox/visible.md");

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

        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].path, "inbox/visible.md");

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

        assert_eq!(root, Path::new("Documents").join("Axis Notes"));
    }
}
