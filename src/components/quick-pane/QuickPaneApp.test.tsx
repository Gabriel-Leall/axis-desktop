import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'
import { commands } from '@/lib/tauri-bindings'
import { recordProductUsage } from '@/lib/product-usage'
import QuickPaneApp from './QuickPaneApp'

vi.mock('@/lib/product-usage', () => ({
  recordProductUsage: vi.fn().mockResolvedValue(true),
}))

vi.mock('@tauri-apps/api/window', () => ({
  LogicalSize: class LogicalSize {
    constructor(
      public width: number,
      public height: number
    ) {}
  },
  getCurrentWindow: vi.fn(() => ({
    setSize: vi.fn().mockResolvedValue(undefined),
    onFocusChanged: vi.fn().mockResolvedValue(vi.fn()),
  })),
}))

describe('QuickPaneApp', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('pt-BR')
    vi.mocked(commands.getTasks).mockResolvedValue({ status: 'ok', data: [] })
    vi.mocked(commands.createTask).mockResolvedValue({
      status: 'ok',
      data: { id: 'captured-task' } as never,
    })
  })

  it('records a capture only after the entry is persisted', async () => {
    const user = userEvent.setup()
    render(<QuickPaneApp />)

    const input = screen.getByRole('textbox', { name: /texto da captura/i })
    await user.type(input, 'Registrar retorno do cliente')
    await user.keyboard('{Control>}{Enter}{/Control}')

    await waitFor(() => {
      expect(commands.createTask).toHaveBeenCalled()
      expect(recordProductUsage).toHaveBeenCalledWith('capture_saved')
    })
  })
})
