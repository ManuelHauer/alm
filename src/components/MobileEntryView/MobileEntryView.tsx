'use client'

/**
 * MobileEntryView — IMG mode for a single entry.
 *
 * Layout (flex column filling available height):
 *
 *   ┌─────────────────────────────┐
 *   │    top tap zone (flex:1)    │ ← tap → prev entry
 *   ├─────────────────────────────┤
 *   │ 01                          │ ← entry number (orange, top-left)
 *   │  ┌──────────────────────┐   │
 *   │  │      image           │   │ ← intrinsic aspect-ratio height
 *   │  └──────────────────────┘   │
 *   │ Title           · ·  ●      │ ← title (left) + dots (right, orange active)
 *   ├─────────────────────────────┤
 *   │   bottom tap zone (flex:1)  │ ← tap → next entry
 *   └─────────────────────────────┘
 *
 * Image block taps → switch to TXT mode.
 * Gestures: horizontal = carousel, vertical = entry navigation.
 */

import { useDrag } from '@use-gesture/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import ImageGallery from '@/components/ImageGallery/ImageGallery'
import type { EntryDetail } from '@/types/entry'

import styles from './MobileEntryView.module.css'

type Props = {
  entry: EntryDetail
  onPrevEntry: () => void
  onNextEntry: () => void
  onSwitchToTxt: () => void
  showBack?: boolean
}

function wrapIdx(i: number, len: number) {
  return ((i % len) + len) % len
}

const AXIS_LOCK_PX = 10
const SWIPE_COMMIT_PX = 50
// CSS transition is 300ms; reset fires at 330ms to guarantee transition
// finishes before the slot index/offset resets (fixes the snap-white-flash).
const CAROUSEL_RESET_DELAY = 330

export default function MobileEntryView({
  entry,
  onPrevEntry,
  onNextEntry,
  onSwitchToTxt,
  showBack = false,
}: Props) {
  const hasImages = entry.images.length > 0
  const hasMultipleImages = entry.images.length > 1

  // ── Carousel state ───────────────────────────────────────────────
  const [imageIndex, setImageIndex] = useState(0)
  const [imageDragOffset, setImageDragOffset] = useState(0)
  const [isCarouselAnimating, setIsCarouselAnimating] = useState(false)
  const isCarouselAnimatingRef = useRef(false)

  // ── Gesture axis lock ────────────────────────────────────────────
  const lockedAxis = useRef<'h' | 'v' | null>(null)
  const verticalCommittedRef = useRef(false)

  useEffect(() => {
    setImageIndex(0)
    setImageDragOffset(0)
  }, [entry.id])

  const commitImageSwipe = useCallback(
    (direction: 1 | -1) => {
      if (isCarouselAnimatingRef.current || !hasMultipleImages) return
      // Measure content width, not full window, to account for the nav rail
      const panelWidth = document.documentElement.clientWidth
      isCarouselAnimatingRef.current = true
      setIsCarouselAnimating(true)
      setImageDragOffset(direction * -panelWidth)

      setTimeout(() => {
        setImageIndex((prev) => wrapIdx(prev + direction, entry.images.length))
        isCarouselAnimatingRef.current = false
        setIsCarouselAnimating(false)
        setImageDragOffset(0)
      }, CAROUSEL_RESET_DELAY)
    },
    [entry.images.length, hasMultipleImages],
  )

  const snapBackCarousel = useCallback(() => {
    isCarouselAnimatingRef.current = true
    setIsCarouselAnimating(true)
    setImageDragOffset(0)
    setTimeout(() => {
      isCarouselAnimatingRef.current = false
      setIsCarouselAnimating(false)
    }, CAROUSEL_RESET_DELAY)
  }, [])

  // ── Drag handler (axis-locked, no velocity) ──────────────────────
  const bind = useDrag(
    ({ first, last, movement: [mx, my], cancel }) => {
      if (first) {
        lockedAxis.current = null
        verticalCommittedRef.current = false
      }

      if (lockedAxis.current === null) {
        if (Math.abs(mx) > AXIS_LOCK_PX || Math.abs(my) > AXIS_LOCK_PX) {
          lockedAxis.current = Math.abs(mx) >= Math.abs(my) ? 'h' : 'v'
        }
      }

      if (lockedAxis.current === 'h') {
        if (!hasMultipleImages) {
          cancel()
          return
        }
        if (isCarouselAnimatingRef.current) {
          cancel()
          return
        }
        if (!last) {
          setImageDragOffset(mx)
        } else {
          if (Math.abs(mx) > SWIPE_COMMIT_PX) commitImageSwipe(mx < 0 ? 1 : -1)
          else snapBackCarousel()
        }
      } else if (lockedAxis.current === 'v') {
        if (last && !verticalCommittedRef.current) {
          if (Math.abs(my) > SWIPE_COMMIT_PX) {
            verticalCommittedRef.current = true
            if (my < 0) onNextEntry()
            else onPrevEntry()
          }
        }
      }
    },
    { filterTaps: true, pointer: { touch: true } },
  )

  const entryNumberStr = String(entry.entryNumber).padStart(3, '0')

  // Compute aspect-ratio from the primary image so imageWrap has intrinsic height.
  const primaryImage = entry.images[0]?.image
  const aspectRatio =
    primaryImage && primaryImage.width > 0 && primaryImage.height > 0
      ? primaryImage.width / primaryImage.height
      : undefined

  return (
    <div className={styles.root} {...bind()}>
      {/* ── Top tap zone → prev entry ─────────────────────────────── */}
      <button
        type="button"
        className={styles.tapZone}
        onClick={onPrevEntry}
        aria-label="Previous entry"
      />

      {/* ── Image block — tap anywhere inside → switch to TXT ──────── */}
      <button
        type="button"
        className={styles.imageBlock}
        onClick={onSwitchToTxt}
        aria-label="Switch to text view"
      >
        <span className={styles.entryNumber}>{entryNumberStr}</span>

        {hasImages ? (
          <div
            className={styles.imageWrap}
            style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
          >
            <ImageGallery
              images={entry.images}
              currentIndex={imageIndex}
              dragOffset={imageDragOffset}
              isTransitioning={isCarouselAnimating}
            />
          </div>
        ) : (
          <div className={styles.textOnly}>
            <span className={styles.textOnlyTitle}>{entry.title}</span>
          </div>
        )}

        {hasImages && (
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
        )}
      </button>

      {/* ── Bottom tap zone → next entry ──────────────────────────── */}
      <button
        type="button"
        className={styles.tapZone}
        onClick={onNextEntry}
        aria-label="Next entry"
      />

      {/* Back-to-search — shown only when arriving from /search */}
      {showBack && (
        <a href="/search" className={styles.backBtn}>
          ← Search
        </a>
      )}
    </div>
  )
}
