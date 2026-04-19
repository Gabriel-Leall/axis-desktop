import { useEffect, useState } from 'react'
import {
  MessageSquare,
  RefreshCw,
  LogOut,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useSlackStore } from '@/store/slack-store'
import { useUIStore } from '@/store/ui-store'
import {
  formatSlackTs,
  stripSlackMarkdown,
  getSlackChannelUrl,
} from '@/services/slack-api'
import { cn } from '@/lib/utils'
import type { SlackMessage, SlackDM } from '@/types/slack'
import type { SlackUser } from '@/types/slack'

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({
  name,
  avatarUrl,
  size = 'sm',
}: {
  name: string
  avatarUrl?: string
  size?: 'sm' | 'md'
}) {
  const cls = size === 'md' ? 'size-8' : 'size-6'
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${cls} shrink-0 rounded-full object-cover`}
        loading="lazy"
      />
    )
  }
  return (
    <div
      className={`flex ${cls} shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground uppercase`}
    >
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

// ─── Mention Item ─────────────────────────────────────────────────────────────

function MentionItem({
  message,
  resolvedUser,
}: {
  message: SlackMessage
  resolvedUser: SlackUser | null
}) {
  const displayName = resolvedUser?.real_name ?? resolvedUser?.name ?? 'Unknown'
  const avatarUrl = resolvedUser?.profile.image_72

  const handleOpen = async () => {
    try {
      await openUrl(message.permalink)
    } catch {
      /* silently fail */
    }
  }

  return (
    <div className="group rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/30">
      <div className="flex items-start gap-3">
        <UserAvatar name={displayName} avatarUrl={avatarUrl} size="md" />
        <div className="flex-1 min-w-0">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">
              {displayName}
            </span>
            <span className="text-[11px] text-muted-foreground/60">
              #{message.channel.name}
            </span>
            <span className="text-[10px] text-muted-foreground/40 ml-auto shrink-0">
              {formatSlackTs(message.ts)}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground/80 leading-relaxed line-clamp-2">
            {stripSlackMarkdown(message.text)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Open in Slack"
          className="shrink-0 rounded p-1 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-accent hover:text-muted-foreground"
        >
          <ExternalLink className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── DM Item ──────────────────────────────────────────────────────────────────

function DMItem({
  dm,
  resolvedUser,
  teamId,
}: {
  dm: SlackDM
  resolvedUser: SlackUser | null
  teamId: string | null
}) {
  const displayName =
    resolvedUser?.real_name ?? resolvedUser?.name ?? 'Direct Message'
  const avatarUrl = resolvedUser?.profile.image_72

  const handleOpen = async () => {
    if (!teamId) return
    try {
      await openUrl(getSlackChannelUrl(teamId, dm.id))
    } catch {
      /* silently fail */
    }
  }

  return (
    <div className="group rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/30">
      <div className="flex items-center gap-3">
        <UserAvatar name={displayName} avatarUrl={avatarUrl} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">
              {displayName}
            </span>
            {dm.unread_count > 0 && <UnreadBadge count={dm.unread_count} />}
            {dm.last_message && (
              <span className="text-[10px] text-muted-foreground/40 ml-auto shrink-0">
                {formatSlackTs(dm.last_message.ts)}
              </span>
            )}
          </div>
          {dm.last_message && (
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground/70">
              {stripSlackMarkdown(dm.last_message.text)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Open in Slack"
          className="shrink-0 rounded p-1 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-accent hover:text-muted-foreground"
        >
          <ExternalLink className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

type Tab = 'mentions' | 'dms'

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-lg border border-border bg-card"
        />
      ))}
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

// ─── Slack Page ───────────────────────────────────────────────────────────────

export function SlackPage() {
  const navigateTo = useUIStore(state => state.navigateTo)

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
  const error = useSlackStore(state => state.error)
  const initialize = useSlackStore(state => state.initialize)
  const refresh = useSlackStore(state => state.refresh)
  const logout = useSlackStore(state => state.logout)
  const startOAuthFlow = useSlackStore(state => state.startOAuthFlow)
  const resolveUser = useSlackStore(state => state.resolveUser)

  const [activeTab, setActiveTab] = useState<Tab>('mentions')

  useEffect(() => {
    void initialize()
  }, [initialize])

  // Resolve all visible user IDs
  useEffect(() => {
    if (!isAuthenticated) return

    const allIds = new Set<string>([
      ...mentions.map(m => m.user),
      ...directMessages.map(dm => dm.user),
    ])

    allIds.forEach(uid => {
      if (!usersCache[uid]) {
        void resolveUser(uid)
      }
    })
  }, [isAuthenticated, mentions, directMessages, usersCache, resolveUser])

  const updatedLabel = lastUpdated
    ? `Updated ${formatSlackTs(String(lastUpdated.getTime() / 1000))}`
    : null

  const totalUnread = directMessages.reduce(
    (sum, dm) => sum + dm.unread_count,
    0
  )

  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col bg-background p-6">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateTo('grid')}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-foreground" />
            <h1 className="text-lg font-semibold">Slack</h1>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <MessageSquare
            className="size-14 text-muted-foreground/20"
            strokeWidth={1}
          />
          <div className="text-center">
            <p className="text-[15px] font-medium text-foreground">
              Connect your Slack workspace
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground/60">
              See mentions and DMs without switching windows.
            </p>
          </div>
          <button
            type="button"
            id="slack-page-connect-btn"
            onClick={() => void startOAuthFlow()}
            className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Connect Slack
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
            <MessageSquare className="size-4 text-muted-foreground" />
            <h1 className="text-[15px] font-semibold">Slack</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {user?.profile.image_48 && (
              <img
                src={user.profile.image_48}
                alt={user.name}
                className="size-5 rounded-full"
              />
            )}
            <span className="text-[12px] text-muted-foreground">
              {teamName ?? user?.name ?? 'Workspace'}
            </span>
            {totalUnread > 0 && <UnreadBadge count={totalUnread} />}
          </div>
          <button
            type="button"
            id="slack-page-logout-btn"
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
            active={activeTab === 'mentions'}
            count={mentions.length}
            onClick={() => setActiveTab('mentions')}
          >
            Mentions
          </TabBtn>
          <TabBtn
            active={activeTab === 'dms'}
            count={directMessages.length}
            onClick={() => setActiveTab('dms')}
          >
            Direct Messages
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
            id="slack-page-refresh-btn"
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
        {activeTab === 'mentions' && (
          <div className="flex flex-col gap-2">
            <h2 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Mentions — {mentions.length} new
            </h2>
            {isLoadingMentions ? (
              <SkeletonList />
            ) : mentions.length === 0 ? (
              <EmptyState message="No mentions" />
            ) : (
              mentions.map(msg => (
                <MentionItem
                  key={msg.ts}
                  message={msg}
                  resolvedUser={usersCache[msg.user] ?? null}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'dms' && (
          <div className="flex flex-col gap-2">
            <h2 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Direct Messages —{' '}
              {totalUnread > 0 ? `${totalUnread} unread` : 'all read'}
            </h2>
            {isLoadingDMs ? (
              <SkeletonList />
            ) : directMessages.length === 0 ? (
              <EmptyState message="No direct messages" />
            ) : (
              directMessages.map(dm => (
                <DMItem
                  key={dm.id}
                  dm={dm}
                  resolvedUser={usersCache[dm.user] ?? null}
                  teamId={teamId}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
