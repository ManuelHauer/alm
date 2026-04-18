'use client'

/**
 * MobileTxtView — TXT mode: continuous looping vertical stream of all entries.
 *
 * Looping: single-copy list. When the user scrolls past the last entry (or
 * before the first), scrollTop teleports to the opposite end.
 *
 * Performance:
 *   Entry offsets are pre-computed once after layout and cached.
 *   The scroll handler uses ONLY scrollTop + cached values — zero
 *   getBoundingClientRect() calls in the hot path.
 *   Detection is throttled to one RAF per scroll burst.
 *   onActivate is throttled to ≤1 per 150ms; replaceState to ≤1 per 300ms.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'

import type { EntryDetail } from '@/types/entry'

import styles from './MobileTxtView.module.css'

export type MobileTxtViewHandle = {
  /** Smoothly scroll the text column to show the entry with the given id. */
  scrollToEntry: (id: number) => void
  /** Recompute cached scroll offsets (call after container resize). */
  recomputeOffsets: () => void
}

type Props = {
  entries: EntryDetail[]
  activeEntryId: number
  onActivate: (entry: EntryDetail) => void
  onSelectEntry: (entry: EntryDetail) => void
}

const FOCUS_LINE_RATIO = 0.5 // 50% — vertical centre of container
const TELEPORT_THRESHOLD_PX = 200

const MobileTxtView = forwardRef<MobileTxtViewHandle, Props>(function MobileTxtView({
  entries,
  activeEntryId,
  onActivate,
  onSelectEntry,
}, ref) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const entryRefs = useRef<Map<string, HTMLElement>>(new Map())
  const hasInitialScrolled = useRef(false)

  const activeEntryIdRef = useRef(activeEntryId)
  activeEntryIdRef.current = activeEntryId

  // ── Pre-computed scroll offsets (relative to container origin) ──
  const entryScrollOffsetsRef = useRef<Map<number, number>>(new Map())

  const computeScrollOffsets = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const cTop = container.getBoundingClientRect().top
    const map = new Map<number, number>()
    for (const entry of entries) {
      const el = entryRefs.current.get(String(entry.id))
      if (!el) continue
      map.set(entry.id, el.getBoundingClientRect().top - cTop + container.scrollTop)
    }
    entryScrollOffsetsRef.current = map
  }, [entries])

  // Expose scrollToEntry + recomputeOffsets to parent (DesktopScrollLayout)
  useImperativeHandle(ref, () => ({
    scrollToEntry: (id: number) => {
      const container = scrollRef.current
      const el = entryRefs.current.get(String(id))
      if (!container || !el) return
      const cRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const offsetInContainer = elRect.top - cRect.top + container.scrollTop
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
    recomputeOffsets: computeScrollOffsets,
  }))

  // Compute offsets after layout, and on resize.
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

    const el = entryRefs.current.get(String(activeEntryId))
    if (!el) return

    isProgrammaticScrollRef.current = true
    if (programmaticScrollTimerRef.current !== null)
      clearTimeout(programmaticScrollTimerRef.current)

    const cRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const offsetInContainer = elRect.top - cRect.top + container.scrollTop
    container.scrollTop = offsetInContainer + elRect.height / 2 - cRect.height / 2

    hasInitialScrolled.current = true

    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false
    }, 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Throttled onActivate — max 1 call per 150ms ─────────────────────────────
  const activateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingActivateRef = useRef<EntryDetail | null>(null)

  const throttledActivate = useCallback(
    (entry: EntryDetail) => {
      pendingActivateRef.current = entry
      if (activateTimerRef.current !== null) return
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

  // Scroll listener: teleport at edges + update active entry.
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const onScroll = () => {
      // ── Edge teleport ──
      const st = container.scrollTop
      const maxScroll = container.scrollHeight - container.clientHeight

      if (maxScroll > 0 && !isTeleportingRef.current) {
        if (st <= TELEPORT_THRESHOLD_PX) {
          isTeleportingRef.current = true
          container.scrollTop = maxScroll - TELEPORT_THRESHOLD_PX + st
          requestAnimationFrame(() => { isTeleportingRef.current = false })
          return
        }
        if (st >= maxScroll - TELEPORT_THRESHOLD_PX) {
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

        if (bestId !== null && bestId !== activeEntryIdRef.current) {
          const bestEntry = entries.find((e) => e.id === bestId)
          if (bestEntry) {
            throttledActivate(bestEntry)
            throttledReplaceState(bestEntry.slug)
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

  return (
    <div ref={scrollRef} className={styles.root}>
      {entries.map((entry) => {
        const key = String(entry.id)
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
