import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { useUIStore } from '@/store/ui-store'
import { LeftSideBar } from './LeftSideBar'

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    getDefaultQuickPaneShortcut: vi.fn(
      () => new Promise<string>(() => undefined)
    ),
    toggleQuickPane: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
  },
}))

vi.mock('@/lib/notifications', () => ({
  notifications: {
    error: vi.fn(),
  },
}))

describe('LeftSideBar', () => {
  beforeEach(() => {
    useUIStore.setState({
      activePage: 'grid',
      activePageData: {},
    })
  })

  it('uses compact activity bar density when Notes is active', () => {
    useUIStore.setState({
      activePage: 'notes',
      activePageData: {},
    })

    render(<LeftSideBar />)

    expect(screen.getByTestId('axis-activity-bar')).toHaveClass(
      'axis-activity-bar-compact'
    )
  })

  it('gives each activity control an accessible name', () => {
    render(<LeftSideBar />)

    expect(screen.getByRole('button', { name: 'Notes' })).toBeInTheDocument()
  })
})
