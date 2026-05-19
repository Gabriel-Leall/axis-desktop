import { ExternalLink, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { releasesApiUrl, releasesUrl } from '../data'

type Platform = 'windows' | 'linux'

type GitHubReleaseAsset = {
  name: string
  browser_download_url: string
}

type GitHubRelease = {
  id: number
  name: string | null
  tag_name: string
  html_url: string
  assets: GitHubReleaseAsset[]
}

type DownloadOption = {
  platform: Platform
  label: string
  href: string
  assetName?: string
}

const platformLabels: Record<Platform, string> = {
  windows: 'Windows',
  linux: 'Linux',
}

const assetMatchers: Record<Platform, RegExp[]> = {
  windows: [/\.msi$/i, /\.exe$/i, /windows|win32|win64|x64-setup/i],
  linux: [/\.appimage$/i, /\.deb$/i, /\.rpm$/i, /linux|amd64|x86_64/i],
}

let releaseCache: GitHubRelease | null = null
let releaseRequest: Promise<GitHubRelease> | null = null

async function fetchLatestRelease(signal: AbortSignal) {
  if (releaseCache) {
    return releaseCache
  }

  releaseRequest ??= fetch(releasesApiUrl, {
    headers: { Accept: 'application/vnd.github+json' },
    signal,
  }).then(async response => {
    if (!response.ok) {
      throw new Error(`GitHub releases request failed: ${response.status}`)
    }

    releaseCache = (await response.json()) as GitHubRelease
    return releaseCache
  })

  return releaseRequest
}

function WindowsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 4.6 10.6 3.5v8H3V4.6Zm8.7-1.25L21 2v9.5h-9.3V3.35ZM3 12.55h7.6v7.95L3 19.42v-6.87Zm8.7 0H21V22l-9.3-1.32v-8.13Z" />
    </svg>
  )
}

function LinuxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.1c-2.05 0-3.65 1.74-3.65 4 0 1.13.3 2.03.63 2.86-.7.76-1.1 1.82-1.36 3.08l-1.2 5.95c-.25 1.2.66 2.32 1.88 2.32h7.4c1.22 0 2.13-1.12 1.88-2.32l-1.2-5.95c-.26-1.26-.66-2.32-1.36-3.08.33-.83.63-1.73.63-2.86 0-2.26-1.6-4-3.65-4Zm-1.28 4.08c0-.45.32-.82.72-.82s.72.37.72.82-.32.82-.72.82-.72-.37-.72-.82Zm2.56 0c0-.45.32-.82.72-.82s.72.37.72.82-.32.82-.72.82-.72-.37-.72-.82ZM9.76 10.7c.58.4 1.3.61 2.24.61s1.66-.21 2.24-.61c.36.5.6 1.15.77 2.02l.95 4.68H8.04l.95-4.68c.17-.87.41-1.52.77-2.02Zm.62 4.08h3.24c.31 0 .56.25.56.56s-.25.56-.56.56h-3.24a.56.56 0 0 1 0-1.12Z" />
    </svg>
  )
}

function findAsset(release: GitHubRelease, platform: Platform) {
  return release.assets.find(asset =>
    assetMatchers[platform].some(matcher => matcher.test(asset.name))
  )
}

function getDownloadOptions(release: GitHubRelease): DownloadOption[] {
  return (['windows', 'linux'] as const).map(platform => {
    const asset = findAsset(release, platform)

    return {
      platform,
      label: platformLabels[platform],
      href: asset?.browser_download_url ?? release.html_url,
      assetName: asset?.name,
    }
  })
}

export function ReleaseDownloads({ id }: { id?: string }) {
  const { t } = useTranslation()
  const [release, setRelease] = useState<GitHubRelease | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadReleases() {
      try {
        const data = await fetchLatestRelease(controller.signal)
        setRelease(data)
        setStatus('ready')
      } catch (error) {
        if (!controller.signal.aborted) {
          releaseRequest = null
          console.error(error)
          setStatus('error')
        }
      }
    }

    void loadReleases()

    return () => controller.abort()
  }, [])

  return (
    <div className="release-downloads" id={id}>
      {status === 'loading' ? (
        <div className="release-downloads-status">
          <Loader2 />
          {t('landing.downloads.loading')}
        </div>
      ) : status === 'error' || !release ? (
        <a className="release-downloads-fallback" href={releasesUrl}>
          <ExternalLink />
          {t('landing.downloads.fallback')}
        </a>
      ) : (
        <div className="release-downloads-list">
          <article className="release-card">
            <div className="release-platforms">
              {getDownloadOptions(release).map(option => (
                <a
                  key={option.platform}
                  className="release-platform"
                  href={option.href}
                  title={option.assetName ?? release.html_url}
                  aria-label={t('landing.downloads.downloadAria', {
                    platform: option.label,
                    release: release.name ?? release.tag_name,
                  })}
                >
                  {option.platform === 'windows' ? (
                    <WindowsIcon />
                  ) : (
                    <LinuxIcon />
                  )}
                  <span>{option.label}</span>
                </a>
              ))}
            </div>
          </article>
        </div>
      )}
    </div>
  )
}
