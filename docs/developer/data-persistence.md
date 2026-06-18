# Data Persistence

Patterns for saving and loading data to disk.

## Choosing a Storage Method

| Need               | Solution           | When to Use                                                           |
| ------------------ | ------------------ | --------------------------------------------------------------------- |
| App preferences    | Preferences System | Strongly-typed settings (theme, shortcuts)                            |
| Local notes        | Notes Vault        | User-owned Markdown files in a visible folder                         |
| Emergency recovery | Recovery System    | Crash recovery, backup before risky operations                        |
| Relational data    | SQLite             | User data requiring queries, relationships                            |
| External API data  | TanStack Query     | Remote data with caching (see [external-apis.md](./external-apis.md)) |

```
Need to persist data?
├─ App settings? → Preferences (Rust struct + TanStack Query)
├─ Local notes? → Notes Vault (Documents/Axis Notes by default)
├─ User data with queries/relationships? → SQLite (see below)
├─ Remote API data? → external-apis.md
└─ Emergency/crash recovery? → Recovery System
```

All data goes through Rust for type safety and security. Use TanStack Query on the frontend for loading states and cache invalidation.

## File Locations

```
~/Library/Application Support/com.myapp.app/  (macOS)
├── preferences.json                          # App preferences
└── recovery/                                 # Emergency data
    └── *.json
```

## Atomic Write Pattern (Critical)

All file writes use atomic operations to prevent corruption:

```rust
// Write to temp file first, then rename (atomic)
let temp_path = file_path.with_extension("tmp");
std::fs::write(&temp_path, content)?;
std::fs::rename(&temp_path, &file_path)?;
```

**Why**: If the app crashes during write, you either have the old file or the new file - never a corrupted partial file.

## Preferences System

### Rust Side

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppPreferences {
    pub theme: String,
    // Add new preferences here
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
        }
    }
}
```

### React Side

```typescript
// src/services/preferences.ts
export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: async () => unwrapResult(await commands.loadPreferences()),
  })
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (preferences: AppPreferences) =>
      commands.savePreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
    },
  })
}
```

## Notes Vault

Notes are stored as local Markdown files in a user-visible vault folder.

Default location:

```text
Documents/Axis Notes/
├── inbox/
├── archive/
├── trash/
└── .axis-notes/
    ├── manifest.json
    ├── sidecars/
    ├── cache/
    └── config/
```

Rules:

- The default vault is created automatically on first use.
- The active vault path is persisted in `preferences.json` as `notes_vault_path`.
- If `notes_vault_path` is not set, Axis uses `Documents/Axis Notes`.
- The physical vault contract is defined in `VaultLayout` in `src-tauri/src/commands/notes.rs`; backend code should use that contract instead of duplicating directory names.
- Selecting a different vault path validates and completes the vault structure, but does not move notes from the previous vault.
- `.axis-notes/` is reserved for Axis metadata and must not be indexed as user notes.
- User-authored Markdown remains in note files; Axis-owned structured data belongs under `.axis-notes/`.
- `.axis-notes/manifest.json` records the internal vault metadata schema and is created once, then preserved across later structure checks.
- `.axis-notes/sidecars/` is reserved for per-note structured metadata, `.axis-notes/cache/` for rebuildable derived data, and `.axis-notes/config/` for vault-scoped settings.
- The active notes workspace excludes top-level `archive/` and `trash/` folders from normal list/search results.
- Deleting a note is a reversible lifecycle move into `trash/`, not a permanent file removal.
- Archiving a note moves it into `archive/`; restoring a note from `archive/` or `trash/` moves it back to `inbox/`.
- Lifecycle moves preserve the Markdown file and choose a unique filename in the destination when a collision exists.
- Permanent deletion is intentionally not exposed yet; add it only with explicit UX and retention rules.

All note file operations go through Rust commands in `src-tauri/src/commands/notes.rs`.

Frontend state for the active notes workspace is centralized in
`src/store/notes-store.ts`:

- `vaultInfo` represents the active local vault path exposed by the backend.
- `loadNotes()` loads both the active vault metadata and the active note list.
- `loadWidgetNotes()` is the dashboard widget entrypoint; it always loads the active vault `inbox/`, clears Notes Page filters, and prevents quick-capture widgets from exposing `archive/` or `trash/` notes as editable content.
- `setVaultPath()` and `resetVaultPath()` change the vault through typed Tauri commands, reload active notes, and clear selection/search/tag state so UI surfaces do not mix notes from different vaults.
- Notes Page, Preferences, and widgets should use `useNotesStore` actions instead of calling notes vault commands directly.

## Emergency Recovery System

For saving data before crashes or risky operations:

```typescript
// Save emergency data
await commands.saveEmergencyData({
  filename: 'unsaved-work',
  data: { content: userContent, timestamp: Date.now() },
})

