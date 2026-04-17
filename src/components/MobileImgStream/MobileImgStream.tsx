'use client'

/**
 * MobileImgStream — IMG mode as a continuous looping scroll stream.
 *
 * Each entry's images are shown in a card matching MobileEntryView's layout:
 *   entry number (orange) → image(s) with carousel → title + dot indicators
 *   imageless entries mirror the textOnly block.
 *
 * Image height: natural aspect ratio, capped at 72dvh so adjacent cards
 * always peek above and below.
 *
 * Carousel: horizontal swipe within a card cycles through that entry's images
 *   (axis-locked; vertical drag falls through to native scroll).
 * Tap: calls onSelectEntry so the parent can open the full single-entry view.
 *
 * Looping + active-entry detection: identical to MobileTxtView.
 */

import { useDrag } from '@use-gesture/react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import ImageGallery from '@/components/ImageGallery/ImageGallery'
import type { EntryDetail } from '@/types/entry'

import styles from './MobileImgStream.module.css'

export type MobileImgStreamHandle = {
  scrollToEntry: (id: number) => void
}

type Props = {
  entries: EntryDetail[]
  activeEntryId: number
  onActivate: (entry: EntryDetail) => void
  onSelectEntry: (entry: EntryDetail) => void
}

// ─── Per-slot carousel ────────────────────────────────────────────────────────

const AXIS_LOCK_PX = 10
const SWIPE_COMMIT_PX = 50
const CAROUSEL_RESET_DELAY = 330

function wrapIdx(i: number, len: number) {
  return ((i % len) + len) % len
}

type SlotProps = {
  entry: EntryDetail
  isActive: boolean
  slotRef: (el: HTMLDivElement | null) => void
  onSelectEntry: (entry: EntryDetail) => void
}

