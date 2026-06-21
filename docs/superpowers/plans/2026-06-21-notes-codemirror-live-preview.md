# Notes CodeMirror Live Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the Toast UI writing surface with a persistent CodeMirror 6 Markdown live-preview editor while making the MD filename the note title and the file body independent Markdown.

**Architecture:** Rust remains the source of truth for the vault: a note title comes from its Markdown filename and the UUID in the vault manifest remains stable through rename. The Zustand store exposes a durable rename action and continues to debounce body saves. Focused CodeMirror modules own editor state, Markdown decorations, shortcuts, slash completions, and the React lifecycle; NotesPage only composes the editor, title field, and read-only preview.

**Tech Stack:** Tauri v2, Rust, React 19, TypeScript, Zustand v5, Vitest, CodeMirror 6, and Toast UI Viewer only for read-only preview.

---

## File Map

- src-tauri/src/commands/notes.rs: derive titles from file names and create empty Markdown bodies.
- src-tauri/src/commands/notes/tests.rs: lock down title, empty-body creation, and stable-ID rename behavior.
- src/store/notes-store.ts: expose an immediate renameNote lifecycle action beside debounced body editing.
- src/store/notes-store.test.ts: verify rename request, tree replacement, selection stability, and errors.
- src/components/notes/editor/markdown-live-preview.ts: pure CodeMirror extensions for visible-range Markdown decorations.
- src/components/notes/editor/markdown-live-preview.test.ts: test decoration visibility and marker-reveal transitions without React.
- src/components/notes/editor/markdown-editor-commands.ts: pure Markdown transforms, keymaps, and slash-command completion source.
- src/components/notes/editor/markdown-editor-commands.test.ts: test Markdown output for shortcuts and slash commands through EditorState.
- src/components/notes/editor/MarkdownLiveEditor.tsx: imperative, stable EditorView bridge for React.
- src/components/notes/editor/MarkdownLiveEditor.test.tsx: test body edits, external note changes, and read-only behavior with real extensions.
- src/pages/NotesPage.tsx: remove title/body parsing and Toast editor usage; keep Edit and Preview modes.
- src/pages/NotesPage.test.tsx: cover filename-backed title editing, live edit, read-only preview, and no Split control.
- src/App.css: remove Toast UI editor overrides and add scoped CodeMirror paper-surface styling.
- locales/en.json and locales/pt-BR.json: replace obsolete WYSIWYG and Split strings.
- docs/developer/notes-architecture.md: document filename-title ownership and CodeMirror lifecycle boundaries.
- package.json and bun.lock: add only CodeMirror dependencies; retain Toast UI only for Viewer.

### Task 1: Make the Markdown Filename the Durable Title

**Files:**
- Modify: src-tauri/src/commands/notes.rs
- Modify: src-tauri/src/commands/notes/tests.rs
- Modify: docs/developer/notes-architecture.md

- [ ] **Step 1: Write the failing Rust tests**

Add tests that create inbox/meeting.md containing a different leading H1 and assert note.title equals meeting. Add a creation test asserting CreateNoteInput with no title or content writes an empty inbox/Untitled.md. Add a rename test asserting the manifest ID is identical while the body is byte-for-byte unchanged.

    assert_eq!(note.title, "meeting");
    assert_eq!(std::fs::read_to_string(root.join("inbox/Untitled.md"))?, "");
    assert_eq!(before.id, after.id);
    assert_eq!(after.content, "- body only\n");

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

    bun run rust:test -- notes

Expected: the filename-title and empty-body assertions fail because the current implementation derives title from the first content line and writes a title scaffold.

- [ ] **Step 3: Implement the filename-title contract**

Replace resolve_note_title with a path-only function and remove title-body merging from create_note. Preserve sanitization, unique paths, atomic writes, and manifest rebinding in rename_note.

    fn resolve_note_title(path: &str) -> String {
        Path::new(path)
            .file_stem()
            .and_then(|stem| stem.to_str())
            .filter(|title| !title.trim().is_empty())
            .unwrap_or("Untitled")
            .to_string()
    }

    let content = input.content.unwrap_or_default();
    let file_title = input.title.unwrap_or_else(|| "Untitled".to_string());

Update callers to pass only the vault-relative path. Do not alter Markdown in rename_note; a heading is ordinary document content.

