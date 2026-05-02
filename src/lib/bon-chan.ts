export const BON_CHAN_MOODS = ['calmo', 'chateado', 'triste', 'alegre'] as const

export type BonChanMood = (typeof BON_CHAN_MOODS)[number]

export const DEFAULT_BON_CHAN_MOOD: BonChanMood = 'calmo'

interface BonChanSheet {
  file: string
  frameWidth: number
  frameHeight: number
  columns: number
  rows: number
  transparentBackground: boolean
}

interface BonChanAnimation {
  name: string
  frames: number[]
  fps: number
  loop: boolean
}

export interface BonChanManifest {
  name: string
  sheet: BonChanSheet
  animations: Record<BonChanMood, BonChanAnimation>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function normalizeBonChanManifest(raw: unknown): BonChanManifest {
  if (!isRecord(raw)) {
    throw new Error('Bon-chan manifest must be an object.')
  }

  const { name, sheet, animations } = raw
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('Bon-chan manifest must contain a valid name.')
  }

  if (!isRecord(sheet)) {
    throw new Error('Bon-chan manifest must contain a valid sheet object.')
  }

  const parsedSheet: BonChanSheet = {
    file: typeof sheet.file === 'string' ? sheet.file : '',
    frameWidth: Number(sheet.frameWidth),
    frameHeight: Number(sheet.frameHeight),
    columns: Number(sheet.columns),
    rows: Number(sheet.rows),
    transparentBackground: sheet.transparentBackground === true,
  }

  if (
    parsedSheet.file.length === 0 ||
    !isPositiveNumber(parsedSheet.frameWidth) ||
    !isPositiveNumber(parsedSheet.frameHeight) ||
    !isPositiveNumber(parsedSheet.columns) ||
    !isPositiveNumber(parsedSheet.rows)
  ) {
    throw new Error('Bon-chan sheet metadata is invalid.')
  }

  if (!isRecord(animations)) {
    throw new Error('Bon-chan manifest must contain animations.')
  }

  const parsedAnimations = {} as Record<BonChanMood, BonChanAnimation>
  for (const mood of BON_CHAN_MOODS) {
    const animation = animations[mood]
    if (!isRecord(animation)) {
      throw new Error(`Animation "${mood}" is missing from Bon-chan manifest.`)
    }

    const rawFrames = Array.isArray(animation.frames) ? animation.frames : []
    const frames = rawFrames.filter(isNonNegativeInteger)
    const fps = Number(animation.fps)
    const loop = animation.loop === true
    const animationName =
      typeof animation.name === 'string' && animation.name.length > 0
        ? animation.name
        : mood

    if (frames.length === 0 || !isPositiveNumber(fps)) {
      throw new Error(`Animation "${mood}" metadata is invalid.`)
    }

    parsedAnimations[mood] = {
      name: animationName,
      frames,
      fps,
      loop,
    }
  }

  return {
    name,
    sheet: parsedSheet,
    animations: parsedAnimations,
  }
}

export function getSpriteOffset(
  frameIndex: number,
  frameWidth: number,
  frameHeight: number,
  columns: number
) {
  const row = Math.floor(frameIndex / columns)
  const col = frameIndex % columns

  return {
    x: col * frameWidth,
    y: row * frameHeight,
  }
}

export function getNextAnimationCursor(
  currentCursor: number,
  totalFrames: number,
  loop: boolean
) {
  if (totalFrames <= 1) return 0

  const nextCursor = currentCursor + 1
  if (nextCursor < totalFrames) return nextCursor
  return loop ? 0 : totalFrames - 1
}
