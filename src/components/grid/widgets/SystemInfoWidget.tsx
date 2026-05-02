import { useEffect, useState } from 'react'
import { WidgetCard } from '../WidgetCard'
import { Monitor } from 'lucide-react'
import { platform, arch } from '@tauri-apps/plugin-os'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

interface SystemData {
  platform: string
  uptime: string
  memory: string
}

/**
 * System Info widget — displays basic system information.
 */
export function SystemInfoWidget() {
  const { t } = useTranslation()
  const [data, setData] = useState<SystemData>({
    platform: t('widgets.systemInfo.loading'),
    uptime: t('widgets.systemInfo.unknown'),
    memory: t('widgets.systemInfo.unknown'),
  })

  useEffect(() => {
    const loadSystemInfo = async () => {
      const cpuCores = navigator.hardwareConcurrency ?? 0
      const memoryLabel =
        cpuCores > 0
          ? t('widgets.systemInfo.cores', { count: cpuCores })
          : t('widgets.systemInfo.unknown')

      try {
        const os = await platform()
        const architecture = await arch()

        setData({
          platform: `${os} (${architecture})`,
          uptime: formatUptime(performance.now(), t),
          memory: memoryLabel,
        })
      } catch {
        setData({
          platform: navigator.platform || t('widgets.systemInfo.unknown'),
          uptime: formatUptime(performance.now(), t),
          memory: memoryLabel,
        })
      }
    }

    loadSystemInfo()

    // Update uptime every minute
    const interval = setInterval(() => {
      setData(prev => ({
        ...prev,
        uptime: formatUptime(performance.now(), t),
      }))
    }, 60_000)

    return () => clearInterval(interval)
  }, [t])

  return (
    <WidgetCard title={t('widgets.systemInfo.title')} icon={Monitor}>
      <div className="flex h-full flex-col justify-center gap-3">
        <InfoRow
          label={t('widgets.systemInfo.platformLabel')}
          value={data.platform}
        />
        <InfoRow
          label={t('widgets.systemInfo.sessionLabel')}
          value={data.uptime}
        />
        <InfoRow label={t('widgets.systemInfo.cpuLabel')} value={data.memory} />
      </div>
    </WidgetCard>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  )
}

function formatUptime(ms: number, t: TFunction): string {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) {
    return t('widgets.systemInfo.uptimeHoursMinutes', { hours, minutes })
  }
  return t('widgets.systemInfo.uptimeMinutes', { minutes })
}