- [ ] **Step 4: Document the durable contract**

Document that title equals file stem, creation makes an empty MD body, H1 headings are not synchronized, and stable UUIDs survive rename.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

    bun run rust:test -- notes

Expected: all notes command tests pass.

- [ ] **Step 6: Commit the durable title contract**

    git add src-tauri/src/commands/notes.rs src-tauri/src/commands/notes/tests.rs docs/developer/notes-architecture.md
    git commit -m "feat(notes): use filenames as note titles"

### Task 2: Add an Immediate Store Rename Action

**Files:**
- Modify: src/store/notes-store.ts
- Modify: src/store/notes-store.test.ts

- [ ] **Step 1: Write the failing store tests**

Add tests for renameNote(id, title): it calls commands.renameNote, replaces the matching note in notes and tree, retains selectedNoteId, and reloads authoritative data after a failure.

    await useNotesStore.getState().renameNote("stable-id", "IHC errors");

    expect(commands.renameNote).toHaveBeenCalledWith({
      id: "stable-id",
      title: "IHC errors",
    });
    expect(useNotesStore.getState().selectedNoteId).toBe("stable-id");
    expect(useNotesStore.getState().selectedNote()?.path).toBe(
      "inbox/IHC errors.md"
    );

- [ ] **Step 2: Run the focused test and verify RED**

Run:

    bun run test:run -- src/store/notes-store.test.ts

Expected: the store type lacks renameNote.

- [ ] **Step 3: Implement renameNote as a store lifecycle action**

Add renameNote to NotesState. Call the generated typed binding, map the returned note, and replace it in notes, tree, and searchResults when present. Do not change selectedNoteId because it is a stable manifest UUID. On failure, log, loadNotes, and rethrow.

    renameNote: async (id, title) => {
      try {
        const renamed = mapBindingNote(
          unwrapResult(await commands.renameNote({ id, title }))
        );
        set(state => ({
          notes: state.notes.map(note => note.id === id ? renamed : note),
          tree: updateNoteInTree(state.tree, renamed),
          searchResults: state.searchResults?.map(note =>
            note.id === id ? renamed : note
          ) ?? null,
        }));
      } catch (error) {
        await get().loadNotes();
        throw error;
      }
    }

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

    bun run test:run -- src/store/notes-store.test.ts

Expected: all store tests pass.

- [ ] **Step 5: Commit the store action**

    git add src/store/notes-store.ts src/store/notes-store.test.ts
    git commit -m "feat(notes): rename file-backed note titles"

### Task 3: Install CodeMirror and Build Testable Markdown Extensions

**Files:**
- Modify: package.json
- Modify: bun.lock
- Create: src/components/notes/editor/markdown-live-preview.ts
- Create: src/components/notes/editor/markdown-live-preview.test.ts
- Create: src/components/notes/editor/markdown-editor-commands.ts
- Create: src/components/notes/editor/markdown-editor-commands.test.ts

- [ ] **Step 1: Write failing pure tests for live preview and commands**

Test completed strong, emphasis, inline code, headings, bullet lists, and checked task lists receive visible-range decorations while an active selection reveals their markers. Test bold wraps a selection with strong markers, heading inserts a heading prefix, and slash quote replaces slash quote with a block quote.

    expect(decoratedText(state, 0, state.doc.length)).toContain("cm-md-strong");
    expect(applyCommand("bold", "word", { from: 0, to: 4 })).toBe("**word**");
    expect(applySlashCommand("/quote")).toBe("> ");

- [ ] **Step 2: Run focused tests and verify RED**

Run:

    bun run test:run -- src/components/notes/editor/markdown-live-preview.test.ts src/components/notes/editor/markdown-editor-commands.test.ts

Expected: module resolution fails because the modules do not exist.

- [ ] **Step 3: Install CodeMirror dependencies**

Run:

    bun add @codemirror/autocomplete @codemirror/commands @codemirror/lang-markdown @codemirror/language @codemirror/state @codemirror/view @lezer/highlight

Do not add a React wrapper. Axis needs explicit EditorView ownership and must not make the document a controlled React value.

- [ ] **Step 4: Implement visible-range decorations**

