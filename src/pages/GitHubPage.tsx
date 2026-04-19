import { useEffect, useState } from 'react'
import {
  GitPullRequest,
  RefreshCw,
  LogOut,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useGitHubStore } from '@/store/github-store'
import { useUIStore } from '@/store/ui-store'
import { extractRepoName, formatRelativeTime } from '@/services/github-api'
import { cn } from '@/lib/utils'
import type { PullRequest, GitHubIssue, GitHubLabel } from '@/types/github'

// ─── Label Pill ──────────────────────────────────────────────────────────────

function LabelPill({ label }: { label: GitHubLabel }) {
  // GitHub colors are hex without #
  const bg = `#${label.color}`
  // Compute contrasting text color
  const r = parseInt(label.color.slice(0, 2), 16)
  const g = parseInt(label.color.slice(2, 4), 16)
  const b = parseInt(label.color.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const textColor = luminance > 0.5 ? '#000000' : '#ffffff'

  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: bg, color: textColor }}
    >
      {label.name}
    </span>
  )
}

// ─── CI Status ────────────────────────────────────────────────────────────────

function CIStatus({ status }: { status: PullRequest['ci_status'] }) {
  if (status === 'success') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
        <span>✓</span> CI passed
      </span>
    )
  }
  if (status === 'failure') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
        <span>✗</span> CI failed
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
      <span>○</span> CI pending
    </span>
  )
}

// ─── PR Item ─────────────────────────────────────────────────────────────────