function Slot({ entry, isActive, slotRef, onSelectEntry }: SlotProps) {
  const hasImages = entry.images.length > 0
  const hasMultipleImages = entry.images.length > 1
  const [imageIndex, setImageIndex] = useState(0)
  const [imageDragOffset, setImageDragOffset] = useState(0)
  const [commitDir, setCommitDir] = useState(0)
  const [isCarouselAnimating, setIsCarouselAnimating] = useState(false)
  const isAnimatingRef = useRef(false)
  const lockedAxis = useRef<'h' | 'v' | null>(null)

  // Reset carousel when entry changes (shouldn't happen since these are fixed
  // slots, but safety net for future)
  useEffect(() => {
    setImageIndex(0)
    setImageDragOffset(0)
    setCommitDir(0)
  }, [entry.id])

  const commitSwipe = useCallback(
    (dir: 1 | -1) => {
      if (isAnimatingRef.current || !hasMultipleImages) return
      isAnimatingRef.current = true
      setIsCarouselAnimating(true)
      setCommitDir(dir)
      setImageDragOffset(0)
      setTimeout(() => {
        setImageIndex((prev) => wrapIdx(prev + dir, entry.images.length))
        isAnimatingRef.current = false
        setIsCarouselAnimating(false)
        setCommitDir(0)
      }, CAROUSEL_RESET_DELAY)
    },
    [entry.images.length, hasMultipleImages],
  )

  const snapBack = useCallback(() => {
    isAnimatingRef.current = true
    setIsCarouselAnimating(true)
    setImageDragOffset(0)
    setTimeout(() => {
      isAnimatingRef.current = false
      setIsCarouselAnimating(false)
    }, CAROUSEL_RESET_DELAY)
  }, [])

  const bind = useDrag(
    ({ tap, first, last, movement: [mx, my], cancel }) => {
      if (tap) {
        onSelectEntry(entry)
        return
      }
      if (first) lockedAxis.current = null

      if (lockedAxis.current === null) {
        if (Math.abs(mx) > AXIS_LOCK_PX || Math.abs(my) > AXIS_LOCK_PX) {
          lockedAxis.current = Math.abs(mx) >= Math.abs(my) ? 'h' : 'v'
        }
      }

      if (lockedAxis.current === 'h') {
        if (!hasMultipleImages || isAnimatingRef.current) { cancel(); return }
        if (!last) setImageDragOffset(mx)
        else if (Math.abs(mx) > SWIPE_COMMIT_PX) commitSwipe(mx < 0 ? 1 : -1)
        else snapBack()
      }
      // 'v' — do nothing, native scroll takes over
    },
    { filterTaps: true, pointer: { touch: true } },
  )

  const entryNumberStr = String(entry.entryNumber).padStart(3, '0')
  const primaryImage = entry.images[0]?.image
  const aspectRatio =
    primaryImage && primaryImage.width > 0 && primaryImage.height > 0
      ? primaryImage.width / primaryImage.height
      : undefined

  return (
    <div
      ref={slotRef}
      className={`${styles.slot} ${isActive ? styles.slotActive : ''}`}
      {...bind()}
    >
      <span className={styles.entryNumber}>{entryNumberStr}</span>

      {hasImages ? (
        <>
          <div
            className={styles.imageWrap}
            style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
          >
            <ImageGallery
              images={entry.images}
              currentIndex={imageIndex}
              dragOffset={imageDragOffset}
              commitDir={commitDir}
              isTransitioning={isCarouselAnimating}
              sizeHint="medium"
            />
          </div>

          <div className={styles.imageFooter}>
            <span className={styles.title}>{entry.title}</span>
            {hasMultipleImages && (
              <div className={styles.dots} aria-hidden="true">
                {entry.images.map((_, i) => (
                  <span
                    key={i}
                    className={`${styles.dot} ${i === imageIndex ? styles.dotActive : ''}`}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={styles.textOnly}>
          <span className={styles.textOnlyTitle}>{entry.title}</span>
          {entry.plainDescription && (
            <span className={styles.textOnlyDescription}>{entry.plainDescription}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Scroll stream ────────────────────────────────────────────────────────────

const FOCUS_LINE_RATIO = 0.5
const COPIES = 3

const MobileImgStream = forwardRef<MobileImgStreamHandle, Props>(function MobileImgStream(
  { entries, activeEntryId, onActivate, onSelectEntry },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const hasInitialScrolled = useRef(false)

  const entryScrollOffsetsRef = useRef<Map<number, number>>(new Map())
  const middleStartRef = useRef(0)
  const middleHeightRef = useRef(0)

  const computeScrollOffsets = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const cTop = container.getBoundingClientRect().top
    const map = new Map<number, number>()
    for (const entry of entries) {
      const el = slotRefs.current.get(`${entry.id}-1`)
      if (!el) continue
      map.set(entry.id, el.getBoundingClientRect().top - cTop + container.scrollTop)
    }
    entryScrollOffsetsRef.current = map
  }, [entries])

  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const firstMiddle = slotRefs.current.get(`${entries[0].id}-1`)
    const firstPost = slotRefs.current.get(`${entries[0].id}-2`)
    if (!firstMiddle || !firstPost) return
    const cTop = container.getBoundingClientRect().top
    middleStartRef.current =
      firstMiddle.getBoundingClientRect().top - cTop + container.scrollTop
    middleHeightRef.current =
      firstPost.getBoundingClientRect().top - cTop + container.scrollTop - middleStartRef.current
    computeScrollOffsets()
  }, [entries, computeScrollOffsets])

  useEffect(() => {
    window.addEventListener('resize', computeScrollOffsets, { passive: true })
    return () => window.removeEventListener('resize', computeScrollOffsets)
  }, [computeScrollOffsets])

  const isProgrammaticScrollRef = useRef(false)
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial scroll: jump instantly to active entry in the middle set.
  // Suppress scroll detection while the jump settles.
  useLayoutEffect(() => {
    if (hasInitialScrolled.current) return
    const container = scrollRef.current
    if (!container) return
    const el = slotRefs.current.get(`${activeEntryId}-1`)
    if (!el) return

    isProgrammaticScrollRef.current = true
    if (programmaticScrollTimerRef.current !== null)
      clearTimeout(programmaticScrollTimerRef.current)

    const cRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    container.scrollTop =
      elRect.top - cRect.top + container.scrollTop - cRect.height * FOCUS_LINE_RATIO
    hasInitialScrolled.current = true

    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false
    }, 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    scrollToEntry: (id: number) => {
      const container = scrollRef.current
      if (!container) return
      const el = slotRefs.current.get(`${id}-1`)
      if (!el) return
      const cRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      container.scrollTo({
        top: elRect.top - cRect.top + container.scrollTop - cRect.height * FOCUS_LINE_RATIO,
        behavior: 'smooth',
      })
    },
  }))

  const isTeleportingRef = useRef(false)
  const detectRafRef = useRef<number | null>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const onScroll = () => {
      const middleStart = middleStartRef.current
      const middleHeight = middleHeightRef.current
      if (middleHeight > 0) {
        const st = container.scrollTop
        if (st < middleStart || st >= middleStart + middleHeight) {
          isTeleportingRef.current = true
          container.scrollTop = st < middleStart ? st + middleHeight : st - middleHeight
          requestAnimationFrame(() => { isTeleportingRef.current = false })
          return
        }
      }

      if (isTeleportingRef.current) return
      if (isProgrammaticScrollRef.current) return

      if (detectRafRef.current !== null) return
      detectRafRef.current = requestAnimationFrame(() => {
        detectRafRef.current = null
        const scrollTop = container.scrollTop
        const threshold = scrollTop + container.clientHeight * FOCUS_LINE_RATIO

        let bestId: number | null = null
        let bestOffset = -Infinity
        for (const [id, offset] of entryScrollOffsetsRef.current) {
          if (offset <= threshold && offset > bestOffset) {
            bestOffset = offset
            bestId = id
          }
        }

        if (bestId !== null && bestId !== activeEntryId) {
          const entry = entries.find((e) => e.id === bestId)
          if (entry) {
            onActivate(entry)
            try { window.history.replaceState(null, '', `/entry/${entry.slug}`) } catch { /* ignore */ }
          }
        }
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (detectRafRef.current !== null) {
        cancelAnimationFrame(detectRafRef.current)
        detectRafRef.current = null
      }
    }
  }, [entries, activeEntryId, onActivate])

  const loopedEntries = Array.from({ length: COPIES }).flatMap((_, copy) =>
    entries.map((e) => ({ entry: e, copy })),
  )

  return (
    <div ref={scrollRef} className={styles.root}>
      {loopedEntries.map(({ entry, copy }) => {
        const key = `${entry.id}-${copy}`
        return (
          <Slot
            key={key}
            entry={entry}
            isActive={entry.id === activeEntryId}
            slotRef={(el) => {
              if (el) slotRefs.current.set(key, el)
              else slotRefs.current.delete(key)
            }}
            onSelectEntry={onSelectEntry}
          />
        )
      })}
    </div>
  )
})

export default MobileImgStream
