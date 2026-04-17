// GitHub domain types

export interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
  html_url: string
}

export interface GitHubLabel {
  name: string
  color: string
}

export interface PullRequest {
  id: number
  number: number
  title: string
  html_url: string
  state: string
  user: { login: string; avatar_url: string }
  repository_url: string
  created_at: string
  updated_at: string
  labels: GitHubLabel[]
  comments: number
  pull_request?: { url: string }
  ci_status?: 'success' | 'failure' | 'pending' | null
}

export interface GitHubIssue {
  id: number
  number: number
  title: string
  html_url: string
  state: string
  labels: GitHubLabel[]
  repository_url: string
  created_at: string
  updated_at: string
  comments: number
}

export interface GitHubSearchResult<T> {
  total_count: number
  incomplete_results: boolean
  items: T[]
}
