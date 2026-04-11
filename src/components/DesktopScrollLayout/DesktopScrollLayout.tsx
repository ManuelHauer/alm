'use client'

/**
 * DesktopScrollLayout — M2 prototype.
 *
 * Acceptance criteria from §M2:
 *   1. Right panel scrolls continuously to advance entries
 *   2. Left panel: horizontal pointer drag for image carousel
 *   3. In-focus entry: number orange (#E8531E), full opacity
 *   4. Out-of-focus entries: 0.4 opacity, 200ms transition
 *   5. Multi-image entries: infinite-looping carousel, dots
 *   6. Text-only entries: blank/light grey left panel
 *
 * Implementation notes:
 *   - Focus detection: scroll listener on right panel, virtual focus
 *     line at 30% from top. isProgrammaticScroll ref blocks the listener
 *     during focusEntry scroll so single-click focus is immediate.
 *   - Image carousel: 3-slot approach (prev / cur / next), all translated
 *     by dragOffset. On commit, slots fly to ±panelWidth, then index
 *     updates and offset resets without transition — no visual jump.
 *   - Infinite loop: wrapIdx = ((i % len) + len) % len. No hard stops.
 *   - Vertical wheel on left panel is forwarded to the right panel.
 *   - Axis lock on pointermove: first 6px of movement decides h vs v.
 *     Vertical drag is released to the browser; horizontal is captured.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import styles from './DesktopScrollLayout.module.css'
import { mockEntries, type MockEntry } from './mockData'

type Props = {
  entries?: MockEntry[]
}

const wrapIdx = (i: number, len: number): number => ((i % len) + len) % len

export default function DesktopScrollLayout({ entries = mockEntries }: Props) {
  const [focusedId, setFocusedId] = useState<string>(entries[0]?.id ?? '')
  const [imageIndices, setImageIndices] = useState<Record<string, number>>({})

  // Visual drag state — triggers re-render for slot positions
  const [dragOffset, setDragOffset] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Drag interaction — refs avoid stale closures in pointer handlers
  const dragOffsetRef = useRef(0)
  const dragStartX = useRef(0)
  const dragStartY = useRef(0)
  const dragAxis = useRef<'h' | 'v' | null>(null)
  const isDragging = useRef(false)

  // Blocks the scroll listener while focusEntry's smooth scroll is in flight
  const isProgrammaticScroll = useRef(false)

  // Horizontal wheel accumulator — builds up deltaX across events until
  // it crosses the threshold, then commits a swipe and enters cooldown
  const wheelAccumX = useRef(0)
  const wheelCooldown = useRef(false)
  // Always holds the latest commitSwipe without re-registering the listener
  const commitSwipeRef = useRef<(direction: 1 | -1) => void>(() => {})

  // Keep dragOffsetRef and state in sync
  const moveDragOffset = useCallback((v: number) => {
    dragOffsetRef.current = v
    setDragOffset(v)
  }, [])

  // DOM refs
  const entryRefs = useRef<Map<string, HTMLElement>>(new Map())
  const setEntryRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) entryRefs.current.set(id, el)
      else entryRefs.current.delete(id)
    },
    [],
  )
  const rightRef = useRef<HTMLElement>(null)
  const leftRef = useRef<HTMLElement>(null)

  // Reset carousel state when focused entry changes
  useEffect(() => {
    moveDragOffset(0)
    setIsTransitioning(false)
    wheelAccumX.current = 0
  }, [focusedId, moveDragOffset])

  // ─── Focus detection ───────────────────────────────────────────
  useEffect(() => {
    const container = rightRef.current
    if (!container) return

    const updateFocus = () => {
      if (isProgrammaticScroll.current) return
      const containerRect = container.getBoundingClientRect()
      const focusLineY = containerRect.top + containerRect.height * 0.3

      let bestId = entries[0]?.id ?? ''
      let bestTop = -Infinity

      for (const [id, el] of entryRefs.current) {
        const top = el.getBoundingClientRect().top
        if (top <= focusLineY && top > bestTop) {
          bestTop = top
          bestId = id
        }
      }

      setFocusedId(bestId)
    }

    container.addEventListener('scroll', updateFocus, { passive: true })
    updateFocus()
    return () => container.removeEventListener('scroll', updateFocus)
  }, [entries])

  // ─── Focus entry (click / keyboard) ───────────────────────────
  const focusEntry = useCallback((id: string) => {
    setFocusedId(id)
    const el = entryRefs.current.get(id)
    const container = rightRef.current
    if (!el || !container) return
    const targetTop = Math.max(0, el.offsetTop - container.clientHeight * 0.3)
    isProgrammaticScroll.current = true
    container.scrollTo({ top: targetTop, behavior: 'smooth' })
    setTimeout(() => {
      isProgrammaticScroll.current = false
    }, 600)
  }, [])

  // ─── Arrow keys ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const focused = entries.find((entry) => entry.id === focusedId)
      if (!focused || focused.images.length <= 1) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      setImageIndices((prev) => {
        const current = prev[focused.id] ?? 0
        const direction = event.key === 'ArrowRight' ? 1 : -1
        return { ...prev, [focused.id]: wrapIdx(current + direction, focused.images.length) }
      })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusedId, entries])

  // ─── Wheel events on left panel ───────────────────────────────
  // Vertical   → forward to right panel (entry navigation)
  // Horizontal → image carousel (accumulate deltaX, commit at threshold)
  useEffect(() => {
    const el = leftRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        // Vertical — drive the right panel
        rightRef.current?.scrollBy({ top: e.deltaY })
      } else {
        // Horizontal — carousel
        if (wheelCooldown.current) return
        wheelAccumX.current += e.deltaX
        if (Math.abs(wheelAccumX.current) > 40) {
          // deltaX positive = swiped right = show prev; negative = next
          const direction = wheelAccumX.current > 0 ? -1 : 1
          wheelAccumX.current = 0
          wheelCooldown.current = true
          commitSwipeRef.current(direction)
          setTimeout(() => {
            wheelCooldown.current = false
          }, 350)
        }
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ─── Derived state ─────────────────────────────────────────────
  const focusedEntry = useMemo(
    () => entries.find((entry) => entry.id === focusedId) ?? entries[0],
    [entries, focusedId],
  )
  const focusedImageIndex = imageIndices[focusedEntry?.id ?? ''] ?? 0
  const focusedImages = focusedEntry?.images ?? []
  const numImages = focusedImages.length

  // ─── Commit a swipe past threshold ────────────────────────────
  // direction: 1 = next (dragged left / scrolled left), -1 = prev (right)
  const commitSwipe = useCallback(
    (direction: 1 | -1) => {
      if (!focusedEntry || focusedEntry.images.length <= 1) return
      const panelWidth = leftRef.current?.clientWidth ?? 600
      const flyTo = direction === 1 ? -panelWidth : panelWidth

      setIsTransitioning(true)
      moveDragOffset(flyTo)

      setTimeout(() => {
        setImageIndices((prev) => {
          const cur = prev[focusedEntry.id] ?? 0
          return {
            ...prev,
            [focusedEntry.id]: wrapIdx(cur + direction, focusedEntry.images.length),
          }
        })
        // Reset without transition — slots are already in final position
        setIsTransitioning(false)
        moveDragOffset(0)
      }, 220)
    },
    [focusedEntry, moveDragOffset],
  )

  // Keep ref current so the wheel handler always calls the latest version
  useEffect(() => {
    commitSwipeRef.current = commitSwipe
  }, [commitSwipe])

  // ─── Pointer handlers for left panel drag ─────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    dragStartX.current = e.clientX
    dragStartY.current = e.clientY
    dragAxis.current = null
    isDragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!isDragging.current || isTransitioning) return
      const dx = e.clientX - dragStartX.current
      const dy = e.clientY - dragStartY.current

      if (dragAxis.current === null) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          dragAxis.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
        }
        return
      }

      if (dragAxis.current === 'h') {
        if (numImages <= 1) return
        e.preventDefault()
        moveDragOffset(dx)
      }
    },
    [isTransitioning, numImages, moveDragOffset],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!isDragging.current) return
      isDragging.current = false

      if (dragAxis.current !== 'h' || numImages <= 1) {
        moveDragOffset(0)
        return
      }

      const panelWidth = leftRef.current?.clientWidth ?? 600
      const threshold = panelWidth * 0.25
      const offset = dragOffsetRef.current

      if (offset > threshold) {
        commitSwipe(-1) // dragged right → show prev
      } else if (offset < -threshold) {
        commitSwipe(1) // dragged left → show next
      } else {
        // Snap back
        setIsTransitioning(true)
        moveDragOffset(0)
        setTimeout(() => setIsTransitioning(false), 220)
      }
    },
    [numImages, commitSwipe, moveDragOffset],
  )

  // ─── Carousel slot indices ─────────────────────────────────────
  const curIdx = numImages > 0 ? wrapIdx(focusedImageIndex, numImages) : 0
  const prevIdx = numImages > 0 ? wrapIdx(focusedImageIndex - 1, numImages) : 0
  const nextIdx = numImages > 0 ? wrapIdx(focusedImageIndex + 1, numImages) : 0
  const slotTransition = isTransitioning ? 'transform 220ms ease' : 'none'

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className={styles.root}>
      {/* LEFT — sticky 60%, pointer-drag carousel */}
      <aside
        ref={leftRef}
        className={`${styles.left} ${numImages > 1 ? styles.leftDraggable : ''}`}
        aria-label="Focused entry image gallery"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className={styles.leftImageStack}>
          {numImages === 0 ? (
            <div className={styles.leftEmpty}>no image</div>
          ) : (
            <>
              {/* Prev slot — only rendered when there are multiple images */}
              {numImages > 1 && (
                <div
                  className={styles.imageSlot}
                  style={{
                    transform: `translateX(calc(-100% + ${dragOffset}px))`,
                    transition: slotTransition,
                  }}
                >
                  <img
                    src={focusedImages[prevIdx]?.image.url}
                    alt={focusedImages[prevIdx]?.image.alt}
                    className={styles.slotImage}
                    draggable={false}
                  />
                </div>
              )}

              {/* Current slot */}
              <div
                className={styles.imageSlot}
                style={{
                  transform: `translateX(${dragOffset}px)`,
                  transition: slotTransition,
                }}
              >
                <img
                  src={focusedImages[curIdx]?.image.url}
                  alt={focusedImages[curIdx]?.image.alt}
                  className={styles.slotImage}
                  draggable={false}
                />
              </div>

              {/* Next slot — only rendered when there are multiple images */}
              {numImages > 1 && (
                <div
                  className={styles.imageSlot}
                  style={{
                    transform: `translateX(calc(100% + ${dragOffset}px))`,
                    transition: slotTransition,
                  }}
                >
                  <img
                    src={focusedImages[nextIdx]?.image.url}
                    alt={focusedImages[nextIdx]?.image.alt}
                    className={styles.slotImage}
                    draggable={false}
                  />
                </div>
              )}
            </>
          )}

          {/* Carousel dots */}
          {numImages > 1 && (
            <div className={styles.dots}>
              {focusedImages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`${styles.dot} ${index === curIdx ? styles.dotActive : ''}`}
                  aria-label={`Show image ${index + 1} of ${numImages}`}
                  aria-pressed={index === curIdx}
                  onClick={() =>
                    setImageIndices((prev) => ({ ...prev, [focusedEntry!.id]: index }))
                  }
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT — 40% continuous scroll container */}
      <section ref={rightRef} className={styles.right}>
        {entries.map((entry) => {
          const isFocused = entry.id === focusedId
          return (
            <article
              key={entry.id}
              ref={setEntryRef(entry.id)}
              data-entry-id={entry.id}
              className={`${styles.entry} ${isFocused ? styles.entryFocused : ''}`}
              onClick={() => focusEntry(entry.id)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                focusEntry(entry.id)
              }}
              tabIndex={0}
            >
              <div className={styles.entryNumber}>
                {String(entry.entryNumber).padStart(3, '0')}
              </div>
              <header className={styles.entryHeader}>
                <h2 className={styles.entryTitle}>{entry.title}</h2>
                <p className={styles.entryMeta}>
                  {[entry.year, entry.place].filter(Boolean).join(' · ')}
                </p>
              </header>
              <div className={styles.entryDescription}>{entry.plainDescription}</div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
