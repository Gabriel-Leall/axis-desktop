import { useEffect, useState } from 'react'
import { WidgetCard } from '../WidgetCard'
import { Monitor } from 'lucide-react'
import { platform, arch } from '@tauri-apps/plugin-os'

interface SystemData {
  platform: string
  uptime: string
  memory: string
}

/**
 * System Info widget — displays basic system information.
 */
export function SystemInfoWidget() {
  const [data, setData] = useState<SystemData>({
    platform: 'Loading...',
    uptime: '–',
    memory: '–',
  })

  useEffect(() => {
    const loadSystemInfo = async () => {
      try {
        const os = await platform()
        const architecture = await arch()

        setData({
          platform: `${os} (${architecture})`,
          uptime: formatUptime(performance.now()),
          memory: `${navigator.hardwareConcurrency} cores`,
        })
      } catch {
        setData({
          platform: navigator.platform,
          uptime: formatUptime(performance.now()),
          memory: `${navigator.hardwareConcurrency} cores`,
        })
      }
    }

    loadSystemInfo()

    // Update uptime every minute
    const interval = setInterval(() => {
      setData(prev => ({
        ...prev,
        uptime: formatUptime(performance.now()),
      }))
    }, 60_000)

    return () => clearInterval(interval)
  }, [])

  return (
    <WidgetCard title="System Info" icon={Monitor}>
      <div className="flex h-full flex-col justify-center gap-3">
        <InfoRow label="Platform" value={data.platform} />
        <InfoRow label="Session" value={data.uptime} />
        <InfoRow label="CPU" value={data.memory} />
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

function formatUptime(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
