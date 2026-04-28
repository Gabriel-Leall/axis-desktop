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
    expect(file).toContain('--background: oklch(')
  })
})
