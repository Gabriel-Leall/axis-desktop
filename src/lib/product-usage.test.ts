import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commands, type ProductUsageSnapshot } from '@/lib/tauri-bindings'
import { logger } from '@/lib/logger'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import {
  exportProductUsageSnapshot,
  recordProductUsage,
  serializeProductUsageSnapshot,
} from './product-usage'

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    recordProductUsageEvent: vi.fn(),
    getProductUsageSnapshot: vi.fn(),
  },
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}))

const snapshot: ProductUsageSnapshot = {
  schema_version: 1,
  generated_at: '2026-08-06T12:10:00Z',
  local_only: true,
  definition: {
    activation: 'first_focus_started_and_first_capture_saved',
    first_week_retention: 'three_active_days_in_first_seven_days',
  },
  milestones: {
    measurement_started_at: '2026-08-06T12:00:00Z',
    first_focus_started_at: null,
    first_capture_saved_at: null,
    onboarding_completed_at: null,
  },
  activation: {
    activated: false,
    activated_at: null,
    time_to_value_seconds: null,
  },
  retention: {
    d1_returned: null,
    active_days_first_week: 0,
    first_week_retained: null,
  },
  daily_usage: [],
}

describe('product usage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('records an aggregate event with local date and UTC timestamp', async () => {
    vi.mocked(commands.recordProductUsageEvent).mockResolvedValue({
      status: 'ok',
      data: null,
    })

    const recorded = await recordProductUsage(
      'focus_started',
      new Date('2026-08-06T12:05:00.000Z')
    )

    expect(recorded).toBe(true)
    expect(commands.recordProductUsageEvent).toHaveBeenCalledWith(
      'focus_started',
      '2026-08-06T12:05:00.000Z',
      '2026-08-06'
    )
  })

  it('does not interrupt the product action when measurement fails', async () => {
    vi.mocked(commands.recordProductUsageEvent).mockResolvedValue({
      status: 'error',
      error: 'database unavailable',
    })

    const recorded = await recordProductUsage('capture_saved')

    expect(recorded).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to record local product usage',
      expect.objectContaining({ event: 'capture_saved' })
    )
  })

  it('serializes a versioned, readable local snapshot', () => {
    const json = serializeProductUsageSnapshot(snapshot)

    expect(json.endsWith('\n')).toBe(true)
    expect(JSON.parse(json)).toEqual(snapshot)
  })

  it('exports the snapshot only after the user chooses a destination', async () => {
    vi.mocked(commands.getProductUsageSnapshot).mockResolvedValue({
      status: 'ok',
      data: snapshot,
    })
    vi.mocked(save).mockResolvedValue('C:\\tmp\\axis-product-usage.json')
    vi.mocked(writeTextFile).mockResolvedValue(undefined)

    const exported = await exportProductUsageSnapshot()

    expect(exported).toBe(true)
    expect(writeTextFile).toHaveBeenCalledWith(
      'C:\\tmp\\axis-product-usage.json',
      serializeProductUsageSnapshot(snapshot)
    )
  })

  it('does not write a file when export is cancelled', async () => {
    vi.mocked(commands.getProductUsageSnapshot).mockResolvedValue({
      status: 'ok',
      data: snapshot,
    })
    vi.mocked(save).mockResolvedValue(null)

    const exported = await exportProductUsageSnapshot()

    expect(exported).toBe(false)
    expect(writeTextFile).not.toHaveBeenCalled()
  })
})
