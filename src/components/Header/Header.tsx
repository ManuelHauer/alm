import Link from 'next/link'

import styles from './Header.module.css'

/**
 * Global header — "a l m" logo left, search icon right.
 * Logo links to / (shuffle/latest behavior wired in M4 via SiteSettings).
 * Search links to /search (built in M4).
 */
export default function Header() {
  return (
    <header className={styles.root}>
      <Link href="/" className={styles.logo} aria-label="alm — home">
        a&nbsp;l&nbsp;m
      </Link>
      <Link href="/search" className={styles.searchLink} aria-label="Search">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </Link>
    </header>
  )
}
