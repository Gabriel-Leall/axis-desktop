/**
 * Slack Zustand Store
 *
 * Manages authentication state and cached Slack data.
 * Polling interval: 2 minutes (120 000ms).
 *
 * Configure via VITE_SLACK_CLIENT_ID and VITE_SLACK_CLIENT_SECRET.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { openUrl } from '@tauri-apps/plugin-opener'
import { logger } from '@/lib/logger'
import {
  getSlackAuthInfo,
  getSlackUser,
  getMentions,
  getDirectMessages,
  buildSlackAuthUrl,
  exchangeSlackCode,
} from '@/services/slack-api'
import { saveToken, loadToken, deleteToken, TOKEN_KEYS } from '@/lib/token-store'
import type { SlackUser, SlackMessage, SlackDM } from '@/types/slack'

const POLL_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes
const RATE_LIMIT_BACKOFF_MS = 60 * 1000 // 1 minute

const SLACK_CLIENT_ID = import.meta.env.VITE_SLACK_CLIENT_ID as string | undefined
const SLACK_CLIENT_SECRET = import.meta.env.VITE_SLACK_CLIENT_SECRET as string | undefined

interface SlackStoreState {
  isAuthenticated: boolean
  token: string | null
  user: SlackUser | null
  teamName: string | null
  teamId: string | null
  mentions: SlackMessage[]
  directMessages: SlackDM[]
  usersCache: Record<string, SlackUser>
  isLoading: boolean
  isLoadingMentions: boolean
  isLoadingDMs: boolean
  lastUpdated: Date | null
  error: string | null

  // Actions
  initialize: () => Promise<void>
  startOAuthFlow: () => Promise<void>
  handleOAuthCallback: (code: string, state: string | null) => Promise<void>
  refresh: () => Promise<void>
  logout: () => Promise<void>
  resolveUser: (userId: string) => Promise<SlackUser | null>
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let rateLimitTimer: ReturnType<typeof setTimeout> | null = null
let isPollBlocked = false

function clearPollTimer() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export const useSlackStore = create<SlackStoreState>()(
  devtools(
    (set, get) => ({
      isAuthenticated: false,
      token: null,
      user: null,
      teamName: null,
      teamId: null,
      mentions: [],
      directMessages: [],
      usersCache: {},
      isLoading: false,
      isLoadingMentions: false,
      isLoadingDMs: false,
      lastUpdated: null,
      error: null,

      initialize: async () => {
        const token = await loadToken(TOKEN_KEYS.SLACK)
        if (!token) return

        set({ token, isAuthenticated: true, isLoading: true }, undefined, 'slack/init/start')

        try {
          const auth = await getSlackAuthInfo(token)
          // Fetch full user profile
          const user = await getSlackUser(token, auth.user_id)
          set(
            { user, teamName: auth.team, teamId: auth.team_id, isLoading: false },
            undefined,
            'slack/init/user-loaded'
          )
          await get().refresh()
          startPolling(get)
        } catch (err) {
          const msg = String(err)
          if (msg.includes('SLACK_UNAUTHORIZED')) {
            await get().logout()
          } else {
            logger.error(`Slack initialize error: ${msg}`)
            set({ isLoading: false, error: msg }, undefined, 'slack/init/error')
          }
        }
      },

      startOAuthFlow: async () => {
        if (!SLACK_CLIENT_ID) {
          set(
            { error: 'VITE_SLACK_CLIENT_ID not configured' },
            undefined,
            'slack/oauth/no-client-id'
          )
          return
        }

        const state = crypto.randomUUID()
        await saveToken(TOKEN_KEYS.SLACK_STATE, state)
        const url = buildSlackAuthUrl(SLACK_CLIENT_ID, state)

        try {
          await openUrl(url)
        } catch (err) {
          logger.error(`Failed to open Slack OAuth URL: ${String(err)}`)
        }
      },

      handleOAuthCallback: async (code, incomingState) => {
        if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
          set(
            { error: 'Slack OAuth credentials not configured' },
            undefined,
            'slack/oauth/no-credentials'
          )
          return
        }

        // CSRF check
        const savedState = await loadToken(TOKEN_KEYS.SLACK_STATE)
        if (!incomingState || savedState !== incomingState) {
          logger.error('Slack OAuth: state mismatch — possible CSRF attack')
          set({ error: 'Slack OAuth state mismatch' }, undefined, 'slack/oauth/state-mismatch')
          return
        }
        await deleteToken(TOKEN_KEYS.SLACK_STATE)

        set({ isLoading: true, error: null }, undefined, 'slack/oauth/exchanging')

        try {
          const token = await exchangeSlackCode(SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, code)
          await saveToken(TOKEN_KEYS.SLACK, token)

          const auth = await getSlackAuthInfo(token)
          const user = await getSlackUser(token, auth.user_id)

          set(
            {
              token,
              isAuthenticated: true,
              user,
              teamName: auth.team,
              teamId: auth.team_id,
              isLoading: false,
            },
            undefined,
            'slack/oauth/done'
          )
          await get().refresh()
          startPolling(get)
        } catch (err) {
          logger.error(`Slack OAuth callback error: ${String(err)}`)
          set(
            { isLoading: false, error: String(err) },
            undefined,
            'slack/oauth/error'
          )
        }
      },

      refresh: async () => {
        if (isPollBlocked) return
        const { token } = get()
        if (!token) return

        set(
          { isLoadingMentions: true, isLoadingDMs: true, error: null },
          undefined,
          'slack/refresh/start'
        )

        const results = await Promise.allSettled([
          getMentions(token),
          getDirectMessages(token),
        ])

        const [mentionsResult, dmsResult] = results

        if (mentionsResult.status === 'fulfilled') {
          set(
            { mentions: mentionsResult.value, isLoadingMentions: false },
            undefined,
            'slack/refresh/mentions'
          )
        } else {
          handleFetchError(mentionsResult.reason, 'mentions', set, get)
        }

        if (dmsResult.status === 'fulfilled') {
          set(
            { directMessages: dmsResult.value, isLoadingDMs: false },
            undefined,
            'slack/refresh/dms'
          )
        } else {
          handleFetchError(dmsResult.reason, 'dms', set, get)
        }

        set({ lastUpdated: new Date() }, undefined, 'slack/refresh/done')
      },

      logout: async () => {
        clearPollTimer()
        await deleteToken(TOKEN_KEYS.SLACK)
        set(
          {
            isAuthenticated: false,
            token: null,
            user: null,
            teamName: null,
            teamId: null,
            mentions: [],
            directMessages: [],
            usersCache: {},
            isLoading: false,
            lastUpdated: null,
            error: null,
          },
          undefined,
          'slack/logout'
        )
      },

      resolveUser: async (userId: string): Promise<SlackUser | null> => {
        const cached = get().usersCache[userId]
        if (cached) return cached

        const { token } = get()
        if (!token) return null

        try {
          const user = await getSlackUser(token, userId)
          set(
            state => ({ usersCache: { ...state.usersCache, [userId]: user } }),
            undefined,
            'slack/resolveUser'
          )
          return user
        } catch (err) {
          logger.warn(`Failed to resolve Slack user ${userId}: ${String(err)}`)
          return null
        }
      },
    }),
    { name: 'slack-store' }
  )
)

// ─── Private helpers ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetFn = (partial: Partial<SlackStoreState>, replace?: any, name?: string) => void
type GetFn = () => SlackStoreState

function handleFetchError(
  error: unknown,
  section: string,
  set: SetFn,
  get: GetFn
) {
  const msg = String(error)
  logger.error(`Slack ${section} fetch error: ${msg}`)

  if (msg.includes('SLACK_UNAUTHORIZED')) {
    void get().logout()
    return
  }

  if (msg.includes('SLACK_RATE_LIMITED')) {
    isPollBlocked = true
    rateLimitTimer = setTimeout(() => {
      isPollBlocked = false
    }, RATE_LIMIT_BACKOFF_MS)
  }

  const loadingKey = section === 'mentions' ? 'isLoadingMentions' : 'isLoadingDMs'
  set({ [loadingKey]: false, error: msg } as Partial<SlackStoreState>, undefined, `slack/${section}/error`)
}

function startPolling(get: GetFn) {
  clearPollTimer()
  pollTimer = setInterval(() => {
    if (get().isAuthenticated) {
      void get().refresh()
    } else {
      clearPollTimer()
    }
  }, POLL_INTERVAL_MS)
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearPollTimer()
    if (rateLimitTimer) clearTimeout(rateLimitTimer)
  })
}
