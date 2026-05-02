import { useEffect, useState } from 'react'
import bonChanManifestRaw from '../../../assets/bon-chan.json'
import bonChanSpritesheetUrl from '../../../assets/bon-chan-spritesheet.png'
import {
  getNextAnimationCursor,
  getSpriteOffset,
  normalizeBonChanManifest,
  type BonChanMood,
} from '@/lib/bon-chan'
import { useUIStore } from '@/store/ui-store'

const bonChanManifest = normalizeBonChanManifest(bonChanManifestRaw)
const DISPLAY_SCALE = 2

export function BonChanPet() {
  const bonChanMood = useUIStore(state => state.bonChanMood)

  return <BonChanPetSprite key={bonChanMood} bonChanMood={bonChanMood} />
}

interface BonChanPetSpriteProps {
  bonChanMood: BonChanMood
}

function BonChanPetSprite({ bonChanMood }: BonChanPetSpriteProps) {
  const animation = bonChanManifest.animations[bonChanMood]
  const [frameCursor, setFrameCursor] = useState(0)

  useEffect(() => {
    if (animation.frames.length <= 1 || animation.fps <= 0) return

    const frameDurationMs = 1000 / animation.fps
    let animationFrameId = 0
    let elapsedMs = 0
    let lastTimestamp = performance.now()
    let currentCursor = 0

    const tick = (timestamp: number) => {
      elapsedMs += timestamp - lastTimestamp
      lastTimestamp = timestamp

      let hasNewFrame = false
      while (elapsedMs >= frameDurationMs) {
        elapsedMs -= frameDurationMs
        currentCursor = getNextAnimationCursor(
          currentCursor,
          animation.frames.length,
          animation.loop
        )
        hasNewFrame = true
      }

      if (hasNewFrame) {
        setFrameCursor(currentCursor)
      }

      animationFrameId = requestAnimationFrame(tick)
    }

    animationFrameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [animation.fps, animation.frames.length, animation.loop])

  const frameIndex = animation.frames[frameCursor] ?? animation.frames[0] ?? 0
  const { frameWidth, frameHeight, columns } = bonChanManifest.sheet
  const scaledFrameWidth = frameWidth * DISPLAY_SCALE
  const scaledFrameHeight = frameHeight * DISPLAY_SCALE
  const scaledSheetWidth = bonChanManifest.sheet.columns * scaledFrameWidth
  const scaledSheetHeight = bonChanManifest.sheet.rows * scaledFrameHeight
  const frameOffset = getSpriteOffset(
    frameIndex,
    frameWidth,
    frameHeight,
    columns
  )

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-end px-4 pb-4">
      <div
        role="img"
        aria-label={`Bon-chan ${bonChanMood}`}
        className="pointer-events-none select-none"
        style={{
          width: `${scaledFrameWidth}px`,
          height: `${scaledFrameHeight}px`,
          backgroundImage: `url(${bonChanSpritesheetUrl})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `-${frameOffset.x * DISPLAY_SCALE}px -${frameOffset.y * DISPLAY_SCALE}px`,
          backgroundSize: `${scaledSheetWidth}px ${scaledSheetHeight}px`,
          backgroundColor: 'transparent',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  )
}
