/**
 * OAuth deep link handler.
 *
 * Registers a listener for custom URL scheme `axis://` deep links so that
 * OAuth callbacks from GitHub/Slack can be intercepted without opening a
 * browser redirect page.
 *
 * Call `registerDeepLinkHandler()` once inside App.tsx on startup.
 *
 * Required: tauri-plugin-deep-link must be configured in tauri.conf.json:
 * {
 *   "plugins": {
 *     "deep-link": {
 *       "desktop": { "schemes": ["axis"] }
 *     }
 *   }
 * }
 */

import { logger } from './logger'
import { useGitHubStore } from '@/store/github-store'
import { useSlackStore } from '@/store/slack-store'

export async function registerDeepLinkHandler(): Promise<void> {
  try {
    const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link')

    await onOpenUrl(async (urls: string[]) => {
      for (const url of urls) {
        try {
          const parsed = new URL(url)

          if (parsed.pathname.startsWith('/oauth/github')) {
            const code = parsed.searchParams.get('code')
            const state = parsed.searchParams.get('state')
            if (code) {
              await useGitHubStore.getState().handleOAuthCallback(code, state)
            }
          }

          if (parsed.pathname.startsWith('/oauth/slack')) {
            const code = parsed.searchParams.get('code')
            const state = parsed.searchParams.get('state')
            if (code) {
              await useSlackStore.getState().handleOAuthCallback(code, state)
            }
          }
        } catch (err) {
          logger.error(`Failed to process deep link "${url}": ${String(err)}`)
        }
      }
    })

    logger.debug('Deep link handler registered for axis:// scheme')
  } catch (err) {
    // Plugin not installed / not configured — graceful degradation
    logger.warn(
      `Deep link handler not available (tauri-plugin-deep-link missing?): ${String(err)}`
    )
  }
}
