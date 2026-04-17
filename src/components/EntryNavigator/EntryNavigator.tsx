'use client'

/**
 * EntryNavigator — shared wrapper for / and /entry/[slug].
 *
 * Desktop: DesktopScrollLayout (self-contained: NavRail + image col + text col).
 *
 * Mobile: left MobileNavRail + main content area + floating IMG/TXT toggle pill.
 *   - IMG mode: MobileImgStream (continuous looping image scroll stream)
 *   - TXT mode: MobileTxtView (continuous loop stream, scroll-to-activate)
 *   - Modes share `currentEntry`; IMG↔TXT switching preserves the active entry.
 *
 * URL sync: history.replaceState(/entry/[slug]) whenever currentEntry changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import DesktopScrollLayout from '@/components/DesktopScrollLayout/DesktopScrollLayout'
import MobileImgStream from '@/components/MobileImgStream/MobileImgStream'
import MobileNavRail from '@/components/MobileNavRail/MobileNavRail'
import MobileTxtView from '@/components/MobileTxtView/MobileTxtView'
import type { EntryDetail } from '@/types/entry'

import styles from './EntryNavigator.module.css'

type Props = {
  entries: EntryDetail[]
  initialSlug?: string
  showBack?: boolean
}

export default function EntryNavigator({ entries, initialSlug, showBack = false }: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const [imgTxtView, setImgTxtView] = useState<'img' | 'txt'>('img')

  const [currentEntry, setCurrentEntry] = useState<EntryDetail>(
    () => (initialSlug ? (entries.find((e) => e.slug === initialSlug) ?? entries[0]) : entries[0]),
  )

  // Keep a ref so setActiveEntry's identity never changes
  const currentEntryRef = useRef(currentEntry)
  currentEntryRef.current = currentEntry

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setActiveEntry = useCallback((entry: EntryDetail) => {
    if (entry.id === currentEntryRef.current.id) return
    setCurrentEntry(entry)
    history.replaceState(null, '', `/entry/${entry.slug}`)
  }, [])

  // Empty database — nothing to render yet
  if (!currentEntry) return null

  const handleToggle = () => {
    setImgTxtView((v) => (v === 'img' ? 'txt' : 'img'))
  }

  // ── Mobile layout ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className={styles.mobileRoot}>
        <MobileNavRail />

        <div className={styles.mobileMain} role="region" aria-label="Entry viewer">
          {imgTxtView === 'img' ? (
            <MobileImgStream
              entries={entries}
              activeEntryId={currentEntry.id}
              onActivate={setActiveEntry}
              onSelectEntry={(entry) => {
                // Tap on image in stream → open that entry's TXT view
                setCurrentEntry(entry)
                history.replaceState(null, '', `/entry/${entry.slug}`)
                setImgTxtView('txt')
              }}
            />
          ) : (
            <MobileTxtView
              entries={entries}
              activeEntryId={currentEntry.id}
              onActivate={setActiveEntry}
              onSelectEntry={(entry) => {
                // Tap on TXT entry → switch back to IMG stream for that entry
                setCurrentEntry(entry)
                history.replaceState(null, '', `/entry/${entry.slug}`)
                setImgTxtView('img')
              }}
            />
          )}
        </div>

        {/* Search icon — fixed top-right corner with gradient */}
        <a href="/search" className={styles.mobileSearch} aria-label="Search">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/search.svg" alt="" className={styles.mobileSearchIcon} aria-hidden="true" />
        </a>

        {/* Floating IMG/TXT toggle — fixed bottom-right */}
        <button
          type="button"
          className={styles.floatingToggle}
          onClick={handleToggle}
          aria-label={`Switch to ${imgTxtView === 'img' ? 'text' : 'image'} view`}
        >
          <span
            className={`${styles.pill} ${imgTxtView === 'img' ? styles.pillImg : styles.pillTxt}`}
          >
            <span className={styles.pillOption}>IMG</span>
            <span className={styles.pillIndicator} />
            <span className={styles.pillOption}>TXT</span>
          </span>
        </button>
      </div>
    )
  }

  // ── Desktop layout — DesktopScrollLayout is self-contained ─────────
  return <DesktopScrollLayout entries={entries} initialSlug={initialSlug} showBack={showBack} />
}
