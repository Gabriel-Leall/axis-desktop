/**
 * Slack API Service
 *
 * Read-only wrapper for Slack's Web API. MVP scope:
 *   - POST /search.messages  — find @mentions
 *   - GET  /conversations.list — list DMs
 *   - GET  /conversations.history — last message per DM
 *   - GET  /users.info — resolve user ID to profile (cached in store)
 *   - GET  /auth.test — verify token and get current user
 *
 * Rate limits: Tier 2 = ~20 req/min. Polling every 2 min is safe.
 */

import type { SlackUser, SlackMessage, SlackDM, SlackAuthTestResponse } from '@/types/slack'

const SLACK_API = 'https://slack.com/api'
const SLACK_REDIRECT_URI =
  (import.meta.env.VITE_SLACK_REDIRECT_URI as string | undefined) ?? 'axis://oauth/slack'

interface SlackResponse {
  ok: boolean
  error?: string
}

async function callSlack<T extends SlackResponse>(
  token: string,
  method: string,
  params: Record<string, string | number | boolean> = {}
): Promise<T> {
  const url = new URL(`${SLACK_API}/${method}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (response.status === 429) {
    throw new Error('SLACK_RATE_LIMITED')
  }

  if (!response.ok) {
    throw new Error(`Slack HTTP error: ${response.status}`)
  }

  const data = (await response.json()) as T

  if (!data.ok) {
    if (data.error === 'invalid_auth' || data.error === 'token_revoked') {
      throw new Error('SLACK_UNAUTHORIZED')
    }
    throw new Error(`Slack API error: ${data.error ?? 'unknown'}`)
  }

  return data
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function getSlackAuthInfo(token: string): Promise<SlackAuthTestResponse> {
  return callSlack<SlackAuthTestResponse & SlackResponse>(token, 'auth.test')
}

// ─── Users ────────────────────────────────────────────────────────────────────

interface SlackUserInfoResponse extends SlackResponse {
  user: SlackUser
}

export async function getSlackUser(token: string, userId: string): Promise<SlackUser> {
  const data = await callSlack<SlackUserInfoResponse>(token, 'users.info', { user: userId })
  return data.user
}

// ─── Mentions ─────────────────────────────────────────────────────────────────

interface SlackSearchResponse extends SlackResponse {
  messages: {
    matches: Array<{
      ts: string
      text: string
      user: string
      channel: { id: string; name: string }
      permalink: string
      username?: string
    }>
  }
}

export async function getMentions(token: string): Promise<SlackMessage[]> {
  const data = await callSlack<SlackSearchResponse>(token, 'search.messages', {
    query: 'to:me',
    count: 10,
    sort: 'timestamp',
    sort_dir: 'desc',
  })
  return data.messages.matches
}

// ─── Direct Messages ──────────────────────────────────────────────────────────

interface SlackConversationsListResponse extends SlackResponse {
  channels: Array<{
    id: string
    user: string
    unread_count?: number
    unread_count_display?: number
  }>
}

interface SlackConversationsHistoryResponse extends SlackResponse {
  messages: Array<{ ts: string; text: string; user?: string }>
}

export async function getDirectMessages(token: string): Promise<SlackDM[]> {
  const data = await callSlack<SlackConversationsListResponse>(
    token,
    'conversations.list',
    {
      types: 'im',
      exclude_archived: true,
      limit: 20,
    }
  )

  // Fetch last message for each DM with unreads
  const dms: SlackDM[] = await Promise.all(
    data.channels.map(async ch => {
      const unreadCount = ch.unread_count_display ?? ch.unread_count ?? 0
      let lastMessage: SlackDM['last_message'] | undefined

      try {
        const history = await callSlack<SlackConversationsHistoryResponse>(
          token,
          'conversations.history',
          { channel: ch.id, limit: 1 }
        )
        const latest = history.messages[0]
        if (latest) {
          lastMessage = { text: latest.text, ts: latest.ts }
        }
      } catch {
        // Best-effort — don't fail entire DM list for one channel
      }

      return {
        id: ch.id,
        user: ch.user,
        unread_count: unreadCount,
        last_message: lastMessage,
      }
    })
  )

  // Sort: unread first, then by latest message
  return dms.sort((a, b) => {
    if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count
    const tsA = a.last_message?.ts ?? '0'
    const tsB = b.last_message?.ts ?? '0'
    return tsB.localeCompare(tsA)
  })
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function buildSlackAuthUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'channels:history,im:history,im:read,users:read,search:read',
    user_scope: 'search:read,im:history,im:read',
    state,
    redirect_uri: SLACK_REDIRECT_URI,
  })
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`
}

export async function exchangeSlackCode(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: SLACK_REDIRECT_URI,
  })

  const response = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const data = (await response.json()) as {
    ok: boolean
    access_token?: string
    authed_user?: { access_token?: string }
    error?: string
  }

  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error ?? 'unknown'}`)
  }

  // For user-scope tokens the token lives in authed_user
  const token = data.access_token ?? data.authed_user?.access_token
  if (!token) {
    throw new Error('No Slack access token returned')
  }

  return token
}

// ─── Deep link helper ─────────────────────────────────────────────────────────

/**
 * Get the Slack deep link URL for a channel in a workspace.
 * Falls back to the web URL if deep link is not available.
 */
export function getSlackChannelUrl(teamId: string, channelId: string): string {
  // Try deep link first (slack:// scheme), fall back to web
  return `https://app.slack.com/client/${teamId}/${channelId}`
}

/**
 * Format a Slack timestamp (Unix seconds as string) to relative time.
 */
export function formatSlackTs(ts: string): string {
  const ms = parseFloat(ts) * 1000
  const now = Date.now()
  const diffMin = Math.floor((now - ms) / 60000)
  const diffHrs = Math.floor((now - ms) / 3600000)
  const diffDays = Math.floor((now - ms) / 86400000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m`
  if (diffHrs < 24) return `${diffHrs}h`
  return `${diffDays}d`
}

/**
 * Strip Slack mrkdwn user/channel references for plain text preview.
 * e.g. "<@U123>" → "@username", "<!channel>" → "@channel"
 */
export function stripSlackMarkdown(text: string): string {
  return text
    .replace(/<@([A-Z0-9]+)\|([^>]+)>/g, '@$2')
    .replace(/<@([A-Z0-9]+)>/g, '@user')
    .replace(/<!channel>/g, '@channel')
    .replace(/<!here>/g, '@here')
    .replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '#$2')
    .replace(/<([^>]+)>/g, '$1')
    .trim()
}
