'use client'

/**
 * MobileEntryView — full-screen mobile entry display.
 *
 * Layout:
 *   - Image area (top ~62%) with 3-slot carousel
 *   - Info area (scrollable, bottom ~38%): title, meta, description
 *
 * Gestures (single useDrag on the image area with manual axis lock):
 *   - Horizontal drag → image carousel swipe
 *   - Vertical drag → entry navigation (prev entry = swipe down, next = swipe up)
 *
 * Entry navigation also works via tap zones:
 *   - Tap top 40% of image area → prev entry
 *   - Tap bottom 40% of image area → next entry
 *   (Centre 20% reserved for gesture, no accidental tap conflict)
 */

import { useDrag } from '@use-gesture/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { EntryDetail } from '@/types/entry'
import ImageGallery from '@/components/ImageGallery/ImageGallery'

import styles from './MobileEntryView.module.css'

type Props = {
  entry: EntryDetail
  entries: EntryDetail[]
  currentIndex: number
  imgTxtView: 'img' | 'txt'
  onNavigate: (index: number) => void
}

function wrapIdx(i: number, len: number) {
  return ((i % len) + len) % len
}

const SWIPE_THRESHOLD = 50 // px to commit a swipe

export default function MobileEntryView({
  entry,
  entries,
  currentIndex,
  imgTxtView,
  onNavigate,
}: Props) {
  // ── Image carousel state ─────────────────────────────────────────
  const [imageIndex, setImageIndex] = useState(0)
  const [imageDragOffset, setImageDragOffset] = useState(0)
  const [isImageTransitioning, setIsImageTransitioning] = useState(false)
  const imageDragOffsetRef = useRef(0)
  const isImageTransitioningRef = useRef(false)

  // ── Entry swipe state ────────────────────────────────────────────
  const [entryDragOffset, setEntryDragOffset] = useState(0)
  const [isEntryTransitioning, setIsEntryTransitioning] = useState(false)

  // ── Axis lock ────────────────────────────────────────────────────
  const lockedAxis = useRef<'h' | 'v' | null>(null)

  // Reset image index when entry changes
  useEffect(() => {
    setImageIndex(0)
    setImageDragOffset(0)
    imageDragOffsetRef.current = 0
  }, [entry.id])

  const commitImageSwipe = useCallback(
    (direction: 1 | -1) => {
      if (isImageTransitioningRef.current) return
      const len = entry.images.length
      if (len <= 1) return

      const panelWidth = window.innerWidth
      isImageTransitioningRef.current = true
      setIsImageTransitioning(true)
      // Fly current slot off-screen in swipe direction
      imageDragOffsetRef.current = direction * -panelWidth
      setImageDragOffset(direction * -panelWidth)

      setTimeout(() => {
        setImageIndex((prev) => wrapIdx(prev + direction, len))
        // Reset offset without transition so slots snap back
        isImageTransitioningRef.current = false
        setIsImageTransitioning(false)
        imageDragOffsetRef.current = 0
        setImageDragOffset(0)
      }, 220)
    },
    [entry.images.length],
  )

  const navigateEntry = useCallback(
    (direction: 1 | -1) => {
      const next = wrapIdx(currentIndex + direction, entries.length)
      onNavigate(next)
    },
    [currentIndex, entries.length, onNavigate],
  )

  // ── Single drag handler on image area ───────────────────────────
  const bind = useDrag(
    ({ first, last, movement: [mx, my], velocity: [vx, vy], cancel, event }) => {
      if (first) {
        lockedAxis.current = null
      }

      // Lock axis after 6px of movement
      if (lockedAxis.current === null && (Math.abs(mx) > 6 || Math.abs(my) > 6)) {
        lockedAxis.current = Math.abs(mx) >= Math.abs(my) ? 'h' : 'v'
      }

      if (lockedAxis.current === 'h') {
        // Horizontal — image carousel
        if (isImageTransitioningRef.current) { cancel(); return }
        if (!last) {
          imageDragOffsetRef.current = mx
          setImageDragOffset(mx)
        } else {
          const shouldCommit = Math.abs(mx) > SWIPE_THRESHOLD || Math.abs(vx) > 0.5
          if (shouldCommit) {
            commitImageSwipe(mx < 0 ? 1 : -1)
          } else {
            // Snap back
            setIsImageTransitioning(true)
            isImageTransitioningRef.current = true
            imageDragOffsetRef.current = 0
            setImageDragOffset(0)
            setTimeout(() => {
              setIsImageTransitioning(false)
              isImageTransitioningRef.current = false
            }, 220)
          }
        }
      } else if (lockedAxis.current === 'v') {
        // Vertical — entry navigation
        if (!last) {
          setEntryDragOffset(my)
        } else {
          const shouldCommit = Math.abs(my) > SWIPE_THRESHOLD || Math.abs(vy) > 0.5
          if (shouldCommit) {
            // Negative my = swipe up = next entry
            navigateEntry(my < 0 ? 1 : -1)
          }
          setEntryDragOffset(0)
          setIsEntryTransitioning(false)
        }
      }
    },
    {
      filterTaps: true,
      pointer: { touch: true },
    },
  )

  const hasImages = entry.images.length > 0
  const showImage = imgTxtView === 'img' && hasImages

  return (
    <div className={styles.root}>
      {/* ── Image / gallery area ─────────────────────────────── */}
      <div
        className={styles.imageArea}
        style={{
          transform: `translateY(${entryDragOffset}px)`,
          transition: isEntryTransitioning ? 'transform 220ms ease-out' : 'none',
        }}
        {...bind()}
      >
        {showImage ? (
          <ImageGallery
            images={entry.images}
            currentIndex={imageIndex}
            dragOffset={imageDragOffset}
            isTransitioning={isImageTransitioning}
            onDotClick={setImageIndex}
          />
        ) : (
          <div className={styles.noImage}>
            <span>{entry.title}</span>
          </div>
        )}
      </div>

      {/* ── Info area ─────────────────────────────────────────── */}
      <div className={styles.infoArea}>
        <div className={styles.infoScroll}>
          <div className={styles.entryMeta}>
            <span className={styles.entryNumber}>{String(entry.entryNumber).padStart(3, '0')}</span>
            {entry.year && <span className={styles.metaItem}>{entry.year}</span>}
            {entry.place && <span className={styles.metaItem}>{entry.place}</span>}
          </div>
          <h1 className={styles.title}>{entry.title}</h1>
          {entry.plainDescription && (
            <p className={styles.description}>{entry.plainDescription}</p>
          )}
        </div>
      </div>
    </div>
  )
}
