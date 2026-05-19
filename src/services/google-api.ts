import type { GoogleTokenResponse, GoogleUser } from '@/types/google'

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_ENDPOINT =
  'https://openidconnect.googleapis.com/v1/userinfo'

export const GOOGLE_LOGIN_SCOPES = ['openid', 'email', 'profile'] as const

function base64UrlEncode(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function createCodeVerifier(): string {
  const randomBytes = new Uint8Array(64)
  crypto.getRandomValues(randomBytes)
  return base64UrlEncode(randomBytes.buffer)
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return base64UrlEncode(digest)
}

export async function exchangeGoogleCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = (await response.json()) as GoogleTokenResponse

  if (!response.ok || data.error || !data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        `Google token exchange failed: ${response.status}`
    )
  }

  return data
}

export async function refreshGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = (await response.json()) as GoogleTokenResponse

  if (!response.ok || data.error || !data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        `Google token refresh failed: ${response.status}`
    )
  }

  return data
}

export async function getGoogleUser(accessToken: string): Promise<GoogleUser> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Google userinfo failed: ${response.status}`)
  }

  return (await response.json()) as GoogleUser
}
