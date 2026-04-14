'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import EntryCard from '@/components/EntryCard/EntryCard'
import type { EntryIndexItem } from '@/types/entry'

import type { FolioItem } from '../../api/folios/route'
import styles from './search.module.css'

type Props = {
  initialEntries: EntryIndexItem[]
  folios: FolioItem[]
}

export default function SearchView({ initialEntries, folios }: Props) {
  const [query, setQuery] = useState('')
  const [activefolioSlugs, setActiveFolioSlugs] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<EntryIndexItem[]>(initialEntries)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on desktop only (avoids keyboard pop-up on mobile)
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      inputRef.current?.focus()
    }
  }, [])

  const fetchResults = useCallback(async (q: string, folioSlugs: Set<string>) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (folioSlugs.size > 0) params.set('folios', Array.from(folioSlugs).join(','))
    const res = await fetch(`/api/search?${params}`)
    const data: EntryIndexItem[] = await res.json()
    setResults(data)
    setLoading(false)
  }, [])

  const scheduleSearch = useCallback(
    (q: string, folioSlugs: Set<string>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      // If both empty, reset to initial immediately
      if (!q && folioSlugs.size === 0) {
        setResults(initialEntries)
        setLoading(false)
        return
      }
      debounceRef.current = setTimeout(() => {
        fetchResults(q, folioSlugs)
      }, 300)
    },
    [fetchResults, initialEntries],
  )

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    scheduleSearch(val, activefolioSlugs)
  }

  const toggleFolio = (slug: string) => {
    const next = new Set(activefolioSlugs)
    if (next.has(slug)) next.delete(slug)
    else next.add(slug)
    setActiveFolioSlugs(next)
    scheduleSearch(query, next)
  }

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  return (
    <div className={styles.root} role="main">
      {/* Search bar */}
      <div className={styles.searchBarWrap}>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleQueryChange}
          placeholder="Search entries…"
          className={styles.searchInput}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* Folio chips */}
      {folios.length > 0 && (
        <div className={styles.chips}>
          {folios.map((folio) => (
            <button
              key={folio.slug}
              type="button"
              onClick={() => toggleFolio(folio.slug)}
              className={`${styles.chip} ${activefolioSlugs.has(folio.slug) ? styles.chipActive : ''}`}
            >
              {folio.name}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className={styles.resultsWrap}>
        {loading ? (
          <div className={styles.status}>Searching…</div>
        ) : results.length === 0 ? (
          <div className={styles.status}>No entries found.</div>
        ) : (
          <div className={styles.grid}>
            {results.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
