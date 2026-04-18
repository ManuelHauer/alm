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
 * Looping: single-copy list. When the user scrolls past the last entry (or
 * before the first), scrollTop teleports to the opposite end. With 200+
 * entries the list is long enough that the seam is rarely hit.
 *
 * Performance:
 *   - Slot is React.memo'd — only re-renders on own-prop changes.
 *   - onActivate is throttled to ≤1 call per 150ms (prevents parent re-render flood).
 *   - history.replaceState is throttled to ≤1 call per 300ms (prevents iOS Safari crash).
 *   - IntersectionObserver controls image mount/unmount (nearViewport).
 */

import { useDrag } from '@use-gesture/react'
import {
  forwardRef,
  memo,
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

const AXIS_LOCK_PX = 6
const SWIPE_COMMIT_PX = 40
const CAROUSEL_RESET_DELAY = 330

function wrapIdx(i: number, len: number) {
  return ((i % len) + len) % len
}

type SlotProps = {
  entry: EntryDetail
  isActive: boolean
  nearViewport: boolean
  slotRef: (el: HTMLDivElement | null) => void
  onSelectEntry: (entry: EntryDetail) => void
  scrollContainer: React.RefObject<HTMLDivElement | null>
}

const Slot = memo(function Slot({
  entry,
  isActive,
  nearViewport,
  slotRef,
  onSelectEntry,
  scrollContainer,
}: SlotProps) {
  const hasImages = entry.images.length > 0
  const hasMultipleImages = entry.images.length > 1
  const [imageIndex, setImageIndex] = useState(0)
  const [imageDragOffset, setImageDragOffset] = useState(0)
  const [commitDir, setCommitDir] = useState(0)
  const [isCarouselAnimating, setIsCarouselAnimating] = useState(false)
  const isAnimatingRef = useRef(false)
  const lockedAxis = useRef<'h' | 'v' | null>(null)
  const prevMy = useRef(0)

  // Reset carousel when entry changes
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
      if (first) {
        lockedAxis.current = null
        prevMy.current = 0
      }

      if (lockedAxis.current === null) {
        if (Math.abs(mx) > AXIS_LOCK_PX || Math.abs(my) > AXIS_LOCK_PX) {
          lockedAxis.current = Math.abs(mx) >= Math.abs(my) * 0.6 ? 'h' : 'v'
        }
      }

      if (lockedAxis.current === 'h') {
        if (!hasMultipleImages || isAnimatingRef.current) { cancel(); return }
        if (!last) setImageDragOffset(mx)
        else if (Math.abs(mx) > SWIPE_COMMIT_PX) commitSwipe(mx < 0 ? 1 : -1)
        else snapBack()
      } else if (lockedAxis.current === 'v' && hasMultipleImages) {
        const delta = my - prevMy.current
        prevMy.current = my
        scrollContainer.current?.scrollBy(0, -delta)
      }
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
            className={`${styles.imageWrap} ${hasMultipleImages ? styles.imageWrapMulti : ''}`}
            style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
          >
            {nearViewport ? (
              <ImageGallery
                images={entry.images}
                currentIndex={imageIndex}
                dragOffset={imageDragOffset}
                commitDir={commitDir}
                isTransitioning={isCarouselAnimating}
                sizeHint="thumbnail"
              />
            ) : null}
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
})

// ─── Scroll stream ────────────────────────────────────────────────────────────

const FOCUS_LINE_RATIO = 0.5
// How close (in px) the user must scroll to the top/bottom edge before we
// teleport to the opposite end. Large enough to trigger before the browser
// shows overscroll but small enough to be invisible at normal scroll speed.
const TELEPORT_THRESHOLD_PX = 200

const MobileImgStream = forwardRef<MobileImgStreamHandle, Props>(function MobileImgStream(
  { entries, activeEntryId, onActivate, onSelectEntry },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const hasInitialScrolled = useRef(false)

  const activeEntryIdRef = useRef(activeEntryId)
  activeEntryIdRef.current = activeEntryId

  // Pre-computed scroll offsets for active-entry detection (hot path).
  const entryScrollOffsetsRef = useRef<Map<number, number>>(new Map())

  const computeScrollOffsets = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const cTop = container.getBoundingClientRect().top
    const map = new Map<number, number>()
    for (const entry of entries) {
      const el = slotRefs.current.get(String(entry.id))
      if (!el) continue
      map.set(entry.id, el.getBoundingClientRect().top - cTop + container.scrollTop)
    }
    entryScrollOffsetsRef.current = map
  }, [entries])

  useLayoutEffect(() => {
    computeScrollOffsets()
  }, [entries, computeScrollOffsets])

  useEffect(() => {
    window.addEventListener('resize', computeScrollOffsets, { passive: true })
    return () => window.removeEventListener('resize', computeScrollOffsets)
  }, [computeScrollOffsets])

  const isProgrammaticScrollRef = useRef(false)
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial scroll: jump instantly to active entry.
  useLayoutEffect(() => {
    if (hasInitialScrolled.current) return
    const container = scrollRef.current
    if (!container) return
    const el = slotRefs.current.get(String(activeEntryId))
    if (!el) return

    isProgrammaticScrollRef.current = true
    if (programmaticScrollTimerRef.current !== null)
      clearTimeout(programmaticScrollTimerRef.current)

    const cRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    container.scrollTop =
      elRect.top - cRect.top + container.scrollTop + elRect.height / 2 - cRect.height / 2
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
      const el = slotRefs.current.get(String(id))
      if (!el) return
      const cRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      container.scrollTo({
        top: elRect.top - cRect.top + container.scrollTop - cRect.height * FOCUS_LINE_RATIO,
        behavior: 'smooth',
      })
    },
  }))

  // ── Throttled onActivate — max 1 call per 150ms ─────────────────────────────
  const activateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingActivateRef = useRef<EntryDetail | null>(null)

  const throttledActivate = useCallback(
    (entry: EntryDetail) => {
      pendingActivateRef.current = entry
      if (activateTimerRef.current !== null) return // already scheduled
      activateTimerRef.current = setTimeout(() => {
        activateTimerRef.current = null
        const pending = pendingActivateRef.current
        if (pending && pending.id !== activeEntryIdRef.current) {
          onActivate(pending)
        }
        pendingActivateRef.current = null
      }, 150)
    },
    [onActivate],
  )

  // ── Throttled history.replaceState — max 1 call per 300ms ───────────────────
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSlugRef = useRef<string | null>(null)

  const throttledReplaceState = useCallback((slug: string) => {
    pendingSlugRef.current = slug
    if (historyTimerRef.current !== null) return
    historyTimerRef.current = setTimeout(() => {
      historyTimerRef.current = null
      const slug = pendingSlugRef.current
      if (slug) {
        try { window.history.replaceState(null, '', `/entry/${slug}`) } catch { /* ignore */ }
      }
      pendingSlugRef.current = null
    }, 300)
  }, [])

  const isTeleportingRef = useRef(false)
  const detectRafRef = useRef<number | null>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const onScroll = () => {
      // ── Edge teleport: jump to opposite end when near top/bottom ──
      const st = container.scrollTop
      const maxScroll = container.scrollHeight - container.clientHeight

      if (maxScroll > 0 && !isTeleportingRef.current) {
        if (st <= TELEPORT_THRESHOLD_PX) {
          // Near top → jump to corresponding position near bottom.
          // We want the same entry visible, so offset from the bottom by the
          // same distance the current position is from the top of the list.
          isTeleportingRef.current = true
          container.scrollTop = maxScroll - TELEPORT_THRESHOLD_PX + st
          requestAnimationFrame(() => { isTeleportingRef.current = false })
          return
        }
        if (st >= maxScroll - TELEPORT_THRESHOLD_PX) {
          // Near bottom → jump to corresponding position near top.
          isTeleportingRef.current = true
          container.scrollTop = TELEPORT_THRESHOLD_PX - (maxScroll - st)
          requestAnimationFrame(() => { isTeleportingRef.current = false })
          return
        }
      }

      if (isTeleportingRef.current) return
      if (isProgrammaticScrollRef.current) return

      // ── Active entry detection — throttled to one RAF per scroll burst ──
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

        if (bestId !== null && bestId !== activeEntryIdRef.current) {
          const entry = entries.find((e) => e.id === bestId)
          if (entry) {
            throttledActivate(entry)
            throttledReplaceState(entry.slug)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, throttledActivate, throttledReplaceState])

  // ── Viewport-aware rendering: only mount images for nearby slots ──
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    observerRef.current = new IntersectionObserver(
      (ioEntries) => {
        setVisibleKeys((prev) => {
          const next = new Set(prev)
          for (const ioe of ioEntries) {
            const key = (ioe.target as HTMLElement).dataset.slotKey
            if (!key) continue
            if (ioe.isIntersecting) next.add(key)
            else next.delete(key)
          }
          return next
        })
      },
      { root: container, rootMargin: '200% 0px' },
    )

    for (const el of slotRefs.current.values()) {
      observerRef.current.observe(el)
    }

    return () => { observerRef.current?.disconnect() }
  }, [entries])

  return (
    <div ref={scrollRef} className={styles.root}>
      {entries.map((entry) => {
        const key = String(entry.id)
        return (
          <Slot
            key={key}
            entry={entry}
            isActive={entry.id === activeEntryId}
            nearViewport={visibleKeys.has(key)}
            slotRef={(el) => {
              if (el) {
                slotRefs.current.set(key, el)
                el.dataset.slotKey = key
                observerRef.current?.observe(el)
              } else {
                const prev = slotRefs.current.get(key)
                if (prev) observerRef.current?.unobserve(prev)
                slotRefs.current.delete(key)
              }
            }}
            onSelectEntry={onSelectEntry}
            scrollContainer={scrollRef}
          />
        )
      })}
    </div>
  )
})

export default MobileImgStream
