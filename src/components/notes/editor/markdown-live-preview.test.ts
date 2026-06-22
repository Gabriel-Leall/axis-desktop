import { describe, expect, it } from 'vitest'
import {
  getMarkdownMarkerRanges,
  selectionTouchesRange,
} from './markdown-live-preview'

describe('markdown live preview', () => {
  it('hides closed strong markers away from the active selection', () => {
    expect(
      getMarkdownMarkerRanges('Text with **strong** content', [{ from: 0, to: 0 }])
    ).toEqual([
      { from: 10, to: 12 },
      { from: 18, to: 20 },
    ])
  })

  it('reveals markers when the selection touches their syntax range', () => {
    expect(
      getMarkdownMarkerRanges('Text with **strong** content', [{ from: 11, to: 11 }])
    ).toEqual([])
  })

  it('detects cursor and range overlap consistently', () => {
    expect(selectionTouchesRange([{ from: 5, to: 5 }], 4, 6)).toBe(true)
    expect(selectionTouchesRange([{ from: 2, to: 4 }], 4, 6)).toBe(false)
    expect(selectionTouchesRange([{ from: 2, to: 5 }], 4, 6)).toBe(true)
  })
})
