import { render, waitFor } from '@/test/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { recordProductUsage } from '@/lib/product-usage'
import App from './App'

vi.mock('@/lib/product-usage', () => ({
  recordProductUsage: vi.fn().mockResolvedValue(true),
}))

// Tauri bindings are mocked globally in src/test/setup.ts

describe('App', () => {
  it('records the local app opening when the application starts', async () => {
    render(<App />)

    await waitFor(() => {
      expect(recordProductUsage).toHaveBeenCalledWith('app_opened')
    })
  }, 20000)
})
