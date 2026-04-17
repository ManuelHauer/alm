'use client'

/**
 * MobileTxtView — TXT mode: continuous looping vertical stream of all entries.
 *
 * Looping strategy:
 *   Renders entries 3× [clone | real | clone].
 *   On mount: instant-jump scrollTop to put the active entry in the middle
 *   set at the 50% focus line (vertical centre).
 *   On scroll: when scrollTop exits the middle set's bounds, teleport
 *   ± middleSetHeight (no animation). Content at old/new position is
 *   identical, so no visual jump.
 *
 * Performance:
 *   Entry offsets are pre-computed once after layout and cached.
 *   The scroll handler uses ONLY scrollTop + cached values — zero
 *   getBoundingClientRect() calls in the hot path.
 *   Detection is throttled to one RAF per scroll burst.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'

import type { EntryDetail } from '@/types/entry'

import styles from './MobileTxtView.module.css'

export type MobileTxtViewHandle = {
  /** Smoothly scroll the text column to show the entry with the given id. */
  scrollToEntry: (id: number) => void
}

type Props = {
  entries: EntryDetail[]
  activeEntryId: number
  onActivate: (entry: EntryDetail) => void
  onSelectEntry: (entry: EntryDetail) => void
}

const FOCUS_LINE_RATIO = 0.5 // 50% — vertical centre of container
const COPIES = 3

