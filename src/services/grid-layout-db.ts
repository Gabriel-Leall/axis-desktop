/**
 * Grid Layout persistence via tauri-plugin-sql (SQLite).
 *
 * Stores the bento grid layout and widget visibility in a local SQLite database.
 * The DB file (`grid_layout.db`) is created automatically in the app data directory.
 */

import Database from '@tauri-apps/plugin-sql'
import { logger } from '@/lib/logger'
import type { LayoutItem } from 'react-grid-layout'

const DB_NAME = 'sqlite:grid_layout.db'

let dbInstance: Database | null = null

/**
 * Gets or creates the database connection, ensuring the schema exists.
 */
async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance

  const db = await Database.load(DB_NAME)

  // Create the table if it doesn't exist
  await db.execute(`
    CREATE TABLE IF NOT EXISTS grid_layout (
      id TEXT PRIMARY KEY DEFAULT 'default',
      layout_json TEXT NOT NULL DEFAULT '[]',
      widget_visibility TEXT NOT NULL DEFAULT '{}'
    )
  `)

  dbInstance = db
  return db
}

/** Persisted data shape */
export interface GridLayoutData {
  layoutJson: string
  widgetVisibility: string
}

/**
 * Saves the grid layout and widget visibility to SQLite.
 */
export async function saveGridLayout(
  layout: LayoutItem[],
  widgetVisibility: Record<string, boolean>
): Promise<void> {
  try {
    const db = await getDb()
    const layoutJson = JSON.stringify(layout)
    const visibilityJson = JSON.stringify(widgetVisibility)

    await db.execute(
      `INSERT INTO grid_layout (id, layout_json, widget_visibility)
       VALUES ('default', $1, $2)
       ON CONFLICT(id) DO UPDATE SET
         layout_json = excluded.layout_json,
         widget_visibility = excluded.widget_visibility`,
      [layoutJson, visibilityJson]
    )

    logger.debug('Grid layout saved to SQLite')
  } catch (error) {
    logger.error(`Failed to save grid layout: ${String(error)}`)
  }
}

/**
 * Loads the grid layout and widget visibility from SQLite.
 * Returns null if no saved layout exists.
 */
export async function loadGridLayout(): Promise<GridLayoutData | null> {
  try {
    const db = await getDb()

    const rows = await db.select<
      Array<{ layout_json: string; widget_visibility: string }>
    >('SELECT layout_json, widget_visibility FROM grid_layout WHERE id = $1', [
      'default',
    ])

    if (rows.length === 0) {
      logger.info('No saved grid layout found, will use defaults')
      return null
    }

    const row = rows[0]
    if (!row) return null

    return {
      layoutJson: row.layout_json,
      widgetVisibility: row.widget_visibility,
    }
  } catch (error) {
    logger.warn(`Failed to load grid layout: ${String(error)}`)
    return null
  }
}
