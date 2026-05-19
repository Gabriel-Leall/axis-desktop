import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { logger } from '@/lib/logger'
import { commands } from '@/lib/tauri-bindings'
import {
  createCodeChallenge,
  createCodeVerifier,
  exchangeGoogleCodeForToken,
  getGoogleUser,
  GOOGLE_LOGIN_SCOPES,
  refreshGoogleAccessToken,
} from '@/services/google-api'
import {
  deleteToken,
  loadToken,
  saveToken,
  TOKEN_KEYS,
} from '@/lib/token-store'
import type { GoogleUser } from '@/types/google'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as
  | string
  | undefined

interface GoogleStoreState {
  isAuthenticated: boolean
  token: string | null
  user: GoogleUser | null
  isLoading: boolean
  error: string | null

  initialize: () => Promise<void>
  startOAuthFlow: () => Promise<void>
  logout: () => Promise<void>
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export const useGoogleStore = create<GoogleStoreState>()(
  devtools(
    (set, get) => ({
      isAuthenticated: false,
      token: null,
      user: null,
      isLoading: false,
      error: null,

      initialize: async () => {
        const token = await loadToken(TOKEN_KEYS.GOOGLE)
        if (!token) return

        set(
          { token, isAuthenticated: true, isLoading: true, error: null },
          undefined,
          'google/init/start'
        )

        try {
          const user = await getGoogleUser(token)
          set({ user, isLoading: false }, undefined, 'google/init/done')
        } catch (error) {
          logger.warn('Google access token is no longer valid', { error })

          const refreshToken = await loadToken(TOKEN_KEYS.GOOGLE_REFRESH)
          if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !refreshToken) {
            await get().logout()
            return
          }

          try {
            const refreshed = await refreshGoogleAccessToken(
              GOOGLE_CLIENT_ID,
              GOOGLE_CLIENT_SECRET,
              refreshToken
            )
            await saveToken(TOKEN_KEYS.GOOGLE, refreshed.access_token ?? '')
            const user = await getGoogleUser(refreshed.access_token ?? '')
            set(
              {
                token: refreshed.access_token ?? null,
                isAuthenticated: true,
                user,
                isLoading: false,
                error: null,
              },
              undefined,
              'google/init/refreshed'
            )
          } catch (refreshError) {
            logger.warn('Google refresh token is no longer valid', {
              error: refreshError,
            })
            await get().logout()
          }
        }
      },

      startOAuthFlow: async () => {
        if (!GOOGLE_CLIENT_ID) {
          set(
            { error: 'VITE_GOOGLE_CLIENT_ID not configured' },
            undefined,
            'google/oauth/no-client-id'
          )
          return
        }

        if (!GOOGLE_CLIENT_SECRET) {
          set(
            { error: 'VITE_GOOGLE_CLIENT_SECRET not configured' },
            undefined,
            'google/oauth/no-client-secret'
          )
          return
        }

        set({ isLoading: true, error: null }, undefined, 'google/oauth/start')

        try {
          const state = crypto.randomUUID()
          const codeVerifier = createCodeVerifier()
          const codeChallenge = await createCodeChallenge(codeVerifier)

          await saveToken(TOKEN_KEYS.GOOGLE_STATE, state)
          await saveToken(TOKEN_KEYS.GOOGLE_CODE_VERIFIER, codeVerifier)

          const result = await commands.startGoogleOauthLoopback(
            GOOGLE_CLIENT_ID,
            GOOGLE_LOGIN_SCOPES.join(' '),
            state,
            codeChallenge
          )

          if (result.status === 'error') {
            set(
              { isLoading: false, error: result.error },
              undefined,
              'google/oauth/loopback-error'
            )
            return
          }

          const savedState = await loadToken(TOKEN_KEYS.GOOGLE_STATE)
          if (!result.data.state || result.data.state !== savedState) {
            set(
              { isLoading: false, error: 'Google OAuth state mismatch' },
              undefined,
              'google/oauth/state-mismatch'
            )
            return
          }

          const savedVerifier = await loadToken(TOKEN_KEYS.GOOGLE_CODE_VERIFIER)
          if (!savedVerifier) {
            set(
              { isLoading: false, error: 'Google OAuth code verifier missing' },
              undefined,
              'google/oauth/verifier-missing'
            )
            return
          }

          const tokenResponse = await exchangeGoogleCodeForToken(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            result.data.code,
            savedVerifier,
            result.data.redirect_uri
          )

          await saveToken(TOKEN_KEYS.GOOGLE, tokenResponse.access_token ?? '')
          if (tokenResponse.refresh_token) {
            await saveToken(
              TOKEN_KEYS.GOOGLE_REFRESH,
              tokenResponse.refresh_token
            )
          }
          await deleteToken(TOKEN_KEYS.GOOGLE_STATE)
          await deleteToken(TOKEN_KEYS.GOOGLE_CODE_VERIFIER)

          const user = await getGoogleUser(tokenResponse.access_token ?? '')
          set(
            {
              token: tokenResponse.access_token ?? null,
              isAuthenticated: true,
              user,
              isLoading: false,
              error: null,
            },
            undefined,
            'google/oauth/done'
          )
        } catch (error) {
          const message = getErrorMessage(error)
          logger.error('Google OAuth callback error', { error: message })
          set(
            { isLoading: false, error: message },
            undefined,
            'google/oauth/error'
          )
        }
      },

      logout: async () => {
        await deleteToken(TOKEN_KEYS.GOOGLE)
        await deleteToken(TOKEN_KEYS.GOOGLE_REFRESH)
        await deleteToken(TOKEN_KEYS.GOOGLE_STATE)
        await deleteToken(TOKEN_KEYS.GOOGLE_CODE_VERIFIER)
        set(
          {
            isAuthenticated: false,
            token: null,
            user: null,
            isLoading: false,
            error: null,
          },
          undefined,
          'google/logout'
        )
      },
    }),
    { name: 'google-store' }
  )
)
