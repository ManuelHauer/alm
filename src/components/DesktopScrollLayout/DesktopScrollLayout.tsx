'use client'

/**
 * DesktopScrollLayout — M2 prototype.
 *
 * The hardest UI component in the project, built in isolation per the
 * handoff §M2 strategy ("prove the scroll-snap layout works before
 * building anything else"). Acceptance criteria from §M2:
 *
 *   1. Scroll snaps to entry blocks on the right panel
 *   2. Left image updates when focus changes
 *   3. Out-of-focus entries dim to 0.4 opacity, focused entry full opacity
 *   4. Focused entry number renders alm orange (#E8531E)
 *   5. Multi-image entries show carousel dots, arrow keys cycle
 *   6. Text-only entries show blank/light grey on the left
 *
 * Implementation notes:
 *   - Focus detection uses a scroll listener on the right panel.
 *     A virtual focus line sits 30% down from the panel top; the entry
 *     whose top edge most recently crossed above that line is focused.
 *     This is reliable regardless of entry height — short entries always
 *     win when they're the topmost item below the focus line.
 *   - Per-entry image cycling state is keyed by entry id so it persists
 *     as you scroll back and forth.
 *   - Arrow keys are global (window-level) and route to the focused
 *     entry's image cycler. Disabled for entries with ≤ 1 image.
 *   - Hardcoded mock data — see mockData.ts. M3 will swap to real API.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import styles from './DesktopScrollLayout.module.css'
import { mockEntries, type MockEntry } from './mockData'

type Props = {
  entries?: MockEntry[]
}

export default function DesktopScrollLayout({ entries = mockEntries }: Props) {
  // Which entry currently has the most visible area in the right scroll panel
  const [focusedId, setFocusedId] = useState<string>(entries[0]?.id ?? '')

  // Per-entry carousel index (entries with multiple images)
  const [imageIndices, setImageIndices] = useState<Record<string, number>>({})

  // Refs to each entry block in the right panel — populated via callback ref
  const entryRefs = useRef<Map<string, HTMLElement>>(new Map())
  const setEntryRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) entryRefs.current.set(id, el)
      else entryRefs.current.delete(id)
    },
    [],
  )

  // Ref for the right scroll container itself
  const rightRef = useRef<HTMLElement>(null)

  // ─── Focus detection via scroll position ──────────────────────
  // We draw a virtual "focus line" 30% down from the top of the right
  // panel. The focused entry is whichever entry's top edge most recently
  // crossed above that line — i.e. the last entry whose heading the user
  // has scrolled past. This works correctly regardless of entry height,
  // so short entries like single-image or text-only ones can always win.
  useEffect(() => {
    const container = rightRef.current
    if (!container) return

    const updateFocus = () => {
      const containerRect = container.getBoundingClientRect()
      const focusLineY = containerRect.top + containerRect.height * 0.3

      let bestId = entries[0]?.id ?? ''
      let bestTop = -Infinity

      for (const [id, el] of entryRefs.current) {
        const top = el.getBoundingClientRect().top
        // Candidate: top is above the focus line but as close to it as possible
        if (top <= focusLineY && top > bestTop) {
          bestTop = top
          bestId = id
        }
      }

      setFocusedId(bestId)
    }

    container.addEventListener('scroll', updateFocus, { passive: true })
    // Run once on mount so the initial state is correct
    updateFocus()
    return () => container.removeEventListener('scroll', updateFocus)
  }, [entries])

  // ─── Arrow keys cycle the focused entry's images ───────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const focused = entries.find((x) => x.id === focusedId)
      if (!focused || focused.images.length <= 1) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      setImageIndices((prev) => {
        const cur = prev[focused.id] ?? 0
        const len = focused.images.length
        const next = e.key === 'ArrowRight' ? (cur + 1) % len : (cur - 1 + len) % len
        return { ...prev, [focused.id]: next }
      })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusedId, entries])

  // ─── Derived state for the left panel ──────────────────────────
  const focusedEntry = useMemo(
    () => entries.find((x) => x.id === focusedId) ?? entries[0],
    [entries, focusedId],
  )
  const focusedImageIndex = imageIndices[focusedEntry?.id ?? ''] ?? 0
  const focusedImage = focusedEntry?.images[focusedImageIndex]?.image

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className={styles.root}>
      {/* LEFT — sticky 60% with crossfading image stack */}
      <aside className={styles.left} aria-hidden="true">
        <div className={styles.leftImageStack}>
          {/* Render every entry's currently-selected image as a stacked
              layer — only the focused one is opacity:1, others are 0.
              CSS transitions handle the 300ms crossfade. */}
          {entries.map((entry) => {
            const idx = imageIndices[entry.id] ?? 0
            const img = entry.images[idx]?.image
            if (!img) return null
            const isActive = entry.id === focusedId
            return (
              <img
                key={entry.id}
                src={img.url}
                alt={img.alt}
                className={`${styles.leftImage} ${isActive ? styles.leftImageActive : ''}`}
                loading="lazy"
              />
            )
          })}

          {/* Text-only placeholder — only visible when the focused
              entry has zero images */}
          <div
            className={`${styles.leftEmpty} ${
              focusedEntry && focusedEntry.images.length === 0
                ? styles.leftEmptyActive
                : ''
            }`}
          >
            no image
          </div>

          {/* Carousel dots — only when focused entry has > 1 image */}
          {focusedEntry && focusedEntry.images.length > 1 && (
            <div className={styles.dots}>
              {focusedEntry.images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.dot} ${
                    i === focusedImageIndex ? styles.dotActive : ''
                  }`}
                  onClick={() =>
                    setImageIndices((prev) => ({ ...prev, [focusedEntry.id]: i }))
                  }
                  aria-label={`Show image ${i + 1} of ${focusedEntry.images.length}`}
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
              onClick={() => {
                setFocusedId(entry.id)
                const el = entryRefs.current.get(entry.id)
                const container = rightRef.current
                if (!el || !container) return
                const delta =
                  el.getBoundingClientRect().top -
                  (container.getBoundingClientRect().top + container.clientHeight * 0.3)
                container.scrollBy({ top: delta, behavior: 'smooth' })
              }}
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
