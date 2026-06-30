import { describe, expect, it } from 'vitest'
import {
  getMarkdownAnnotationRanges,
  type MarkdownAnnotationMarker,
} from './markdown-annotation-extension'

const baseAnnotation: MarkdownAnnotationMarker = {
  id: 'annotation-1',
  from: 2,
  to: 7,
  state: 'active',
  anchor_status: 'anchored',
}

describe('markdown annotation extension', () => {
  it('returns visible ranges only for anchored annotations', () => {
    expect(getMarkdownAnnotationRanges([baseAnnotation], 20)).toEqual([
      {
        id: 'annotation-1',
        from: 2,
        to: 7,
        className: 'cm-notes-annotation',
      },
    ])
  })

  it('marks resolved annotations with a secondary class', () => {
    expect(
      getMarkdownAnnotationRanges(
        [{ ...baseAnnotation, state: 'resolved' }],
        20
      )
    ).toEqual([
      {
        id: 'annotation-1',
        from: 2,
        to: 7,
        className: 'cm-notes-annotation cm-notes-annotation-resolved',
      },
    ])
  })

  it('omits lost and invalid ranges', () => {
    expect(
      getMarkdownAnnotationRanges(
        [
          { ...baseAnnotation, id: 'lost', anchor_status: 'lost' },
          { ...baseAnnotation, id: 'empty', from: 4, to: 4 },
          { ...baseAnnotation, id: 'outside', from: 30, to: 40 },
        ],
        20
      )
    ).toEqual([])
  })
})