// Load on startup
const recoveryData = await commands.loadEmergencyData({
  filename: 'unsaved-work',
})
if (recoveryData.status === 'ok' && recoveryData.data) {
  // Show recovery dialog
}
```

Recovery files are automatically cleaned up after 7 days via `cleanupOldRecoveryFiles`.

## Adding New Persistent Data

### 1. Define Rust struct

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MyData {
    pub field: String,
}

impl Default for MyData {
    fn default() -> Self {
        Self { field: "default".to_string() }
    }
}
```

### 2. Add Tauri commands

Follow the pattern in `src-tauri/src/commands/preferences.rs`:

- `load_*` command with Default fallback
- `save_*` command with atomic write

### 3. Register commands

Add to `src-tauri/src/bindings.rs` and regenerate bindings:

```bash
bun run rust:bindings
```

### 4. Create React hooks

```typescript
export function useMyData() {
  return useQuery({
    queryKey: ['my-data'],
    queryFn: async () => unwrapResult(await commands.loadMyData()),
  })
}
```

## Security

### Filename Validation

Always validate filenames to prevent path traversal:

```rust
if filename.contains("..") || filename.contains("/") || filename.contains("\\") {
    return Err("Invalid filename".to_string());
}
```

### Directory Permissions

Use Tauri's `app_data_dir()` for safe storage locations - never write to arbitrary paths.

## SQLite Database (When Needed)

> **Note:** SQLite is not installed in this app. Add it when your app needs relational data with queries.

### When to Use SQLite

| Use Case                         | Recommendation     |
| -------------------------------- | ------------------ |
| Simple key-value settings        | Preferences System |
| User data with relationships     | SQLite             |
| Data requiring complex queries   | SQLite             |
| Large datasets (1000+ records)   | SQLite             |
| Data needing atomic transactions | SQLite             |

### Approach Options

| Approach   | Use When                                              |
| ---------- | ----------------------------------------------------- |
| `rusqlite` | Simpler setup, synchronous queries, smaller apps      |
| `sqlx`     | Async queries, compile-time SQL checking, larger apps |

Both integrate with Tauri commands and tauri-specta for type safety.

### Setup (rusqlite)

```bash
cd src-tauri && cargo add rusqlite --features bundled
```

### Architecture Pattern

Tauri commands wrap database operations, TanStack Query provides frontend caching.

```
React Component → TanStack Query → Tauri Command (rusqlite) → SQLite
```

```rust
use rusqlite::{Connection, params};
use std::sync::Mutex;
use tauri::State;

// Database connection managed as Tauri state
pub struct DbConnection(pub Mutex<Connection>);

#[tauri::command]
#[specta::specta]
pub fn get_items(db: State<DbConnection>) -> Result<Vec<Item>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, created_at FROM items ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], |row| {
            Ok(Item {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}
```

Initialize in `src-tauri/src/lib.rs`:

```rust
let db_path = app.path().app_data_dir()?.join("app.db");
let conn = Connection::open(&db_path)?;

// Run migrations
conn.execute(
    "CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )",
    [],
)?;

app.manage(DbConnection(Mutex::new(conn)));
```

```typescript
// Frontend: TanStack Query for caching and loading states
export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => unwrapResult(await commands.getItems()),
  })
}

export function useAddItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: CreateItem) => commands.addItem(item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  })
}
```

### Migration Rules

- Run migrations at app startup before managing database state
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotent migrations
- For complex apps, consider a version table to track applied migrations
