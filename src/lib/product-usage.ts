import {
  commands,
  type ProductUsageEvent,
  type ProductUsageSnapshot,
} from '@/lib/tauri-bindings'
import { getLocalISODate } from '@/lib/calendar-domain'
import { logger } from '@/lib/logger'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

/**
 * Records a privacy-safe aggregate event without interrupting the user action
 * that produced it. No content or external identifier is accepted here.
 */
export async function recordProductUsage(
  event: ProductUsageEvent,
  occurredAt = new Date()
): Promise<boolean> {
  try {
    const result = await commands.recordProductUsageEvent(
      event,
      occurredAt.toISOString(),
      getLocalISODate(occurredAt)
    )

    if (result.status === 'error') {
      logger.warn('Failed to record local product usage', {
        event,
        error: String(result.error),
      })
      return false
    }

    return true
  } catch (error) {
    logger.warn('Failed to record local product usage', {
      event,
      error: String(error),
    })
    return false
  }
}

export function serializeProductUsageSnapshot(
  snapshot: ProductUsageSnapshot
): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`
}

export async function exportProductUsageSnapshot(): Promise<boolean> {
  const result = await commands.getProductUsageSnapshot()
  if (result.status === 'error') {
    throw new Error(String(result.error))
  }

  const destination = await save({
    defaultPath: `axis-product-usage-${getLocalISODate()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })

  if (!destination) {
    return false
  }

  await writeTextFile(destination, serializeProductUsageSnapshot(result.data))
  return true
}
