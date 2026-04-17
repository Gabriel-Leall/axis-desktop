# GitHub & Slack Integrations

This document covers how to set up the OAuth apps required for the GitHub and Slack integrations in Axis Desktop.

---

## Prerequisites — Install Required Plugins

Before using these integrations, two Tauri plugins must be installed:

### 1. `tauri-plugin-store` (secure token storage)

**Cargo.toml** (`src-tauri/Cargo.toml`):
```toml
tauri-plugin-store = "2"
```

**package.json**:
```bash
bun add @tauri-apps/plugin-store
```

Register in `src-tauri/src/lib.rs`:
```rust
.plugin(tauri_plugin_store::Builder::new().build())
```

### 2. `tauri-plugin-deep-link` (OAuth callback URL interception)

**Cargo.toml**:
```toml
tauri-plugin-deep-link = "2"
```

**package.json**:
```bash
bun add @tauri-apps/plugin-deep-link
```

Register in `src-tauri/src/lib.rs`:
```rust
.plugin(tauri_plugin_deep_link::init())
```

Add to `src-tauri/capabilities/default.json`:
```json
"deep-link:default"
```

The `axis://` scheme is already configured in `tauri.conf.json`.

---

## Part 1 — GitHub OAuth App

### Create the OAuth App

1. Go to **github.com/settings/developer** → **OAuth Apps** → **New OAuth App**
2. Fill in:
   - **Application name**: `Axis Desktop` (or any name you prefer)
   - **Homepage URL**: `https://github.com/Gabriel-Leall/axis-desktop`
   - **Authorization callback URL**: `axis://oauth/github`
3. Click **Register application**
4. On the app page, click **Generate a new client secret**
5. Save the **Client ID** and **Client Secret**

### Configure Environment Variables

Create a `.env.local` file in the project root (already in `.gitignore`):

```env
VITE_GITHUB_CLIENT_ID=your_github_client_id_here
VITE_GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

> **Security note**: In a desktop app, the client secret is accessible by the user (who controls the binary). This is an accepted MVP trade-off. For production, proxy the token exchange through a backend.

### Required Scopes

| Scope | Purpose |
|-------|---------|
| `repo` | Access pull requests and issues |
| `read:user` | Get authenticated user profile |

### What the Widget Shows

- **Review Requests** — PRs in any repo waiting for your review
- **My Open PRs** — PRs you authored that are still open
- **Assigned Issues** — Issues assigned to you

All links open in your default browser via `tauri-plugin-opener`.

### Polling

Data refreshes every **5 minutes**. If the API returns HTTP 429 (rate limited), polling pauses for **60 seconds**.

---

## Part 2 — Slack OAuth App

### Create the OAuth App

1. Go to **api.slack.com/apps** → **Create New App** → **From scratch**
2. Name it `Axis Desktop` and choose your development workspace
3. In the left sidebar, go to **OAuth & Permissions**
4. Under **Redirect URLs**, add an **HTTPS** callback URL (Slack requires HTTPS), for example:
   - `https://gabriel-leall.github.io/axis-desktop/oauth/slack-callback.html`
5. Under **Bot Token Scopes**, add:
   - `channels:history`
   - `im:history`
   - `im:read`
   - `users:read`
   - `search:read`
6. Under **User Token Scopes**, add:
   - `search:read`
   - `im:history`
   - `im:read`
7. Go to **Basic Information** and save the **Client ID** and **Client Secret**

### Configure Environment Variables

Add to `.env.local`:

```env
VITE_SLACK_CLIENT_ID=your_slack_client_id_here
VITE_SLACK_CLIENT_SECRET=your_slack_client_secret_here
VITE_SLACK_REDIRECT_URI=https://gabriel-leall.github.io/axis-desktop/oauth/slack-callback.html
```

> Slack's OAuth redirect URI must be HTTPS. Axis uses a small HTTPS callback bridge page that
> immediately redirects to `axis://oauth/slack?code=...&state=...` so the desktop app can
> finish the OAuth flow via deep link.

### What the Widget Shows

- **Mentions** — Messages where you were mentioned (`@username`)
- **Unread DMs** — Direct messages with unread counts

Clicking any item opens `https://app.slack.com/client/{teamId}/{channelId}` in your default browser.

### Polling

Data refreshes every **2 minutes**. If the API returns HTTP 429, polling pauses for **60 seconds**.

### User Resolution

Slack returns user IDs instead of names. The Slack store caches resolved `userId → SlackUser` mappings to avoid repeated API calls (N+1 prevention).

---

## Token Storage

Both integrations store tokens exclusively via `tauri-plugin-store` in `auth.json`:

| Store Key | Value |
|-----------|-------|
| `github_token` | GitHub access token |
| `slack_token` | Slack user access token |
| `github_oauth_state` | CSRF state (temporary) |
| `slack_oauth_state` | CSRF state (temporary) |

**Never** use `localStorage`, `sessionStorage`, or SQLite for OAuth tokens.

---

## Architecture Notes

### OAuth Flow (both integrations)

```
1. User clicks "Connect"
2. Store generates random state (CSRF token), saves to auth.json
3. Opens OAuth URL in system browser via tauri-plugin-opener
4. User authenticates in provider page
5. GitHub redirects directly to `axis://oauth/github`
6. Slack redirects to HTTPS callback bridge, which forwards to `axis://oauth/slack`
7. tauri-plugin-deep-link intercepts the URL
8. oauth-handler.ts dispatches to the correct store
9. Store validates state, exchanges code for token
10. Token saved to auth.json via tauri-plugin-store
11. Store fetches initial data
```

### Files

| File | Purpose |
|------|---------|
| `src/types/github.ts` | TypeScript types |
| `src/types/slack.ts` | TypeScript types |
| `src/services/github-api.ts` | API calls, OAuth helpers |
| `src/services/slack-api.ts` | API calls, OAuth helpers |
| `src/store/github-store.ts` | Zustand store, polling |
| `src/store/slack-store.ts` | Zustand store, polling |
| `src/components/grid/widgets/GitHubWidget.tsx` | Bento grid widget |
| `src/components/grid/widgets/SlackWidget.tsx` | Bento grid widget |
| `src/pages/GitHubPage.tsx` | Full page view |
| `src/pages/SlackPage.tsx` | Full page view |
| `src/lib/token-store.ts` | Secure token CRUD |
| `src/lib/oauth-handler.ts` | Deep link dispatcher |

---

## Development Testing Without OAuth

During development, you can manually inject a token into the store's state without going through the OAuth flow:

```typescript
// In browser console (Tauri webview devtools)
import { useGitHubStore } from './store/github-store'
useGitHubStore.setState({ 
  isAuthenticated: true, 
  token: 'ghp_your_personal_access_token'
})
useGitHubStore.getState().refresh()
```

Use a **GitHub Personal Access Token** (PAT) with `repo` and `read:user` scopes for testing.
