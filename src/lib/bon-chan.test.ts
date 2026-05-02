import { describe, expect, it } from 'vitest'
import { getNextAnimationCursor, getSpriteOffset } from './bon-chan'

describe('bon-chan animation helpers', () => {
  it('computes sprite offsets using row-major indexing', () => {
    expect(getSpriteOffset(0, 64, 64, 4)).toEqual({ x: 0, y: 0 })
    expect(getSpriteOffset(5, 64, 64, 4)).toEqual({ x: 64, y: 64 })
    expect(getSpriteOffset(15, 64, 64, 4)).toEqual({ x: 192, y: 192 })
  })

  it('advances frame cursor and loops correctly', () => {
    expect(getNextAnimationCursor(0, 4, true)).toBe(1)
    expect(getNextAnimationCursor(3, 4, true)).toBe(0)
    expect(getNextAnimationCursor(3, 4, false)).toBe(3)
    expect(getNextAnimationCursor(0, 1, true)).toBe(0)
  })
})
