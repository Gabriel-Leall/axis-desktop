/**
 * GitHub API Service
 *
 * All requests go through tauri-plugin-http (fetch wrapper compatible with
 * Tauri's CSP). Typed against the GitHub REST API v3.
 *
 * Endpoints used (read-only, GET/POST search only):
 *   GET /user
 *   GET /search/issues?q=is:pr+is:open+review-requested:@me
 *   GET /search/issues?q=is:pr+is:open+author:@me
 *   GET /issues?filter=assigned&state=open
 *
 * Rate limits: 5000 req/h with token. Polling every 5 min = 12 req/h per endpoint.
 */

import type {
  GitHubUser,
  PullRequest,
  GitHubIssue,
  GitHubSearchResult,
} from '@/types/github'

const GITHUB_API = 'https://api.github.com'

function getHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function fetchGitHub<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: getHeaders(token),
  })

  if (response.status === 401) {
    throw new Error('GITHUB_UNAUTHORIZED')
  }

  if (response.status === 429) {
    throw new Error('GITHUB_RATE_LIMITED')
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`
    )
  }

  return response.json() as Promise<T>
}

export async function getAuthenticatedUser(token: string): Promise<GitHubUser> {
  return fetchGitHub<GitHubUser>(token, '/user')
}

export async function getReviewRequests(token: string): Promise<PullRequest[]> {
  const result = await fetchGitHub<GitHubSearchResult<PullRequest>>(
    token,
    '/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10&sort=updated'
  )
  return result.items
}

export async function getMyOpenPRs(token: string): Promise<PullRequest[]> {
  const result = await fetchGitHub<GitHubSearchResult<PullRequest>>(
    token,
    '/search/issues?q=is:pr+is:open+author:@me&per_page=10&sort=updated'
  )
  return result.items
}

export async function getAssignedIssues(token: string): Promise<GitHubIssue[]> {
  return fetchGitHub<GitHubIssue[]>(
    token,
    '/issues?filter=assigned&state=open&per_page=20&sort=updated'
  )
}

/**
 * Extract the repository name (owner/repo) from a GitHub API repository URL.
 * Example: "https://api.github.com/repos/owner/repo" → "owner/repo"
 */
export function extractRepoName(repositoryUrl: string): string {
  return repositoryUrl.replace('https://api.github.com/repos/', '')
}

/**
 * Format a relative timestamp like "2h ago", "3d ago"
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

/**
 * Build the GitHub OAuth authorization URL
 */
export function buildGitHubAuthUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'repo,read:user',
    state,
    redirect_uri: 'axis://oauth/github',
  })
  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

/**
 * Exchange an authorization code for an access token.
 * NOTE: In production, the client_secret exchange should go through
 * a backend proxy, not directly from the client. For desktop MVP this
 * is acceptable since the binary is controlled by the user.
 */
export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: 'axis://oauth/github',
    }),
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    access_token?: string
    error?: string
  }

  const token = data.access_token

  if (data.error ?? !token) {
    throw new Error(`GitHub OAuth error: ${data.error ?? 'no token returned'}`)
  }

  return token
}
