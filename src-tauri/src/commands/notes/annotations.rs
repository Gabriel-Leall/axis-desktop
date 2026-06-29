use super::*;

pub(super) const NOTE_ANNOTATION_SIDECAR_SCHEMA_VERSION: u32 = 1;
const ANNOTATION_CONTEXT_CHARS: usize = 32;

#[derive(Debug, Serialize, Deserialize, Type, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NoteAnnotationState {
    Active,
    Resolved,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NoteAnnotationAnchorStatus {
    Anchored,
    Lost,
}

#[derive(Debug, Serialize, Deserialize, Type, Clone)]
pub struct NoteAnnotation {
    pub id: String,
    pub note_id: String,
    pub state: NoteAnnotationState,
    pub anchor_status: NoteAnnotationAnchorStatus,
    pub text: String,
    pub from: u32,
    pub to: u32,
    pub quote: String,
    pub prefix: String,
    pub suffix: String,
    pub created_at: String,
    pub updated_at: String,
    pub resolved_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateNoteAnnotationInput {
    pub note_id: String,
    pub text: String,
    pub from: u32,
    pub to: u32,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct NoteAnnotationRefInput {
    pub note_id: String,
    pub annotation_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct UpdateNoteAnnotationTextInput {
    pub note_id: String,
    pub annotation_id: String,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct RepositionNoteAnnotationInput {
    pub note_id: String,
    pub annotation_id: String,
    pub from: u32,
    pub to: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct NoteAnnotationSidecar {
    schema_version: u32,
    note_id: String,
    annotations: Vec<NoteAnnotation>,
}

fn sidecar_path(root: &Path, note_id: &str) -> Result<PathBuf, String> {
    if note_id.is_empty()
        || !note_id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
    {
        return Err("Invalid note annotation sidecar ID".to_string());
    }

    Ok(root
        .join(VAULT_METADATA_DIR)
        .join(VAULT_SIDECARS_DIR)
        .join(format!("{note_id}.json")))
}

fn load_annotation_sidecar(root: &Path, note_id: &str) -> Result<NoteAnnotationSidecar, String> {
    let path = sidecar_path(root, note_id)?;
    ensure_not_symlink(&path, "Notes annotation sidecar")?;

    if !path.exists() {
        return Ok(NoteAnnotationSidecar {
            schema_version: NOTE_ANNOTATION_SIDECAR_SCHEMA_VERSION,
            note_id: note_id.to_string(),
            annotations: Vec::new(),
        });
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read notes annotation sidecar: {e}"))?;
    let mut sidecar: NoteAnnotationSidecar = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse notes annotation sidecar: {e}"))?;
    sidecar.schema_version = NOTE_ANNOTATION_SIDECAR_SCHEMA_VERSION;
    sidecar.note_id = note_id.to_string();
    Ok(sidecar)
}

fn persist_annotation_sidecar(root: &Path, sidecar: &NoteAnnotationSidecar) -> Result<(), String> {
    let path = sidecar_path(root, &sidecar.note_id)?;
    let content = serde_json::to_string_pretty(sidecar)
        .map_err(|e| format!("Failed to serialize notes annotation sidecar: {e}"))?;
    write_atomic(&path, &content)
}

fn canonical_note_and_content(root: &Path, note_id: &str) -> Result<(Note, String), String> {
    let mut metadata = load_vault_metadata(root)?;
    let abs = resolve_note_path_by_id(root, &mut metadata, note_id)?;
    let note = note_from_file_with_metadata(root, &abs, &mut metadata)?;
    metadata.persist_if_dirty()?;
    Ok((note.clone(), note.content))
}

fn utf16_to_byte_index(content: &str, offset: usize) -> usize {
    if offset == 0 {
        return 0;
    }

    let mut units = 0;
    for (byte_index, ch) in content.char_indices() {
        if units >= offset {
            return byte_index;
        }
        units += ch.len_utf16();
    }

    content.len()
}

fn byte_to_utf16_index(content: &str, byte_index: usize) -> usize {
    content[..byte_index.min(content.len())]
        .encode_utf16()
        .count()
}

fn slice_utf16(content: &str, from: usize, to: usize) -> String {
    let byte_from = utf16_to_byte_index(content, from);
    let byte_to = utf16_to_byte_index(content, to);
    content[byte_from..byte_to].to_string()
}

fn u32_to_usize(value: u32) -> usize {
    value as usize
}

fn usize_to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

fn annotation_context(content: &str, from: usize, to: usize) -> (String, String) {
    let prefix_from = from.saturating_sub(ANNOTATION_CONTEXT_CHARS);
    let suffix_to = to.saturating_add(ANNOTATION_CONTEXT_CHARS);
    (
        slice_utf16(content, prefix_from, from),
        slice_utf16(content, to, suffix_to),
    )
}

fn snapshot_annotation_anchor(
    content: &str,
    from: usize,
    to: usize,
) -> Result<(String, String, String), String> {
    let start = from.min(to);
    let end = from.max(to);
    if start == end {
        return Err("Annotations require a non-empty selection".to_string());
    }

    let quote = slice_utf16(content, start, end);
    if quote.trim().is_empty() {
        return Err("Annotations require a non-empty selection".to_string());
    }
    let (prefix, suffix) = annotation_context(content, start, end);
    Ok((quote, prefix, suffix))
}

fn reconcile_annotation(annotation: &mut NoteAnnotation, content: &str) -> bool {
    if annotation.anchor_status == NoteAnnotationAnchorStatus::Anchored
        && slice_utf16(
            content,
            u32_to_usize(annotation.from),
            u32_to_usize(annotation.to),
        ) == annotation.quote
    {
        return false;
    }

    let matches: Vec<usize> = content
        .match_indices(&annotation.quote)
        .map(|(index, _)| index)
        .collect();
    let context_matches: Vec<usize> = matches
        .iter()
        .copied()
        .filter(|byte_index| {
            let from = byte_to_utf16_index(content, *byte_index);
            let to = from + annotation.quote.encode_utf16().count();
            let (prefix, suffix) = annotation_context(content, from, to);
            prefix.ends_with(&annotation.prefix) && suffix.starts_with(&annotation.suffix)
        })
        .collect();
    let candidates = if context_matches.is_empty() {
        matches
    } else {
        context_matches
    };

    if candidates.len() != 1 {
        if annotation.anchor_status != NoteAnnotationAnchorStatus::Lost {
            annotation.anchor_status = NoteAnnotationAnchorStatus::Lost;
            annotation.updated_at = now_iso_string();
            return true;
        }
        return false;
    }

    let byte_from = candidates[0];
    let from = byte_to_utf16_index(content, byte_from);
    let to = from + annotation.quote.encode_utf16().count();
    let changed = u32_to_usize(annotation.from) != from
        || u32_to_usize(annotation.to) != to
        || annotation.anchor_status != NoteAnnotationAnchorStatus::Anchored;
    annotation.from = usize_to_u32(from);
    annotation.to = usize_to_u32(to);
    annotation.anchor_status = NoteAnnotationAnchorStatus::Anchored;
    if changed {
        annotation.updated_at = now_iso_string();
    }
    changed
}

pub(super) fn list_note_annotations_for_note(
    root: &Path,
    note_id: &str,
) -> Result<Vec<NoteAnnotation>, String> {
    let (note, content) = canonical_note_and_content(root, note_id)?;
    let mut sidecar = load_annotation_sidecar(root, &note.id)?;
    let mut dirty = false;

    for annotation in &mut sidecar.annotations {
        dirty |= reconcile_annotation(annotation, &content);
    }

    if dirty {
        persist_annotation_sidecar(root, &sidecar)?;
    }

    Ok(sidecar.annotations)
}

pub(super) fn create_note_annotation_at_range(
    root: &Path,
    note_id: &str,
    input: CreateNoteAnnotationInput,
) -> Result<NoteAnnotation, String> {
    let (note, content) = canonical_note_and_content(root, note_id)?;
    if input.note_id != note_id {
        return Err("Annotation note ID mismatch".to_string());
    }
    let from = u32_to_usize(input.from.min(input.to));
    let to = u32_to_usize(input.from.max(input.to));
    let (quote, prefix, suffix) = snapshot_annotation_anchor(&content, from, to)?;
    let now = now_iso_string();
    let annotation = NoteAnnotation {
        id: Uuid::new_v4().to_string(),
        note_id: note.id.clone(),
        state: NoteAnnotationState::Active,
        anchor_status: NoteAnnotationAnchorStatus::Anchored,
        text: input.text,
        from: usize_to_u32(from),
        to: usize_to_u32(to),
        quote,
        prefix,
        suffix,
        created_at: now.clone(),
        updated_at: now,
        resolved_at: None,
    };
    let mut sidecar = load_annotation_sidecar(root, &note.id)?;
    sidecar.annotations.push(annotation.clone());
    persist_annotation_sidecar(root, &sidecar)?;
    Ok(annotation)
}

pub(super) fn update_note_annotation_text_at_path(
    root: &Path,
    input: UpdateNoteAnnotationTextInput,
) -> Result<NoteAnnotation, String> {
    let (note, _) = canonical_note_and_content(root, &input.note_id)?;
    let mut sidecar = load_annotation_sidecar(root, &note.id)?;
    let annotation = sidecar
        .annotations
        .iter_mut()
        .find(|annotation| annotation.id == input.annotation_id)
        .ok_or_else(|| "Annotation not found".to_string())?;

    annotation.text = input.text;
    annotation.updated_at = now_iso_string();
    let updated = annotation.clone();
    persist_annotation_sidecar(root, &sidecar)?;
    Ok(updated)
}

pub(super) fn set_note_annotation_state_at_path(
    root: &Path,
    input: NoteAnnotationRefInput,
    state: NoteAnnotationState,
) -> Result<NoteAnnotation, String> {
    let (note, _) = canonical_note_and_content(root, &input.note_id)?;
    let mut sidecar = load_annotation_sidecar(root, &note.id)?;
    let now = now_iso_string();
    let annotation = sidecar
        .annotations
        .iter_mut()
        .find(|annotation| annotation.id == input.annotation_id)
        .ok_or_else(|| "Annotation not found".to_string())?;

    annotation.state = state;
    annotation.updated_at = now.clone();
    annotation.resolved_at = (state == NoteAnnotationState::Resolved).then_some(now);
    let updated = annotation.clone();
    persist_annotation_sidecar(root, &sidecar)?;
    Ok(updated)
}

pub(super) fn delete_note_annotation_at_path(
    root: &Path,
    input: NoteAnnotationRefInput,
) -> Result<(), String> {
    let (note, _) = canonical_note_and_content(root, &input.note_id)?;
    let mut sidecar = load_annotation_sidecar(root, &note.id)?;
    let previous_len = sidecar.annotations.len();
    sidecar
        .annotations
        .retain(|annotation| annotation.id != input.annotation_id);
    if sidecar.annotations.len() == previous_len {
        return Err("Annotation not found".to_string());
    }
    persist_annotation_sidecar(root, &sidecar)
}

pub(super) fn reposition_note_annotation_at_range(
    root: &Path,
    input: RepositionNoteAnnotationInput,
) -> Result<NoteAnnotation, String> {
    let (note, content) = canonical_note_and_content(root, &input.note_id)?;
    let from = u32_to_usize(input.from.min(input.to));
    let to = u32_to_usize(input.from.max(input.to));
    let (quote, prefix, suffix) = snapshot_annotation_anchor(&content, from, to)?;
    let mut sidecar = load_annotation_sidecar(root, &note.id)?;
    let annotation = sidecar
        .annotations
        .iter_mut()
        .find(|annotation| annotation.id == input.annotation_id)
        .ok_or_else(|| "Annotation not found".to_string())?;

    annotation.from = usize_to_u32(from);
    annotation.to = usize_to_u32(to);
    annotation.quote = quote;
    annotation.prefix = prefix;
    annotation.suffix = suffix;
    annotation.anchor_status = NoteAnnotationAnchorStatus::Anchored;
    annotation.updated_at = now_iso_string();
    let updated = annotation.clone();
    persist_annotation_sidecar(root, &sidecar)?;
    Ok(updated)
}

pub(super) fn seed_welcome_annotation(root: &Path, note_id: &str) -> Result<(), String> {
    let annotations = list_note_annotations_for_note(root, note_id)?;
    if !annotations.is_empty() {
        return Ok(());
    }

    let quote = "Markdown";
    let from = WELCOME_NOTE_CONTENT
        .find(quote)
        .ok_or_else(|| "Welcome annotation quote not found".to_string())?;
    let from = byte_to_utf16_index(WELCOME_NOTE_CONTENT, from);
    let to = from + quote.encode_utf16().count();

    create_note_annotation_at_range(
        root,
        note_id,
        CreateNoteAnnotationInput {
            note_id: note_id.to_string(),
            text: "Markdown e o formato local das suas notas no Axis.".to_string(),
            from: usize_to_u32(from),
            to: usize_to_u32(to),
        },
    )?;
    Ok(())
}