Create a ViewPlugin that iterates syntaxTree(view.state) only across view.visibleRanges. It adds Decoration.mark classes to semantic text and Decoration.replace widgets to closed syntax markers outside the active selection. Recompute on document, selection, focus, and viewport updates.

    for (const { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: node => addMarkdownDecoration(node, view.state.selection),
      });
    }

Export a pure createMarkdownLivePreview factory. It must not touch React or filesystem state.

- [ ] **Step 5: Implement keyboard and slash-command extensions**

Export createMarkdownCommandExtensions with keymap bindings, history bindings, and a completion source that activates only after slash at the start of a block. Support bold, italic, heading, unordered list, ordered list, checklist, link, inline code, code block, quote, divider, date, undo, and redo. Every command inserts valid Markdown, never HTML.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

    bun run test:run -- src/components/notes/editor/markdown-live-preview.test.ts src/components/notes/editor/markdown-editor-commands.test.ts

Expected: all decoration and command tests pass.

- [ ] **Step 7: Commit the CodeMirror foundations**

    git add package.json bun.lock src/components/notes/editor/markdown-live-preview.ts src/components/notes/editor/markdown-live-preview.test.ts src/components/notes/editor/markdown-editor-commands.ts src/components/notes/editor/markdown-editor-commands.test.ts
    git commit -m "feat(notes): add CodeMirror markdown extensions"

### Task 4: Bridge a Stable Imperative EditorView into React

**Files:**
- Create: src/components/notes/editor/MarkdownLiveEditor.tsx
- Create: src/components/notes/editor/MarkdownLiveEditor.test.tsx

- [ ] **Step 1: Write failing component tests**

Render MarkdownLiveEditor with one note body, type Markdown into the actual editor DOM, and assert onChange receives the complete body. Rerender with another note ID and body, assert the new body appears, and assert the host has one cm-editor. Render read-only and assert the state is not editable.

    render(<MarkdownLiveEditor noteId="one" value="- first" onChange={onChange} />);
    await user.type(screen.getByRole("textbox"), " item");
    expect(onChange).toHaveBeenLastCalledWith("- first item");

    rerender(<MarkdownLiveEditor noteId="two" value="- second" onChange={onChange} />);
    expect(container.querySelectorAll(".cm-editor")).toHaveLength(1);

- [ ] **Step 2: Run the component test and verify RED**

Run:

    bun run test:run -- src/components/notes/editor/MarkdownLiveEditor.test.tsx

Expected: module resolution fails because MarkdownLiveEditor does not exist.

- [ ] **Step 3: Implement the imperative bridge**

Create EditorState and EditorView once on the host. Use EditorView.updateListener to call a ref-backed onChange only for docChanged transactions. When noteId or external value changes, dispatch a full-document replacement into the existing view rather than recreating it. Destroy only on component unmount.

    useEffect(() => {
      const view = new EditorView({ state, parent: host.current! });
      viewRef.current = view;
      return () => view.destroy();
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view || view.state.doc.toString() === value) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }, [noteId, value]);

Apply Markdown language support, history, command extensions, live preview decorations, an accessible placeholder, and EditorView.editable.of(!readOnly).

- [ ] **Step 4: Run the component test and verify GREEN**

Run:

    bun run test:run -- src/components/notes/editor/MarkdownLiveEditor.test.tsx

Expected: all lifecycle tests pass without duplicate mounts.

- [ ] **Step 5: Commit the React editor bridge**

    git add src/components/notes/editor/MarkdownLiveEditor.tsx src/components/notes/editor/MarkdownLiveEditor.test.tsx
    git commit -m "feat(notes): add stable CodeMirror editor bridge"

### Task 5: Compose the New Notes Writing Surface

**Files:**
- Modify: src/pages/NotesPage.tsx
- Modify: src/pages/NotesPage.test.tsx
- Modify: src/App.css
- Modify: locales/en.json
- Modify: locales/pt-BR.json

- [ ] **Step 1: Rewrite page tests for the new behavior**