const MobileTxtView = forwardRef<MobileTxtViewHandle, Props>(function MobileTxtView({
  entries,
  activeEntryId,
  onActivate,
  onSelectEntry,
}, ref) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Keyed by `${entryId}-${copyIndex}` — we only track copy=1 (middle set).
  const entryRefs = useRef<Map<string, HTMLElement>>(new Map())
  const hasInitialScrolled = useRef(false)

  // ── Pre-computed scroll offsets (middle-set, relative to container origin) ──
  // Avoids getBoundingClientRect() in the scroll hot path.
  // offset = position from the top of the scrollable content (stable, not viewport-relative).
  const entryScrollOffsetsRef = useRef<Map<number, number>>(new Map())

  const computeScrollOffsets = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const cTop = container.getBoundingClientRect().top
    const map = new Map<number, number>()
    for (const entry of entries) {
      const el = entryRefs.current.get(`${entry.id}-1`)
      if (!el) continue
      map.set(entry.id, el.getBoundingClientRect().top - cTop + container.scrollTop)
    }
    entryScrollOffsetsRef.current = map
  }, [entries])

  // Store middle-set bounds for loop teleport (also pre-computed).
  const middleStartRef = useRef(0)
  const middleHeightRef = useRef(0)

  // Expose scrollToEntry to parent (DesktopScrollLayout keyboard nav)
  useImperativeHandle(ref, () => ({
    scrollToEntry: (id: number) => {
      const container = scrollRef.current
      const el = entryRefs.current.get(`${id}-1`)
      if (!container || !el) return
      const cRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const offsetInContainer = elRect.top - cRect.top + container.scrollTop
      // Suppress onActivate while smooth scroll plays out (~500ms covers typical
      // smooth-scroll duration); prevents intermediate entries from overwriting
      // the intended active entry and causing flicker / "press twice" symptoms.
      isProgrammaticScrollRef.current = true
      if (programmaticScrollTimerRef.current !== null)
        clearTimeout(programmaticScrollTimerRef.current)
      programmaticScrollTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false
      }, 500)
      container.scrollTo({
        top: offsetInContainer - cRect.height * FOCUS_LINE_RATIO,
        behavior: 'smooth',
      })
    },
  }))

  // Looped list: 3 copies — [0=pre-clone | 1=real | 2=post-clone]
  const loopedEntries = Array.from({ length: COPIES }).flatMap((_, copy) =>
    entries.map((e) => ({ entry: e, copy })),
  )

  // Compute offsets + middle-set bounds after layout, and on resize.
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container) return

    // First entry of copy-1 and first entry of copy-2 delimit the middle set.
    const firstMiddle = entryRefs.current.get(`${entries[0].id}-1`)
    const firstPost = entryRefs.current.get(`${entries[0].id}-2`)
    if (!firstMiddle || !firstPost) return

    const cTop = container.getBoundingClientRect().top
    const middleStart =
      firstMiddle.getBoundingClientRect().top - cTop + container.scrollTop
    const middleEnd =
      firstPost.getBoundingClientRect().top - cTop + container.scrollTop

    middleStartRef.current = middleStart
    middleHeightRef.current = middleEnd - middleStart

    computeScrollOffsets()
  }, [entries, computeScrollOffsets])

  // Re-compute offsets on viewport resize (font scaling, orientation change).
  useEffect(() => {
    window.addEventListener('resize', computeScrollOffsets, { passive: true })
    return () => window.removeEventListener('resize', computeScrollOffsets)
  }, [computeScrollOffsets])

  const isProgrammaticScrollRef = useRef(false)
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial scroll: jump instantly to active entry in the middle set.
  // Suppress scroll detection while the jump settles so we don't
  // accidentally activate a neighbouring entry.
  useLayoutEffect(() => {
    if (hasInitialScrolled.current) return
    const container = scrollRef.current
    if (!container) return

    const el = entryRefs.current.get(`${activeEntryId}-1`)
    if (!el) return

    isProgrammaticScrollRef.current = true
    if (programmaticScrollTimerRef.current !== null)
      clearTimeout(programmaticScrollTimerRef.current)

    const cRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const offsetInContainer = elRect.top - cRect.top + container.scrollTop
    container.scrollTop = offsetInContainer - cRect.height * FOCUS_LINE_RATIO

    hasInitialScrolled.current = true

    // Allow detection after the browser has painted the new position
    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false
    }, 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount only — no dep on activeEntryId, intentional
  const isTeleportingRef = useRef(false)
  // RAF handle for throttling detection to one frame per scroll burst
  const detectRafRef = useRef<number | null>(null)

  // Scroll listener: teleport at boundaries + update active entry.
  // Hot-path uses ONLY scrollTop + pre-computed values (no getBoundingClientRect).
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const onScroll = () => {
      // ── Loop teleport (always immediate, no DOM reads) ──
      const middleStart = middleStartRef.current
      const middleHeight = middleHeightRef.current
      if (middleHeight > 0) {
        const st = container.scrollTop
        if (st < middleStart || st >= middleStart + middleHeight) {
          isTeleportingRef.current = true
          container.scrollTop = st < middleStart
            ? st + middleHeight
            : st - middleHeight
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
        const containerHeight = container.clientHeight
        const threshold = scrollTop + containerHeight * FOCUS_LINE_RATIO

        let bestId: number | null = null
        let bestOffset = -Infinity

        for (const [id, offset] of entryScrollOffsetsRef.current) {
          if (offset <= threshold && offset > bestOffset) {
            bestOffset = offset
            bestId = id
          }
        }

        if (bestId !== null && bestId !== activeEntryId) {
          const bestEntry = entries.find((e) => e.id === bestId)
          if (bestEntry) {
            onActivate(bestEntry)
            try {
              window.history.replaceState(null, '', `/entry/${bestEntry.slug}`)
            } catch {
              // ignore
            }
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

  return (
    <div ref={scrollRef} className={styles.root}>
      {loopedEntries.map(({ entry, copy }) => {
        const key = `${entry.id}-${copy}`
        const isActive = entry.id === activeEntryId

        return (
          <button
            key={key}
            type="button"
            ref={(el) => {
              if (el) entryRefs.current.set(key, el)
              else entryRefs.current.delete(key)
            }}
            onClick={() => onSelectEntry(entry)}
            className={`${styles.entry} ${isActive ? styles.entryActive : ''}`}
          >
            <span className={styles.entryNumber}>
              {String(entry.entryNumber).padStart(3, '0')}
            </span>

            <div className={styles.entryContent}>
              <h2 className={styles.entryTitle}>{entry.title}</h2>

              {(entry.year || entry.place) && (
                <p className={styles.entryMeta}>
                  {[entry.year, entry.place].filter(Boolean).join(' · ')}
                </p>
              )}

              {entry.plainDescription && (
                <p className={styles.entryDescription}>{entry.plainDescription}</p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
})

export default MobileTxtView
