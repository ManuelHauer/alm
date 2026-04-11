'use client'

/**
 * EntryNavigator — shared wrapper for / and /entry/[slug].
 *
 * Responsibilities:
 *   - Owns imgTxtView state (IMG/TXT toggle), passed down to mobile view + BottomNav
 *   - Detects mobile/desktop breakpoint (768px) after hydration
 *   - Desktop: renders DesktopScrollLayout with all entries
 *   - Mobile: renders MobileEntryView (Track B — placeholder for now)
 *   - Handles on-demand entry fetching and URL updates for mobile navigation
 *
 * Server components pass pre-fetched entries so the initial render is
 * fully SSR'd. Client-side navigation fetches individual entries via
 * GET /api/entries/[slug] and updates the URL with history.replaceState.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import BottomNav from '@/components/BottomNav/BottomNav'
import DesktopScrollLayout from '@/components/DesktopScrollLayout/DesktopScrollLayout'
import Header from '@/components/Header/Header'
import type { EntryDetail } from '@/types/entry'

import styles from './EntryNavigator.module.css'

type Props = {
  entries: EntryDetail[]
  initialSlug?: string
}

export default function EntryNavigator({ entries, initialSlug }: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const [imgTxtView, setImgTxtView] = useState<'img' | 'txt'>('img')

  // Current entry — used for mobile navigation and URL management.
  // Desktop scroll layout manages its own focus state internally.
  const [currentEntry, setCurrentEntry] = useState<EntryDetail>(
    () => (initialSlug ? (entries.find((e) => e.slug === initialSlug) ?? entries[0]) : entries[0]),
  )

  const isFetching = useRef(false)

  // Detect breakpoint after hydration (SSR defaults to desktop)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const currentIndex = entries.findIndex((e) => e.slug === currentEntry.slug)

  const navigateToSlug = useCallback(
    async (slug: string) => {
      if (isFetching.current || slug === currentEntry.slug) return
      isFetching.current = true
      try {
        const res = await fetch(`/api/entries/${slug}`)
        if (!res.ok) return
        const entry: EntryDetail = await res.json()
        setCurrentEntry(entry)
        history.replaceState(null, '', `/entry/${slug}`)
      } finally {
        isFetching.current = false
      }
    },
    [currentEntry.slug],
  )

  const goNext = useCallback(() => {
    const next = entries[(currentIndex + 1) % entries.length]
    if (next) navigateToSlug(next.slug)
  }, [currentIndex, entries, navigateToSlug])

  const goPrev = useCallback(() => {
    const prev = entries[((currentIndex - 1) + entries.length) % entries.length]
    if (prev) navigateToSlug(prev.slug)
  }, [currentIndex, entries, navigateToSlug])

  const hasImages = currentEntry.images.length > 0

  return (
    <div className={styles.root}>
      <Header />

      <main className={styles.main}>
        {isMobile ? (
          // ── MobileEntryView — Track B ──────────────────────────
          // Placeholder until Track B is implemented.
          <div className={styles.mobilePlaceholder}>
            <p>Mobile view — Track B</p>
            <button type="button" onClick={goPrev}>← prev</button>
            <span>{currentEntry.title}</span>
            <button type="button" onClick={goNext}>next →</button>
          </div>
        ) : (
          // ── Desktop layout ─────────────────────────────────────
          <DesktopScrollLayout entries={entries} />
        )}
      </main>

      <BottomNav
        view={imgTxtView}
        hasImages={hasImages}
        onToggle={() => setImgTxtView((v) => (v === 'img' ? 'txt' : 'img'))}
      />
    </div>
  )
}
