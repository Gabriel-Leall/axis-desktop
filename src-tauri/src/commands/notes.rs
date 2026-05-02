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

const NOTES_ROOT_DIR: &str = "notes";
const INBOX_DIR: &str = "inbox";
const SEARCH_MAX_RESULTS: usize = 80;

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

fn notes_root(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;
    let notes_dir = app_data_dir.join(NOTES_ROOT_DIR);

    std::fs::create_dir_all(notes_dir.join(INBOX_DIR))
        .map_err(|e| format!("Failed to create notes directory: {e}"))?;

    Ok(notes_dir)
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

    fn walk(root: &Path, dir: &Path, out: &mut Vec<Note>) -> Result<(), String> {
        let entries =
            std::fs::read_dir(dir).map_err(|e| format!("Failed to list notes directory: {e}"))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
            let path = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|e| format!("Failed to read entry type: {e}"))?;

            if file_type.is_dir() {
                if entry.file_name().to_string_lossy().starts_with('.') {
                    continue;
                }
                walk(root, &path, out)?;
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

    walk(root, root, &mut notes)?;
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
    let abs = resolve_note_path(&root, &id)?;
    if !abs.exists() {
        return Err("Note not found".to_string());
    }

    std::fs::remove_file(&abs).map_err(|e| format!("Failed to delete note: {e}"))?;
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
