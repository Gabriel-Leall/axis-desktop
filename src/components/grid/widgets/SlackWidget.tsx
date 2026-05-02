import { useEffect } from 'react'
import { MessageSquare, RefreshCw, ExternalLink } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { WidgetCard } from '../WidgetCard'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useSlackStore } from '@/store/slack-store'
import {
  formatSlackTs,
  stripSlackMarkdown,
  getSlackChannelUrl,
} from '@/services/slack-api'
import { cn } from '@/lib/utils'
import type { SlackMessage, SlackDM } from '@/types/slack'
import type { SlackUser } from '@/types/slack'

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="size-5 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-muted-foreground uppercase">
      {name[0] ?? '?'}
    </div>
  )
}

// ─── Unread Badge ─────────────────────────────────────────────────────────────

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
      {count > 99 ? '99+' : count}
    </span>
  )
}

// ─── Mention Row ──────────────────────────────────────────────────────────────

function MentionRow({
  message,
  resolvedUser,
}: {
  message: SlackMessage
  resolvedUser: SlackUser | null
}) {
  const { t } = useTranslation()
  const displayName =
    resolvedUser?.real_name ??
    resolvedUser?.name ??
    t('widgets.slack.unknownUser')
  const avatarUrl = resolvedUser?.profile.image_48

  const handleClick = async () => {
    try {
      await openUrl(message.permalink)
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
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-accent/50"
    >
      <UserAvatar name={displayName} avatarUrl={avatarUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-0">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-foreground/90">
            {displayName}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            #{message.channel.name}
          </span>
        </div>
        <span className="truncate text-[10px] text-muted-foreground/70">
          {stripSlackMarkdown(message.text)}
        </span>
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground/40">
        {formatSlackTs(message.ts)}
      </span>
    </motion.button>
  )
}

// ─── DM Row ───────────────────────────────────────────────────────────────────

function DMRow({
  dm,
  resolvedUser,
  teamId,
}: {
  dm: SlackDM
  resolvedUser: SlackUser | null
  teamId: string | null
}) {
  const { t } = useTranslation()
  const displayName =
    resolvedUser?.real_name ??
    resolvedUser?.name ??
    t('widgets.slack.dmFallback')
  const avatarUrl = resolvedUser?.profile.image_48

  const handleClick = async () => {
    if (!teamId) return
    try {
      await openUrl(getSlackChannelUrl(teamId, dm.id))
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
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-accent/50"
    >
      <UserAvatar name={displayName} avatarUrl={avatarUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-0">
        <span className="text-[11px] font-medium text-foreground/90">
          {displayName}
        </span>
        {dm.last_message && (
          <span className="truncate text-[10px] text-muted-foreground/60">
            {stripSlackMarkdown(dm.last_message.text)}
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {dm.unread_count > 0 && <UnreadBadge count={dm.unread_count} />}
        {dm.last_message && (
          <span className="text-[10px] text-muted-foreground/40">
            {formatSlackTs(dm.last_message.ts)}
          </span>
        )}
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

// ─── Connect Prompt ───────────────────────────────────────────────────────────

function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={MessageSquare}
        title={t('widgets.slack.connectTitle')}
        description={t('widgets.slack.connectDescription')}
        action={{
          label: t('widgets.slack.connectAction'),
          onClick: onConnect,
        }}
      />
    </div>
  )
}

// ─── Slack Widget ─────────────────────────────────────────────────────────────

interface SlackWidgetProps {
  onNavigateToSlack?: () => void
}

export function SlackWidget({ onNavigateToSlack }: SlackWidgetProps) {
  const { t } = useTranslation()

  const isAuthenticated = useSlackStore(state => state.isAuthenticated)
  const user = useSlackStore(state => state.user)
  const teamName = useSlackStore(state => state.teamName)
  const teamId = useSlackStore(state => state.teamId)
  const mentions = useSlackStore(state => state.mentions)
  const directMessages = useSlackStore(state => state.directMessages)
  const usersCache = useSlackStore(state => state.usersCache)
  const isLoadingMentions = useSlackStore(state => state.isLoadingMentions)
  const isLoadingDMs = useSlackStore(state => state.isLoadingDMs)
  const lastUpdated = useSlackStore(state => state.lastUpdated)
  const initialize = useSlackStore(state => state.initialize)
  const refresh = useSlackStore(state => state.refresh)
  const startOAuthFlow = useSlackStore(state => state.startOAuthFlow)
  const resolveUser = useSlackStore(state => state.resolveUser)

  useEffect(() => {
    void initialize()
  }, [initialize])

  // Resolve user IDs
  useEffect(() => {
    if (!isAuthenticated) return
    const visibleMentions = mentions.slice(0, 3)
    const visibleDMs = directMessages.slice(0, 3)

    const allIds = new Set([
      ...visibleMentions.map(m => m.user),
      ...visibleDMs.map(dm => dm.user),
    ])

    allIds.forEach(uid => {
      if (!usersCache[uid]) {
        void resolveUser(uid)
      }
    })
  }, [isAuthenticated, mentions, directMessages, usersCache, resolveUser])

  const visibleMentions = mentions.slice(0, 3)
  const visibleDMs = directMessages.slice(0, 3)
  const totalUnread = directMessages.reduce(
    (sum, dm) => sum + dm.unread_count,
    0
  )

  const updatedLabel = lastUpdated
    ? t('widgets.slack.updatedAt', {
        value: formatSlackTs(String(lastUpdated.getTime() / 1000)),
      })
    : null

  return (
    <WidgetCard title={t('widgets.slack.title')} icon={MessageSquare}>
      {!isAuthenticated ? (
        <ConnectPrompt onConnect={() => void startOAuthFlow()} />
      ) : (
        <div className="flex h-full flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {user?.profile.image_48 && (
                <img
                  src={user.profile.image_48}
                  alt={user.name}
                  className="size-4 rounded-full"
                />
              )}
              <span className="text-[11px] font-medium text-foreground/70">
                {teamName ?? user?.name ?? t('widgets.slack.workspaceFallback')}
              </span>
              {totalUnread > 0 && <UnreadBadge count={totalUnread} />}
            </div>
            <button
              type="button"
              id="slack-widget-refresh-btn"
              onClick={() => void refresh()}
              aria-label={t('widgets.slack.refreshAria')}
              className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            >
              <RefreshCw className="size-3" />
            </button>
          </div>

          {/* Mentions */}
          <Section
            label={t('widgets.slack.mentionsLabel')}
            count={mentions.length}
            isLoading={isLoadingMentions}
            emptyText={t('widgets.slack.noMentions')}
          >
            <div className="flex flex-col gap-0">
              {visibleMentions.map(msg => (
                <MentionRow
                  key={msg.ts}
                  message={msg}
                  resolvedUser={usersCache[msg.user] ?? null}
                />
              ))}
            </div>
          </Section>

          {/* DMs */}
          <Section
            label={t('widgets.slack.directMessagesLabel')}
            count={directMessages.length}
            isLoading={isLoadingDMs}
            emptyText={t('widgets.slack.noDirectMessages')}
          >
            <div className="flex flex-col gap-0">
              {visibleDMs.map(dm => (
                <DMRow
                  key={dm.id}
                  dm={dm}
                  resolvedUser={usersCache[dm.user] ?? null}
                  teamId={teamId}
                />
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
              onClick={onNavigateToSlack}
              className={cn(
                'flex items-center gap-0.5 text-[10px] text-muted-foreground/50 transition-colors hover:text-muted-foreground',
                !updatedLabel && 'ml-auto'
              )}
            >
              {t('widgets.slack.openButton')}
              <ExternalLink className="size-2.5" />
            </button>
          </div>
        </div>
      )}
    </WidgetCard>
  )
}
