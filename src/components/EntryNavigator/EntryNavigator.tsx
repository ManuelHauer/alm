'use client'

/**
 * EntryNavigator — shared wrapper for / and /entry/[slug].
 *
 * Responsibilities:
 *   - Owns imgTxtView state (IMG/TXT toggle), passed down to mobile view + BottomNav
 *   - Detects mobile/desktop breakpoint (768px) after hydration
 *   - Desktop: renders DesktopScrollLayout with all entries
 *   - Mobile: renders MobileEntryView with swipe navigation
 *   - Tracks currentEntry for mobile URL updates
 *
 * Server components pass pre-fetched entries so the initial render is fully SSR'd.
 * Mobile navigation uses array lookup (no fetch needed — all entries already loaded).
 */

import { useEffect, useState } from 'react'

import BottomNav from '@/components/BottomNav/BottomNav'
import DesktopScrollLayout from '@/components/DesktopScrollLayout/DesktopScrollLayout'
import Header from '@/components/Header/Header'
import MobileEntryView from '@/components/MobileEntryView/MobileEntryView'
import type { EntryDetail } from '@/types/entry'

import styles from './EntryNavigator.module.css'

type Props = {
  entries: EntryDetail[]
  initialSlug?: string
}

export default function EntryNavigator({ entries, initialSlug }: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const [imgTxtView, setImgTxtView] = useState<'img' | 'txt'>('img')

  // Current entry — mobile navigation and URL management.
  // Desktop scroll layout manages its own focus state internally.
  const [currentEntry, setCurrentEntry] = useState<EntryDetail>(
    () => (initialSlug ? (entries.find((e) => e.slug === initialSlug) ?? entries[0]) : entries[0]),
  )

  // Detect breakpoint after hydration (SSR defaults to desktop)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const currentIndex = entries.findIndex((e) => e.slug === currentEntry.slug)

  const handleNavigate = (index: number) => {
    const entry = entries[index]
    if (entry) {
      setCurrentEntry(entry)
      history.replaceState(null, '', `/entry/${entry.slug}`)
    }
  }

  const hasImages = currentEntry.images.length > 0

  return (
    <div className={styles.root}>
      <Header />

      <main className={styles.main}>
        {isMobile ? (
          // ── Mobile ────────────────────────────────────────────
          <MobileEntryView
            entry={currentEntry}
            entries={entries}
            currentIndex={currentIndex}
            imgTxtView={imgTxtView}
            onNavigate={handleNavigate}
          />
        ) : (
          // ── Desktop ───────────────────────────────────────────
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