Replace Toast editor mocks with MarkdownLiveEditor behavior. Assert title uses note.title, committing that field calls renameNote without changing note.content, Edit uses CodeMirror, Preview has no editable input, and Split is absent.

    await user.clear(screen.getByRole("textbox", { name: "Note title" }));
    await user.type(screen.getByRole("textbox", { name: "Note title" }), "IHC errors");
    await user.keyboard("{Enter}");

    expect(renameNote).toHaveBeenCalledWith(note.id, "IHC errors");
    expect(useNotesStore.getState().selectedNote()?.content).toBe(
      "- giordano so 1 author"
    );
    expect(screen.queryByRole("button", { name: "Split mode" })).not.toBeInTheDocument();

- [ ] **Step 2: Run page tests and verify RED**

Run:

    bun run test:run -- src/pages/NotesPage.test.tsx

Expected: tests fail because Toast UI owns the current editor, H1 parsing mutates content, and Split is rendered.

- [ ] **Step 3: Remove title/body parsing and Toast editor usage**

Delete parseNoteContent, buildNoteContent, Toast Editor import, editor ref, and split mode. Use note.title in sidebar rows, export paths, title input, and read-only heading. Wire title commit on Enter or blur to renameNote and restore the draft with a localized toast if rename rejects it. Pass note.content directly to CodeMirror and the read-only Viewer.

    <MarkdownLiveEditor
      noteId={note.id}
      value={note.content}
      readOnly={isReadOnly}
      placeholder={t("notes.editor.placeholder")}
      onChange={content => onContentChange(note.id, content)}
    />

Keep Toast UI Viewer as the strict read-only renderer. Do not import or instantiate Toast UI Editor.

- [ ] **Step 4: Add scoped CodeMirror paper styling**

Delete Toast editor overrides no longer used. Add notes-codemirror rules for Axis paper texture, readable measure, restrained focused line, selection, cursor, headings, lists, task markers, hidden Markdown markers, slash-command panel, and reduced motion. Use semantic CSS variables only; do not hard-code Cream Sweet values.

- [ ] **Step 5: Update translations**

Remove Split and WYSIWYG wording. Add English and Brazilian Portuguese strings for CodeMirror Markdown hints and rename failure feedback.

- [ ] **Step 6: Run page tests and verify GREEN**

Run:

    bun run test:run -- src/pages/NotesPage.test.tsx

Expected: all Notes Page tests pass using the new body-only editor contract.

- [ ] **Step 7: Commit the integrated writing surface**

    git add src/pages/NotesPage.tsx src/pages/NotesPage.test.tsx src/App.css locales/en.json locales/pt-BR.json
    git commit -m "feat(notes): replace Toast editor with CodeMirror"

### Task 6: Verify the Complete Contract and Prepare Review

**Files:**
- Modify: docs/developer/notes-architecture.md
- Modify: docs/superpowers/specs/2026-06-19-notes-workspace-evolution-design.md

- [ ] **Step 1: Update architecture documentation**

State that EditorView is imperative and persistent, React never controls the document value on each keystroke, visible syntax-tree ranges receive decorations, and Preview is read-only with no write callback.

- [ ] **Step 2: Run focused test suites**

    bun run test:run -- src/store/notes-store.test.ts src/components/notes/editor/markdown-live-preview.test.ts src/components/notes/editor/markdown-editor-commands.test.ts src/components/notes/editor/MarkdownLiveEditor.test.tsx src/pages/NotesPage.test.tsx
    bun run rust:test -- notes

Expected: all focused TypeScript and Rust tests pass.

- [ ] **Step 3: Run quality gates**

    bun run typecheck
    bun run lint
    bun run ast:lint
    bun run rust:fmt:check
    bun run rust:clippy
    bun run test:run
    bun run check:all

Expected: all gates pass except the known repository-wide format check baseline if it still reports pre-existing unrelated files. Record the exact limitation rather than formatting unrelated files.

- [ ] **Step 4: Inspect the final diff and commit documentation**

    git diff --check main...HEAD

Expected: no whitespace errors.

    git add docs/developer/notes-architecture.md docs/superpowers/specs/2026-06-19-notes-workspace-evolution-design.md
    git commit -m "docs(notes): document CodeMirror title model"

- [ ] **Step 5: Push and open a ready-for-review PR**

    git push -u origin feature/notes-codemirror-live-preview
    gh pr create --base main --head feature/notes-codemirror-live-preview --title "feat(notes): add CodeMirror live preview" --fill

Expected: a non-draft PR exists for CodeRabbit, Qodo, and GitHub review.

