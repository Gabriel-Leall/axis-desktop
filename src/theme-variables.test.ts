import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('theme-variables', () => {
  it('includes White Glacial light tokens', () => {
    const file = fs.readFileSync(
      path.join(process.cwd(), 'src/theme-variables.css'),
      'utf-8'
    )
    expect(file).toContain('White Glacial')
    expect(file).toContain('--background: oklch(0.985 0.02 230);')
    expect(file).toContain('--primary: oklch(0.22 0.02 240);')
    expect(file).toContain('--muted: oklch(0.965 0.02 230);')
    expect(file).toContain('--accent: oklch(0.85 0.08 220);')
    expect(file).toContain('--border: oklch(0.88 0.03 230);')
    expect(file).toContain('--ring: oklch(0.78 0.12 220 / 0.5);')
  })
})
