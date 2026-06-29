import { describe, expect, it } from 'vitest'
import {
  reconcileAnnotationAnchor,
  remapAnnotationAnchor,
  snapshotAnnotationAnchor,
} from './notes-annotations'

describe('notes annotation anchors', () => {
  it('captures quote and surrounding context for a selected range', () => {
    const content = 'Intro before\nTarget quote\nOutro after'

    expect(snapshotAnnotationAnchor(content, 13, 25)).toEqual({
      from: 13,
      to: 25,
      quote: 'Target quote',
      prefix: 'Intro before\n',
      suffix: '\nOutro after',
      status: 'anchored',
    })
  })

  it('moves an anchor when text is inserted before it', () => {
    const anchor = snapshotAnnotationAnchor('Alpha target Omega', 6, 12)

    expect(
      remapAnnotationAnchor(anchor, {
        from: 0,
        to: 0,
        insert: 'New ',
      })
    ).toMatchObject({
      from: 10,
      to: 16,
      status: 'anchored',
    })
  })

  it('expands an anchor when text is inserted inside it', () => {
    const anchor = snapshotAnnotationAnchor('Alpha target Omega', 6, 12)

    expect(
      remapAnnotationAnchor(anchor, {
        from: 9,
        to: 9,
        insert: 'geted',
      })
    ).toMatchObject({
      from: 6,
      to: 17,
      status: 'anchored',
    })
  })

  it('marks an anchor lost when an edit deletes the whole quoted range', () => {
    const anchor = snapshotAnnotationAnchor('Alpha target Omega', 6, 12)

    expect(
      remapAnnotationAnchor(anchor, {
        from: 6,
        to: 12,
        insert: '',
      })
    ).toMatchObject({
      from: 6,
      to: 6,
      status: 'lost',
    })
  })

  it('reconciles an externally moved quote when context is unique', () => {
    const anchor = snapshotAnnotationAnchor('Alpha target Omega', 6, 12)

    expect(
      reconcileAnnotationAnchor(anchor, 'Moved Alpha target Omega')
    ).toMatchObject({
      from: 12,
      to: 18,
      status: 'anchored',
    })
  })

  it('keeps an anchor lost when the quote appears ambiguously', () => {
    const anchor = snapshotAnnotationAnchor('Alpha target Omega', 6, 12)

    expect(
      reconcileAnnotationAnchor(anchor, 'target appears twice: target')
    ).toMatchObject({
      status: 'lost',
    })
  })
})
