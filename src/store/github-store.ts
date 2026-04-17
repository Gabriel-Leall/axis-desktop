/**
 * GitHub Zustand Store
 *
 * Manages authentication state and cached GitHub data.
 * Polling interval: 5 minutes (300 000ms).
 *
 * OAuth credentials must be set via environment variables or a config file.
 * For the MVP, set VITE_GITHUB_CLIENT_ID and VITE_GITHUB_CLIENT_SECRET.
 *
 * IMPORTANT: Client secret in a desktop app is an accepted trade-off for MVP.
 * The user controls the binary. For production, proxy the token exchange
 * through a backend.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { openUrl } from '@tauri-apps/plugin-opener'
import { logger } from '@/lib/logger'
import {
  getAuthenticatedUser,
  getReviewRequests,
  getMyOpenPRs,
  getAssignedIssues,
  buildGitHubAuthUrl,
  exchangeCodeForToken,
} from '@/services/github-api'
import { saveToken, loadToken, deleteToken, TOKEN_KEYS } from '@/lib/token-store'
import type { GitHubUser, PullRequest, GitHubIssue } from '@/types/github'

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const RATE_LIMIT_BACKOFF_MS = 60 * 1000 // 1 minute

// Read from Vite env — user must configure these in their .env.local
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined
const GITHUB_CLIENT_SECRET = import.meta.env.VITE_GITHUB_CLIENT_SECRET as string | undefined

interface GitHubStoreState {
  isAuthenticated: boolean
  token: string | null
  user: GitHubUser | null
  reviewRequests: PullRequest[]
  myPRs: PullRequest[]
  assignedIssues: GitHubIssue[]
  isLoading: boolean
  isLoadingReviews: boolean
  isLoadingMyPRs: boolean
  isLoadingIssues: boolean
  lastUpdated: Date | null
  error: string | null

  // Actions
  initialize: () => Promise<void>
  startOAuthFlow: () => Promise<void>
  handleOAuthCallback: (code: string, state: string | null) => Promise<void>
  refresh: () => Promise<void>
  logout: () => Promise<void>
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

export const useGitHubStore = create<GitHubStoreState>()(
  devtools(
    (set, get) => ({
      isAuthenticated: false,
      token: null,
      user: null,
      reviewRequests: [],
      myPRs: [],
      assignedIssues: [],
      isLoading: false,
      isLoadingReviews: false,
      isLoadingMyPRs: false,
      isLoadingIssues: false,
      lastUpdated: null,
      error: null,

      initialize: async () => {
        const token = await loadToken(TOKEN_KEYS.GITHUB)
        if (!token) return

        set({ token, isAuthenticated: true, isLoading: true }, undefined, 'github/init/start')

        try {
          const user = await getAuthenticatedUser(token)
          set({ user }, undefined, 'github/init/user-loaded')
          await get().refresh()
          startPolling(get)
        } catch (err) {
          const msg = String(err)
          if (msg.includes('GITHUB_UNAUTHORIZED')) {
            await get().logout()
          } else {
            logger.error(`GitHub initialize error: ${msg}`)
            set({ isLoading: false, error: msg }, undefined, 'github/init/error')
          }
        }
      },

      startOAuthFlow: async () => {
        if (!GITHUB_CLIENT_ID) {
          set(
            { error: 'VITE_GITHUB_CLIENT_ID not configured' },
            undefined,
            'github/oauth/no-client-id'
          )
          return
        }

        const state = crypto.randomUUID()
        await saveToken(TOKEN_KEYS.GITHUB_STATE, state)
        const url = buildGitHubAuthUrl(GITHUB_CLIENT_ID, state)

        try {
          await openUrl(url)
        } catch (err) {
          logger.error(`Failed to open GitHub OAuth URL: ${String(err)}`)
        }
      },

      handleOAuthCallback: async (code, incomingState) => {
        if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
          set(
            { error: 'GitHub OAuth credentials not configured' },
            undefined,
            'github/oauth/no-credentials'
          )
          return
        }

        // CSRF check
        if (incomingState) {
          const savedState = await loadToken(TOKEN_KEYS.GITHUB_STATE)
          if (savedState !== incomingState) {
            logger.error('GitHub OAuth: state mismatch — possible CSRF attack')
            return
          }
          await deleteToken(TOKEN_KEYS.GITHUB_STATE)
        }

        set({ isLoading: true, error: null }, undefined, 'github/oauth/exchanging')

        try {
          const token = await exchangeCodeForToken(
            GITHUB_CLIENT_ID,
            GITHUB_CLIENT_SECRET,
            code
          )
          await saveToken(TOKEN_KEYS.GITHUB, token)

          const user = await getAuthenticatedUser(token)
          set(
            { token, isAuthenticated: true, user, isLoading: false },
            undefined,
            'github/oauth/done'
          )
          await get().refresh()
          startPolling(get)
        } catch (err) {
          logger.error(`GitHub OAuth callback error: ${String(err)}`)
          set(
            { isLoading: false, error: String(err) },
            undefined,
            'github/oauth/error'
          )
        }
      },

      refresh: async () => {
        if (isPollBlocked) return
        const { token } = get()
        if (!token) return

        // Parallel section loads — each has its own loading flag
        set(
          { isLoadingReviews: true, isLoadingMyPRs: true, isLoadingIssues: true, error: null },
          undefined,
          'github/refresh/start'
        )

        const results = await Promise.allSettled([
          getReviewRequests(token),
          getMyOpenPRs(token),
          getAssignedIssues(token),
        ])

        const [reviewsResult, myPRsResult, issuesResult] = results

        if (reviewsResult.status === 'fulfilled') {
          set(
            { reviewRequests: reviewsResult.value, isLoadingReviews: false },
            undefined,
            'github/refresh/reviews'
          )
        } else {
          handleFetchError(reviewsResult.reason, 'reviews', set, get)
        }

        if (myPRsResult.status === 'fulfilled') {
          set(
            { myPRs: myPRsResult.value, isLoadingMyPRs: false },
            undefined,
            'github/refresh/myPRs'
          )
        } else {
          handleFetchError(myPRsResult.reason, 'myPRs', set, get)
        }

        if (issuesResult.status === 'fulfilled') {
          set(
            { assignedIssues: issuesResult.value, isLoadingIssues: false },
            undefined,
            'github/refresh/issues'
          )
        } else {
          handleFetchError(issuesResult.reason, 'issues', set, get)
        }

        set({ lastUpdated: new Date(), isLoading: false }, undefined, 'github/refresh/done')
      },

      logout: async () => {
        clearPollTimer()
        await deleteToken(TOKEN_KEYS.GITHUB)
        set(
          {
            isAuthenticated: false,
            token: null,
            user: null,
            reviewRequests: [],
            myPRs: [],
            assignedIssues: [],
            isLoading: false,
            lastUpdated: null,
            error: null,
          },
          undefined,
          'github/logout'
        )
      },
    }),
    { name: 'github-store' }
  )
)

// ─── Private helpers ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetFn = (partial: Partial<GitHubStoreState>, replace?: any, name?: string) => void
type GetFn = () => GitHubStoreState

function handleFetchError(
  error: unknown,
  section: string,
  set: SetFn,
  get: GetFn
) {
  const msg = String(error)
  logger.error(`GitHub ${section} fetch error: ${msg}`)

  if (msg.includes('GITHUB_UNAUTHORIZED')) {
    void get().logout()
    return
  }

  if (msg.includes('GITHUB_RATE_LIMITED')) {
    isPollBlocked = true
    rateLimitTimer = setTimeout(() => {
      isPollBlocked = false
    }, RATE_LIMIT_BACKOFF_MS)
  }

  const loadingKey =
    section === 'reviews'
      ? 'isLoadingReviews'
      : section === 'myPRs'
        ? 'isLoadingMyPRs'
        : 'isLoadingIssues'

  set({ [loadingKey]: false, error: msg } as Partial<GitHubStoreState>, undefined, `github/${section}/error`)
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

// Cleanup on HMR in dev
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearPollTimer()
    if (rateLimitTimer) clearTimeout(rateLimitTimer)
  })
}
