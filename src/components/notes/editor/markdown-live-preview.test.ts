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

  it('hides inline-code markers when no selection touches them', () => {
    expect(getMarkdownMarkerRanges('_italic_ and `code`', [{ from: 0, to: 0 }])).toEqual([
      { from: 13, to: 14 },
      { from: 18, to: 19 },
    ])
  })

  it('reveals a marker when any selection range touches it', () => {
    expect(
      getMarkdownMarkerRanges('**strong** and `code`', [
        { from: 13, to: 13 },
        { from: 1, to: 1 },
        { from: 15, to: 15 },
      ])
    ).toEqual([])
  })

  it.each([
    ['heading', '# Heading body', [{ from: 0, to: 2 }]],
    ['checklist', '- [ ] Task body', [{ from: 0, to: 6 }]],
    [
      'link',
      '[Axis](url) next',
      [
        { from: 0, to: 1 },
        { from: 5, to: 7 },
        { from: 10, to: 11 },
      ],
    ],
    [
      'emphasis',
      '_italic_ next',
      [
        { from: 0, to: 1 },
        { from: 7, to: 8 },
      ],
    ],
  ] as const)(
    'finds closed %s markers away from the cursor',
    (_, content, expected) => {
      expect(
        getMarkdownMarkerRanges(content, [
          { from: content.length, to: content.length },
        ])
      ).toEqual(expected)
    }
  )
})