function PRItem({ pr }: { pr: PullRequest }) {
  const repoName = extractRepoName(pr.repository_url)

  const handleOpen = async () => {
    try {
      await openUrl(pr.html_url)
    } catch {
      /* silently fail */
    }
  }

  return (
    <div className="group rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/30">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 font-mono text-[11px] font-semibold text-primary/60">
            #{pr.number}
          </span>
          <div>
            <p className="text-[13px] font-medium leading-snug text-foreground">
              {pr.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground/70">
                {repoName}
              </span>
              <span className="text-muted-foreground/30">·</span>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                {pr.user.avatar_url && (
                  <img
                    src={pr.user.avatar_url}
                    alt={pr.user.login}
                    className="size-3.5 rounded-full"
                  />
                )}
                {pr.user.login}
              </div>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[11px] text-muted-foreground/50">
                {formatRelativeTime(pr.updated_at)}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Open in GitHub"
          className="shrink-0 rounded p-1 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-accent hover:text-muted-foreground"
        >
          <ExternalLink className="size-3.5" />
        </button>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2">
        <CIStatus status={pr.ci_status} />
        {pr.comments > 0 && (
          <span className="text-[11px] text-muted-foreground/50">
            {pr.comments} comment{pr.comments !== 1 ? 's' : ''}
          </span>
        )}
        {pr.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pr.labels.map(label => (
              <LabelPill key={label.name} label={label} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Issue Item ───────────────────────────────────────────────────────────────

function IssueItem({ issue }: { issue: GitHubIssue }) {
  const repoName = extractRepoName(issue.repository_url)

  const handleOpen = async () => {
    try {
      await openUrl(issue.html_url)
    } catch {
      /* silently fail */
    }
  }

  return (
    <div className="group rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 font-mono text-[11px] font-semibold text-primary/60">
            #{issue.number}
          </span>
          <div>
            <p className="text-[13px] font-medium leading-snug text-foreground">
              {issue.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground/70">
                {repoName}
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[11px] text-muted-foreground/50">
                {formatRelativeTime(issue.updated_at)}
              </span>
            </div>
            {issue.labels.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {issue.labels.map(label => (
                  <LabelPill key={label.name} label={label} />
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Open in GitHub"
          className="shrink-0 rounded p-1 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-accent hover:text-muted-foreground"
        >
          <ExternalLink className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

type Tab = 'reviews' | 'myPRs' | 'issues'

function TabBtn({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  count: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
    >
      {children}
      {count > 0 && (
        <span
          className={cn(
            'rounded px-1 py-0.5 text-[10px] font-mono',
            active
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Skeleton List ────────────────────────────────────────────────────────────

function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-lg border border-border bg-card"
        />
      ))}
    </div>
  )
}

// ─── GitHub Page ──────────────────────────────────────────────────────────────

export function GitHubPage() {
  const navigateTo = useUIStore(state => state.navigateTo)

  const isAuthenticated = useGitHubStore(state => state.isAuthenticated)
  const user = useGitHubStore(state => state.user)
  const reviewRequests = useGitHubStore(state => state.reviewRequests)
  const myPRs = useGitHubStore(state => state.myPRs)
  const assignedIssues = useGitHubStore(state => state.assignedIssues)
  const isLoadingReviews = useGitHubStore(state => state.isLoadingReviews)
  const isLoadingMyPRs = useGitHubStore(state => state.isLoadingMyPRs)
  const isLoadingIssues = useGitHubStore(state => state.isLoadingIssues)
  const lastUpdated = useGitHubStore(state => state.lastUpdated)
  const error = useGitHubStore(state => state.error)
  const initialize = useGitHubStore(state => state.initialize)
  const refresh = useGitHubStore(state => state.refresh)
  const logout = useGitHubStore(state => state.logout)
  const startOAuthFlow = useGitHubStore(state => state.startOAuthFlow)

  const [activeTab, setActiveTab] = useState<Tab>('reviews')

  useEffect(() => {
    void initialize()
  }, [initialize])

  const updatedLabel = lastUpdated
    ? `Updated ${formatRelativeTime(lastUpdated.toISOString())}`
    : null

  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col bg-background p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateTo('grid')}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <GitPullRequest className="size-5 text-foreground" />
            <h1 className="text-lg font-semibold">GitHub</h1>
          </div>
        </div>

        {/* Connect state */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <GitPullRequest
            className="size-14 text-muted-foreground/20"
            strokeWidth={1}
          />
          <div className="text-center">
            <p className="text-[15px] font-medium text-foreground">
              Connect your GitHub account
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground/60">
              Review pull requests and track assigned issues without leaving
              Axis.
            </p>
          </div>
          <button
            type="button"
            id="github-page-connect-btn"
            onClick={() => void startOAuthFlow()}
            className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Connect GitHub
          </button>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateTo('grid')}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <GitPullRequest className="size-4 text-muted-foreground" />
            <h1 className="text-[15px] font-semibold">GitHub</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-1.5">
              {user.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="size-5 rounded-full"
                />
              )}
              <span className="text-[12px] text-muted-foreground">
                @{user.login}
              </span>
            </div>
          )}
          <button
            type="button"
            id="github-page-logout-btn"
            onClick={() => void logout()}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground/60 hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-1.5">
        <div className="flex gap-1">
          <TabBtn
            active={activeTab === 'reviews'}
            count={reviewRequests.length}
            onClick={() => setActiveTab('reviews')}
          >
            Review Requests
          </TabBtn>
          <TabBtn
            active={activeTab === 'myPRs'}
            count={myPRs.length}
            onClick={() => setActiveTab('myPRs')}
          >
            My PRs
          </TabBtn>
          <TabBtn
            active={activeTab === 'issues'}
            count={assignedIssues.length}
            onClick={() => setActiveTab('issues')}
          >
            Issues
          </TabBtn>
        </div>
        <div className="flex items-center gap-2">
          {updatedLabel && (
            <span className="text-[10px] text-muted-foreground/40">
              {updatedLabel}
            </span>
          )}
          <button
            type="button"
            id="github-page-refresh-btn"
            onClick={() => void refresh()}
            aria-label="Refresh"
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-muted-foreground"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/5 px-4 py-2">
          <p className="text-[12px] text-destructive">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'reviews' && (
          <div className="flex flex-col gap-2">
            <h2 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Review Requests — {reviewRequests.length} pending
            </h2>
            {isLoadingReviews ? (
              <SkeletonList />
            ) : reviewRequests.length === 0 ? (
              <EmptyState message="No pending review requests 🎉" />
            ) : (
              reviewRequests.map(pr => <PRItem key={pr.id} pr={pr} />)
            )}
          </div>
        )}

        {activeTab === 'myPRs' && (
          <div className="flex flex-col gap-2">
            <h2 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              My Open PRs — {myPRs.length} open
            </h2>
            {isLoadingMyPRs ? (
              <SkeletonList />
            ) : myPRs.length === 0 ? (
              <EmptyState message="No open pull requests" />
            ) : (
              myPRs.map(pr => <PRItem key={pr.id} pr={pr} />)
            )}
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="flex flex-col gap-2">
            <h2 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Assigned Issues — {assignedIssues.length} open
            </h2>
            {isLoadingIssues ? (
              <SkeletonList />
            ) : assignedIssues.length === 0 ? (
              <EmptyState message="No assigned issues 🎉" />
            ) : (
              assignedIssues.map(issue => (
                <IssueItem key={issue.id} issue={issue} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center">
      <p className="text-[13px] text-muted-foreground/40">{message}</p>
    </div>
  )
}
