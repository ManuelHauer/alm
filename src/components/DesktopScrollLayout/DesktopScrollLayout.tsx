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
 *   - Focus detection uses IntersectionObserver (the handoff says
 *     scrollend with IO fallback for Safari, but IO is universally
 *     supported now and gives smoother continuous tracking; scrollend
 *     would only fire after the snap completes, which feels laggy).
 *     We watch the right-panel entries and mark whichever has the
 *     largest visible area as focused.
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

  // ─── Focus detection via IntersectionObserver ──────────────────
  // Track each entry's visible ratio. The entry with the highest ratio
  // is the "focused" one. We bias the root margin slightly upward so
  // an entry counts as focused as it lands at the top of the viewport.
  useEffect(() => {
    const ratios = new Map<string, number>()
    const observer = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          const id = (r.target as HTMLElement).dataset.entryId
          if (id) ratios.set(id, r.intersectionRatio)
        }
        let bestId = ''
        let bestRatio = 0
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        }
        if (bestId && bestRatio > 0) setFocusedId(bestId)
      },
      {
        // The right panel itself is the scroll container. We pass
        // root: null (= the viewport) which works because the right
        // panel is height: 100vh and pinned to the viewport edge.
        root: null,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )
    for (const el of entryRefs.current.values()) observer.observe(el)
    return () => observer.disconnect()
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

      {/* RIGHT — 40% scroll-snap container */}
      <section className={styles.right}>
        {entries.map((entry) => {
          const isFocused = entry.id === focusedId
          return (
            <article
              key={entry.id}
              ref={setEntryRef(entry.id)}
              data-entry-id={entry.id}
              className={`${styles.entry} ${isFocused ? styles.entryFocused : ''}`}
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
