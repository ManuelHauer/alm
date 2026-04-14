'use client'

/**
 * MobileTxtView — TXT mode: continuous looping vertical stream of all entries.
 *
 * Looping strategy:
 *   Renders entries 3× [clone | real | clone].
 *   On mount: instant-jump scrollTop to put the active entry in the middle
 *   set at the 30% focus line.
 *   On scroll: when scrollTop exits the middle set's bounds, teleport
 *   ± middleSetHeight (no animation). Content at old/new position is
 *   identical, so no visual jump.
 *
 * Scroll hijacking is gone:
 *   Auto-scroll runs only ONCE (on mount, instant). The scroll listener
 *   updates activeEntryId for mode-switch purposes but never triggers
 *   another scrollTo.
 *
 * Tap:
 *   Clicking an entry calls onSelectEntry — EntryNavigator sets that
 *   entry as current and switches to IMG mode.
 *
 * Layout per entry:
 *   ┌─(44px col)──┬──(content)─────────────────────┐
 *   │   [012]     │                   Project Title │  ← right-aligned
 *   │             │              year · place       │  ← right-aligned
 *   │             │  Justified description text     │
 *   │             │  last line left-aligned.        │
 *   └─────────────┴─────────────────────────────────┘
 *
 *   Thin border-bottom separates entries (same weight as the rail separator).
 */

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'

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

  // Store middle-set bounds so the scroll listener can teleport without
  // recomputing layout on every event.
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

  // Compute middle-set geometry once after initial layout.
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
  }, [entries])

  // Initial scroll: jump instantly to active entry in the middle set.
  useLayoutEffect(() => {
    if (hasInitialScrolled.current) return
    const container = scrollRef.current
    if (!container) return

    const el = entryRefs.current.get(`${activeEntryId}-1`)
    if (!el) return

    const cRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const offsetInContainer = elRect.top - cRect.top + container.scrollTop
    container.scrollTop = offsetInContainer - cRect.height * FOCUS_LINE_RATIO

    hasInitialScrolled.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount only — no dep on activeEntryId, intentional

  // Guard: suppress onActivate during programmatic smooth scroll triggered
  // by keyboard nav, preventing intermediate entries from flickering in.
  const isProgrammaticScrollRef = useRef(false)
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Guard: skip active-entry detection in the same tick as a teleport,
  // which prevents briefly highlighting the wrong entry at loop boundaries.
  const isTeleportingRef = useRef(false)

  // Scroll listener: teleport at boundaries + update active entry.
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const onScroll = () => {
      // ── Loop teleport ──
      const middleStart = middleStartRef.current
      const middleHeight = middleHeightRef.current
      if (middleHeight > 0) {
        const didTeleport =
          container.scrollTop < middleStart ||
          container.scrollTop >= middleStart + middleHeight
        if (didTeleport) {
          isTeleportingRef.current = true
          if (container.scrollTop < middleStart) {
            container.scrollTop += middleHeight
          } else {
            container.scrollTop -= middleHeight
          }
          // Clear flag after browser has settled the new scroll position
          requestAnimationFrame(() => {
            isTeleportingRef.current = false
          })
          return // skip detection this tick; next scroll event will re-detect
        }
      }

      if (isTeleportingRef.current) return
      if (isProgrammaticScrollRef.current) return

      // ── Active entry detection (middle-set refs only) ──
      const cRect = container.getBoundingClientRect()
      const focusY = cRect.top + cRect.height * FOCUS_LINE_RATIO

      let bestEntry: EntryDetail | null = null
      let bestTop = -Infinity

      for (const entry of entries) {
        const el = entryRefs.current.get(`${entry.id}-1`)
        if (!el) continue
        const top = el.getBoundingClientRect().top
        if (top <= focusY && top > bestTop) {
          bestTop = top
          bestEntry = entry
        }
      }

      if (bestEntry && bestEntry.id !== activeEntryId) {
        onActivate(bestEntry)
        // Update URL without navigation so the back button and share links
        // reflect the visible entry. Silent no-op on any error (e.g. SSR).
        try {
          window.history.replaceState(null, '', `/entry/${bestEntry.slug}`)
        } catch {
          // ignore
        }
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
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
            {/* Entry number sits in the left padding column */}
            <span className={styles.entryNumber}>
              {String(entry.entryNumber).padStart(3, '0')}
            </span>

            {/* Text content fills the right portion */}
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
