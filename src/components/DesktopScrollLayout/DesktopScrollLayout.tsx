'use client'

/**
 * DesktopScrollLayout — 3-column layout for ≥768px viewports.
 *
 * Columns (left → right):
 *   1. NavRail (fixed --rail-width ≈ 69px) — logo top, links centered.
 *   2. Image column (sticky 100vh, default ~66% of remaining space):
 *      - Focused entry image at natural aspect ratio (object-fit: contain).
 *      - Entry number top-left, title bottom-left, dots bottom-center.
 *      - Floating search icon top-right (corner gradient).
 *      - Pointer-drag + horizontal wheel for carousel.
 *   3. Drag divider (4px, cursor: col-resize).
 *   4. Text column (flex: 1, continuous loop scroll, same as MobileTxtView):
 *      - Scroll drives focus → image column reacts.
 *      - Click entry → focus that entry in image column.
 *
 * No IMG/TXT toggle. No BottomNav. Both panels always visible.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import MobileNavRail from '@/components/MobileNavRail/MobileNavRail'
import MobileTxtView, { type MobileTxtViewHandle } from '@/components/MobileTxtView/MobileTxtView'
import type { EntryDetail } from '@/types/entry'

import styles from './DesktopScrollLayout.module.css'

type Props = {
  entries: EntryDetail[]
  initialSlug?: string
  showBack?: boolean
  shopUrl?: string | null
  instagramUrl?: string | null
}

const wrapIdx = (i: number, len: number): number => ((i % len) + len) % len

const CAROUSEL_ANIM_MS = 300
const CAROUSEL_RESET_DELAY = 330
// iOS-style easing: gentle acceleration in, fast mid, gentle deceleration out
const CAROUSEL_EASING = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'

export default function DesktopScrollLayout({ entries, initialSlug, showBack = false, shopUrl, instagramUrl }: Props) {
  const [focusedId, setFocusedId] = useState<number>(() => {
    if (initialSlug) {
      const match = entries.find((e) => e.slug === initialSlug)
      if (match) return match.id
    }
    return entries[0]?.id ?? 0
  })
  const [imageIndex, setImageIndex] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  // commitDir drives the commit animation using CSS % (not pixels) so slots
  // always land exactly at slot boundaries — no overshoot regardless of drag.
  const [commitDir, setCommitDir] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const isTransitioningRef = useRef(false)

  // ── Resizable split ─────────────────────────────────────────────
  // Fraction of (viewport - rail) given to the image column. Default ~66%.
  const [splitFraction, setSplitFraction] = useState(0.74)
  const isDividerDragging = useRef(false)
  const dividerStartX = useRef(0)
  const dividerStartFraction = useRef(0.74)
  // Rail is always --rail-width (69px); no ref needed.
  const RAIL_W = 69

  // ── Text column ref — for imperative scroll-to-entry ────────────
  const txtViewRef = useRef<MobileTxtViewHandle>(null)
  // Tracks whether focus last changed from keyboard (should scroll text col)
  // vs. from text col scroll (should not scroll — would feedback-loop).
  const focusSourceRef = useRef<'keyboard' | 'scroll'>('scroll')

  // ── Image column ref — for dimension measurement ─────────────────
  const imageColRef = useRef<HTMLElement>(null)
  const [imgContainerSize, setImgContainerSize] = useState<{
    width: number
    height: number
  } | null>(null)

  const focusedEntry = useMemo(
    () => entries.find((e) => e.id === focusedId) ?? entries[0],
    [entries, focusedId],
  )

  const focusedImages = focusedEntry?.images ?? []
  const numImages = focusedImages.length
  const curIdx = numImages > 0 ? wrapIdx(imageIndex, numImages) : 0
  const prevIdx = numImages > 0 ? wrapIdx(imageIndex - 1, numImages) : 0
  const nextIdx = numImages > 0 ? wrapIdx(imageIndex + 1, numImages) : 0

  // Reset carousel when focused entry changes
  useEffect(() => {
    setImageIndex(0)
    setDragOffset(0)
    setCommitDir(0)
    setIsTransitioning(false)
  }, [focusedId])

  // ── Measure image column to compute rendered image bounds ────────
  useEffect(() => {
    const col = imageColRef.current
    if (!col) return
    const measure = () => {
      setImgContainerSize({ width: col.clientWidth, height: col.clientHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(col)
    return () => ro.disconnect()
  }, [])

  // Compute stack width and inner height separately so entryNumber/title can
  // share the same width as the image without being overlaid on it.
  // IMG_COL_PADDING is subtracted so the carousel never touches column edges.
  // maxH reduced to 0.78 to leave room above/below for the text labels.
  const IMG_COL_PADDING = 20 // px each side
  const imageSize = useMemo(() => {
    if (!imgContainerSize || !focusedImages[curIdx]?.image) return null
    const { width: colW, height: colH } = imgContainerSize
    const availW = colW - IMG_COL_PADDING * 2
    const img = focusedImages[curIdx].image
    const maxH = colH * 0.78
    const aspect = img.width / img.height
    let w: number, h: number
    if (availW / maxH > aspect) {
      // Height-constrained (portrait or very tall)
      h = maxH
      w = h * aspect
    } else {
      // Width-constrained (landscape)
      w = availW
      h = w / aspect
    }
    return { stackWidth: `${w}px`, innerHeight: `${h}px` }
  }, [imgContainerSize, focusedImages, curIdx])

  // ── Carousel commit ──────────────────────────────────────────────
  // Uses CSS % (via commitDir) instead of pixels so the slot always lands
  // at exactly ±100% regardless of drag offset — eliminates overshoot/bounce.
  const commitSwipe = useCallback(
    (direction: 1 | -1) => {
      if (numImages <= 1 || isTransitioningRef.current) return
      isTransitioningRef.current = true
      setIsTransitioning(true)
      setCommitDir(direction) // animates slots by ±100%
      setDragOffset(0)        // animate drag portion back to 0
      setTimeout(() => {
        setImageIndex((prev) => wrapIdx(prev + direction, numImages))
        isTransitioningRef.current = false
        setIsTransitioning(false)
        setCommitDir(0) // reset without animation (transition: none)
      }, CAROUSEL_RESET_DELAY)
    },
    [numImages],
  )
  const commitSwipeRef = useRef(commitSwipe)
  useEffect(() => {
    commitSwipeRef.current = commitSwipe
  }, [commitSwipe])

  // ── Keyboard navigation ──────────────────────────────────────────
  // Keep a ref so the event handler always reads the latest focusedId
  // without needing to re-attach on every focus change.
  const focusedIdRef = useRef(focusedId)
  useEffect(() => { focusedIdRef.current = focusedId }, [focusedId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      e.preventDefault()
      if (e.key === 'ArrowDown') {
        const idx = entries.findIndex((en) => en.id === focusedIdRef.current)
        if (idx !== -1) {
          const newEntry = entries[(idx + 1) % entries.length]
          focusSourceRef.current = 'keyboard'
          setFocusedId(newEntry.id)
          // Scroll after React commits the new activeEntryId to MobileTxtView
          setTimeout(() => txtViewRef.current?.scrollToEntry(newEntry.id), 0)
        }
      } else if (e.key === 'ArrowUp') {
        const idx = entries.findIndex((en) => en.id === focusedIdRef.current)
        if (idx !== -1) {
          const newEntry = entries[((idx - 1) + entries.length) % entries.length]
          focusSourceRef.current = 'keyboard'
          setFocusedId(newEntry.id)
          setTimeout(() => txtViewRef.current?.scrollToEntry(newEntry.id), 0)
        }
      } else if (e.key === 'ArrowLeft') {
        commitSwipeRef.current(-1)
      } else if (e.key === 'ArrowRight') {
        commitSwipeRef.current(1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [entries]) // entries is stable (from props)

  // ── Pointer drag on image column ─────────────────────────────────
  const dragStartX = useRef(0)
  const dragStartY = useRef(0)
  const dragAxis = useRef<'h' | 'v' | null>(null)
  const isDraggingImg = useRef(false)
  const dragOffsetRef = useRef(0)
  // RAF handle — throttles state updates to once per frame during drag
  const dragRafRef = useRef<number | null>(null)

  const handleImgPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    dragStartX.current = e.clientX
    dragStartY.current = e.clientY
    dragAxis.current = null
    isDraggingImg.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handleImgPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingImg.current || isTransitioning) return
      const dx = e.clientX - dragStartX.current
      const dy = e.clientY - dragStartY.current
      if (dragAxis.current === null) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          dragAxis.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
        }
        return
      }
      if (dragAxis.current === 'h' && numImages > 1) {
        dragOffsetRef.current = dx
        // Throttle React state updates to one per animation frame to avoid
        // triggering a re-render on every pointer event (can be 120+/s).
        if (dragRafRef.current === null) {
          dragRafRef.current = requestAnimationFrame(() => {
            setDragOffset(dragOffsetRef.current)
            dragRafRef.current = null
          })
        }
      }
    },
    [isTransitioning, numImages],
  )

  const handleImgPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingImg.current) return
      isDraggingImg.current = false
      // Cancel any pending RAF so the final state is set synchronously below
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current)
        dragRafRef.current = null
      }
      if (dragAxis.current !== 'h' || numImages <= 1) {
        setDragOffset(0)
        return
      }
      const threshold = (imageColRef.current?.clientWidth ?? 800) * 0.05
      const offset = dragOffsetRef.current
      if (offset > threshold) commitSwipe(-1)
      else if (offset < -threshold) commitSwipe(1)
      else {
        setIsTransitioning(true)
        setDragOffset(0)
        setTimeout(() => setIsTransitioning(false), CAROUSEL_ANIM_MS)
      }
    },
    [numImages, commitSwipe],
  )

  // ── Wheel on image column ────────────────────────────────────────
  const wheelAccumX = useRef(0)
  const wheelCooldown = useRef(false)
  useEffect(() => {
    const col = imageColRef.current
    if (!col) return
    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) return
      e.preventDefault()
      if (wheelCooldown.current) return
      wheelAccumX.current += e.deltaX
      if (Math.abs(wheelAccumX.current) > 80) {
        const dir = wheelAccumX.current > 0 ? 1 : -1
        wheelAccumX.current = 0
        wheelCooldown.current = true
        commitSwipeRef.current(dir)
        setTimeout(() => { wheelCooldown.current = false }, 500)
      }
    }
    col.addEventListener('wheel', handler, { passive: false })
    return () => col.removeEventListener('wheel', handler)
  }, [])

  // ── Divider drag ─────────────────────────────────────────────────
  const handleDividerPointerDown = useCallback((e: React.PointerEvent) => {
    isDividerDragging.current = true
    dividerStartX.current = e.clientX
    dividerStartFraction.current = splitFraction
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [splitFraction])

  const handleDividerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDividerDragging.current) return
    const available = window.innerWidth - RAIL_W
    const dx = e.clientX - dividerStartX.current
    const newFraction = Math.min(
      0.85,
      Math.max(0.3, dividerStartFraction.current + dx / available),
    )
    setSplitFraction(newFraction)
  }, [])

  const handleDividerPointerUp = useCallback(() => {
    // After divider drag ends, recompute MobileTxtView's cached scroll
    // offsets (they became stale during the resize) before re-enabling
    // scroll-driven focus detection.
    requestAnimationFrame(() => {
      txtViewRef.current?.recomputeOffsets()
      // Re-enable detection after a frame so the fresh offsets are used
      setTimeout(() => { isDividerDragging.current = false }, 50)
    })
  }, [])

  const slotTransition = isTransitioning ? `transform ${CAROUSEL_ANIM_MS}ms ${CAROUSEL_EASING}` : 'none'
  const entryNumberStr = String(focusedEntry?.entryNumber ?? 0).padStart(3, '0')

  return (
    <div className={styles.root}>
      {/* ── 1. Nav rail ─────────────────────────────────────────── */}
      <MobileNavRail desktop shopUrl={shopUrl} instagramUrl={instagramUrl} />

      {/* ── 2. Image column ─────────────────────────────────────── */}
      <aside
        ref={imageColRef}
        className={`${styles.imageCol} ${numImages > 1 ? styles.imageColDraggable : ''}`}
        style={{ flex: `0 0 calc((100% - var(--rail-width)) * ${splitFraction})` }}
        onPointerDown={handleImgPointerDown}
        onPointerMove={handleImgPointerMove}
        onPointerUp={handleImgPointerUp}
        onPointerCancel={handleImgPointerUp}
      >
        {/* Search icon — top-right corner. stopPropagation prevents the imageCol's
            setPointerCapture from stealing the click before the link fires. */}
        <a
          href="/search"
          className={styles.searchBtn}
          aria-label="Search"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/search.svg" alt="" className={styles.searchIcon} aria-hidden="true" />
        </a>

        {/* Back-to-search button — shown only when arriving from /search */}
        {showBack && (
          <a
            href="/search"
            className={styles.backBtn}
            onPointerDown={(e) => e.stopPropagation()}
          >
            ← Search
          </a>
        )}

        {/* Centered image stack — number above, carousel, title below */}
        <div className={styles.imageOuter}>
          {focusedImages.length === 0 ? (
            <div className={styles.imageEmpty}>
              <span className={styles.imageEmptyNumber}>{entryNumberStr}</span>
              <span className={styles.imageEmptyTitle}>{focusedEntry?.title}</span>
              {focusedEntry?.plainDescription && (
                <span className={styles.imageEmptyDesc}>{focusedEntry.plainDescription}</span>
              )}
            </div>
          ) : (
            /* imageStack shares the computed image width so number/title
               align with the image edges rather than the full column. */
            <div
              className={styles.imageStack}
              style={{ width: imageSize?.stackWidth ?? undefined }}
            >
              {/* Entry number — above image */}
              <span className={styles.entryNumber}>{entryNumberStr}</span>

              {/* Carousel — image only */}
              <div
                className={styles.imageInner}
                style={{ height: imageSize?.innerHeight ?? undefined }}
              >
                {/* 3-slot carousel */}
                <div className={styles.carouselClip}>
                  {[
                    { slot: -1, idx: prevIdx },
                    { slot: 0, idx: curIdx },
                    { slot: 1, idx: nextIdx },
                  ].map(({ slot, idx }) => (
                    <div
                      key={slot}
                      className={styles.carouselSlot}
                      style={{
                        transform: `translateX(calc(${slot * 100}% + ${dragOffset}px + ${commitDir * -100}%))`,
                        transition: slotTransition,
                      }}
                    >
                      {focusedImages[idx]?.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            focusedImages[idx].image.sizes?.medium?.url ??
                            focusedImages[idx].image.url
                          }
                          alt={focusedImages[idx].image.alt}
                          className={styles.slotImg}
                          draggable={false}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Invisible side click zones — advance carousel without visual indicators */}
                {numImages > 1 && (
                  <>
                    <button
                      type="button"
                      className={styles.carouselPrevZone}
                      onClick={() => commitSwipe(-1)}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label="Previous image"
                    />
                    <button
                      type="button"
                      className={styles.carouselNextZone}
                      onClick={() => commitSwipe(1)}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label="Next image"
                    />
                  </>
                )}
              </div>

              {/* Footer: title left + dots right, same row */}
              <div className={styles.imageFooter}>
                <span className={styles.imageTitle}>{focusedEntry?.title}</span>
                {numImages > 1 && (
                  <div className={styles.dots}>
                    {focusedImages.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`${styles.dot} ${i === curIdx ? styles.dotActive : ''}`}
                        onClick={() => setImageIndex(i)}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-label={`Image ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── 3. Drag divider ─────────────────────────────────────── */}
      <div
        className={styles.divider}
        onPointerDown={handleDividerPointerDown}
        onPointerMove={handleDividerPointerMove}
        onPointerUp={handleDividerPointerUp}
        onPointerCancel={handleDividerPointerUp}
      />

      {/* ── 4. Text column ──────────────────────────────────────── */}
      <div className={styles.textCol}>
        <MobileTxtView
          ref={txtViewRef}
          entries={entries}
          activeEntryId={focusedId}
          onActivate={(entry) => {
            // Ignore scroll-driven focus changes while the divider is being
            // dragged — the text column is resizing and offsets are stale.
            if (isDividerDragging.current) return
            focusSourceRef.current = 'scroll'
            setFocusedId(entry.id)
          }}
          onSelectEntry={(entry) => setFocusedId(entry.id)}
        />
      </div>
    </div>
  )
}
