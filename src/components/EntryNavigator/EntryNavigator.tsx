'use client'

/**
 * EntryNavigator — shared wrapper for / and /entry/[slug].
 *
 * Desktop: DesktopScrollLayout (self-contained: NavRail + image col + text col).
 *
 * Mobile: left MobileNavRail + main content area + floating IMG/TXT toggle pill.
 *   - IMG mode: MobileEntryView (single entry, tap zones + swipe gestures)
 *   - TXT mode: MobileTxtView (continuous loop stream, scroll-to-activate)
 *   - Modes share `currentEntry`; IMG↔TXT switching preserves the active entry.
 *   - Clicking a TXT entry fires `onSelectEntry` → switches to IMG for that entry.
 *
 * URL sync: history.replaceState(/entry/[slug]) whenever currentEntry changes.
 */

import { useEffect, useState } from 'react'

import DesktopScrollLayout from '@/components/DesktopScrollLayout/DesktopScrollLayout'
import MobileEntryView from '@/components/MobileEntryView/MobileEntryView'
import MobileNavRail from '@/components/MobileNavRail/MobileNavRail'
import MobileTxtView from '@/components/MobileTxtView/MobileTxtView'
import type { EntryDetail } from '@/types/entry'

import styles from './EntryNavigator.module.css'

type Props = {
  entries: EntryDetail[]
  initialSlug?: string
  showBack?: boolean
}

function wrapIdx(i: number, len: number) {
  return ((i % len) + len) % len
}

export default function EntryNavigator({ entries, initialSlug, showBack = false }: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const [imgTxtView, setImgTxtView] = useState<'img' | 'txt'>('img')

  const [currentEntry, setCurrentEntry] = useState<EntryDetail>(
    () => (initialSlug ? (entries.find((e) => e.slug === initialSlug) ?? entries[0]) : entries[0]),
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setActiveEntry = (entry: EntryDetail) => {
    if (entry.id === currentEntry.id) return
    setCurrentEntry(entry)
    history.replaceState(null, '', `/entry/${entry.slug}`)
  }

  const goPrevEntry = () => {
    const i = entries.findIndex((e) => e.id === currentEntry.id)
    setActiveEntry(entries[wrapIdx(i - 1, entries.length)])
  }

  const goNextEntry = () => {
    const i = entries.findIndex((e) => e.id === currentEntry.id)
    setActiveEntry(entries[wrapIdx(i + 1, entries.length)])
  }

  // Tap on a TXT entry → make it current AND switch to IMG mode.
  const selectAndSwitchToImg = (entry: EntryDetail) => {
    setCurrentEntry(entry)
    history.replaceState(null, '', `/entry/${entry.slug}`)
    setImgTxtView('img')
  }

  const hasImages = currentEntry.images.length > 0
  const canToggle = hasImages || imgTxtView === 'txt'

  const handleToggle = () => {
    setImgTxtView((v) => (v === 'img' ? 'txt' : 'img'))
  }

  // ── Mobile layout ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className={styles.mobileRoot}>
        <MobileNavRail />

        <main className={styles.mobileMain}>
          {imgTxtView === 'img' ? (
            <MobileEntryView
              entry={currentEntry}
              onPrevEntry={goPrevEntry}
              onNextEntry={goNextEntry}
              onSwitchToTxt={() => setImgTxtView('txt')}
              showBack={showBack}
            />
          ) : (
            <MobileTxtView
              entries={entries}
              activeEntryId={currentEntry.id}
              onActivate={setActiveEntry}
              onSelectEntry={selectAndSwitchToImg}
            />
          )}
        </main>

        {/* Search icon — fixed top-right corner with gradient */}
        <a href="/search" className={styles.mobileSearch} aria-label="Search">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/search.svg" alt="" className={styles.mobileSearchIcon} aria-hidden="true" />
        </a>

        {/* Floating IMG/TXT toggle — fixed bottom-right */}
        <button
          type="button"
          className={`${styles.floatingToggle} ${!canToggle ? styles.toggleDisabled : ''}`}
          onClick={handleToggle}
          disabled={!canToggle}
          aria-label={`Switch to ${imgTxtView === 'img' ? 'text' : 'image'} view`}
        >
          <span
            className={`${styles.pill} ${imgTxtView === 'img' ? styles.pillImg : styles.pillTxt}`}
          >
            <span className={styles.pillOption}>IMG</span>
            <span className={styles.pillOption}>TXT</span>
            <span className={styles.pillIndicator} />
          </span>
        </button>
      </div>
    )
  }

  // ── Desktop layout — DesktopScrollLayout is self-contained ─────────
  return <DesktopScrollLayout entries={entries} showBack={showBack} />
}
