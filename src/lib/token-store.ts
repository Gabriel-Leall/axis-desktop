/**
 * Secure token store wrapper using tauri-plugin-store.
 *
 * Tokens are NEVER stored in SQLite or localStorage — only in the
 * encrypted/OS-managed store provided by tauri-plugin-store.
 *
 * NOTE: tauri-plugin-store must be added to Cargo.toml and package.json
 * before this module can be used.
 */

const TOKEN_STORE_FILE = 'auth.json'

// Lazy-loaded store instance
let _store: import('@tauri-apps/plugin-store').Store | null = null

async function getStore(): Promise<import('@tauri-apps/plugin-store').Store> {
  if (!_store) {
    const { Store } = await import('@tauri-apps/plugin-store')
    _store = await Store.load(TOKEN_STORE_FILE)
  }
  return _store
}

export async function saveToken(key: string, token: string): Promise<void> {
  const store = await getStore()
  await store.set(key, token)
  await store.save()
}

export async function loadToken(key: string): Promise<string | null> {
  try {
    const store = await getStore()
    const value = await store.get<string>(key)
    return value ?? null
  } catch {
    return null
  }
}

export async function deleteToken(key: string): Promise<void> {
  const store = await getStore()
  await store.delete(key)
  await store.save()
}

// Token keys used by OAuth integrations
export const TOKEN_KEYS = {
  GITHUB: 'github_token',
  SLACK: 'slack_token',
  GITHUB_STATE: 'github_oauth_state',
  SLACK_STATE: 'slack_oauth_state',
} as const
