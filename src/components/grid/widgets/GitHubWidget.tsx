import { useEffect } from 'react'
import { GitPullRequest, RefreshCw, ExternalLink } from 'lucide-react'
import type { TFunction } from 'i18next'
import { openUrl } from '@tauri-apps/plugin-opener'
import { WidgetCard } from '../WidgetCard'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useGitHubStore } from '@/store/github-store'
import { extractRepoName, formatRelativeTime } from '@/services/github-api'
import { cn } from '@/lib/utils'
import type { PullRequest } from '@/types/github'

// ─── CI Status Badge ──────────────────────────────────────────────────────────

function CIBadge({
  status,
  t,
}: {
  status: PullRequest['ci_status']
  t: TFunction
}) {
  if (status === 'success') {
    return (
      <span
        className="text-chart-1 text-[10px] font-medium"
        aria-label={t('widgets.github.ciPassedAria')}
      >
        ✓
      </span>
    )
  }
  if (status === 'failure') {
    return (
      <span
        className="text-[10px] font-medium text-destructive"
        aria-label={t('widgets.github.ciFailedAria')}
      >
        ✗
      </span>
    )
  }
  return (
    <span
      className="text-[10px] text-muted-foreground/50"
      aria-label={t('widgets.github.ciPendingAria')}
    >
      ○
    </span>
  )
}

// ─── PR Row ───────────────────────────────────────────────────────────────────

function PRRow({ pr }: { pr: PullRequest }) {
  const { t } = useTranslation()
  const repoName = extractRepoName(pr.repository_url)
  const shortRepo = repoName.split('/')[1] ?? repoName

  const handleClick = async () => {
    try {
      await openUrl(pr.html_url)
    } catch {
      // silently fail
    }
  }

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
      type="button"
      onClick={handleClick}
      className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-accent/50"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 font-mono text-[10px] font-medium text-primary/70">
            #{pr.number}
          </span>
          <span className="truncate text-[12px] text-foreground/90">
            {pr.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/60">
            {shortRepo}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-[10px] text-muted-foreground/50">
            {formatRelativeTime(pr.updated_at)}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <CIBadge status={pr.ci_status} t={t} />
        </div>
      </div>
    </motion.button>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  label,
  count,
  isLoading,
  children,
  emptyText,
}: {
  label: string
  count: number
  isLoading: boolean
  children: React.ReactNode
  emptyText: string
}) {
  return (
    <div className="flex flex-col gap-0">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
          {label}
        </span>
        {count > 0 && (
          <span className="rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-1 px-2">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : count === 0 ? (
        <p className="px-2 py-1 text-[11px] text-muted-foreground/40">
          {emptyText}
        </p>
      ) : (
        <AnimatePresence mode="popLayout">{children}</AnimatePresence>
      )}
    </div>
  )
}

// ─── Unauthenticated State ────────────────────────────────────────────────────

function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={GitPullRequest}
        title={t('widgets.github.connectTitle')}
        description={t('widgets.github.connectDescription')}
        action={{
          label: t('widgets.github.connectAction'),
          onClick: onConnect,
        }}
      />
    </div>
  )
}

// ─── GitHub Widget ────────────────────────────────────────────────────────────

interface GitHubWidgetProps {
  onNavigateToGitHub?: () => void
}

export function GitHubWidget({ onNavigateToGitHub }: GitHubWidgetProps) {
  const { t } = useTranslation()

  const isAuthenticated = useGitHubStore(state => state.isAuthenticated)
  const user = useGitHubStore(state => state.user)
  const reviewRequests = useGitHubStore(state => state.reviewRequests)
  const myPRs = useGitHubStore(state => state.myPRs)
  const isLoadingReviews = useGitHubStore(state => state.isLoadingReviews)
  const isLoadingMyPRs = useGitHubStore(state => state.isLoadingMyPRs)
  const lastUpdated = useGitHubStore(state => state.lastUpdated)
  const initialize = useGitHubStore(state => state.initialize)
  const refresh = useGitHubStore(state => state.refresh)
  const startOAuthFlow = useGitHubStore(state => state.startOAuthFlow)

  useEffect(() => {
    void initialize()
  }, [initialize])

  const visibleReviews = reviewRequests.slice(0, 3)
  const visibleMyPRs = myPRs.slice(0, 3)

  const updatedLabel = lastUpdated
    ? t('widgets.github.updatedAt', {
        value: formatRelativeTime(lastUpdated.toISOString()),
      })
    : null

  return (
    <WidgetCard title={t('widgets.github.title')} icon={GitPullRequest}>
      {!isAuthenticated ? (
        <ConnectPrompt onConnect={() => void startOAuthFlow()} />
      ) : (
        <div className="flex h-full flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {user?.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="size-4 rounded-full"
                />
              )}
              <span className="text-[11px] font-medium text-foreground/70">
                @{user?.login}
              </span>
            </div>
            <button
              type="button"
              id="github-widget-refresh-btn"
              onClick={() => void refresh()}
              aria-label={t('widgets.github.refreshAria')}
              className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            >
              <RefreshCw className="size-3" />
            </button>
          </div>

          {/* Review Requests */}
          <Section
            label={t('widgets.github.reviewsLabel')}
            count={reviewRequests.length}
            isLoading={isLoadingReviews}
            emptyText={t('widgets.github.noPendingReviews')}
          >
            <div className="flex flex-col gap-0">
              {visibleReviews.map(pr => (
                <PRRow key={pr.id} pr={pr} />
              ))}
            </div>
          </Section>

          {/* My Open PRs */}
          <Section
            label={t('widgets.github.myPrsLabel')}
            count={myPRs.length}
            isLoading={isLoadingMyPRs}
            emptyText={t('widgets.github.noOpenPrs')}
          >
            <div className="flex flex-col gap-0">
              {visibleMyPRs.map(pr => (
                <PRRow key={pr.id} pr={pr} />
              ))}
            </div>
          </Section>

          {/* Footer */}
          <div className="mt-auto flex items-center justify-between pt-1">
            {updatedLabel && (
              <span className="text-[10px] text-muted-foreground/40">
                {updatedLabel}
              </span>
            )}
            <button
              type="button"
              onClick={onNavigateToGitHub}
              className={cn(
                'flex items-center gap-0.5 text-[10px] text-muted-foreground/50 transition-colors hover:text-muted-foreground',
                !updatedLabel && 'ml-auto'
              )}
            >
              {t('widgets.github.openButton')}
              <ExternalLink className="size-2.5" />
            </button>
          </div>
        </div>
      )}
    </WidgetCard>
  )
}
