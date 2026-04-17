import Link from 'next/link'

import styles from './MobileNavRail.module.css'

/**
 * MobileNavRail — fixed vertical left rail for mobile layout.
 *
 * Layout:
 *   ┌──────┐
 *   │ alm  │ ← white text on grey block (top)
 *   │      │
 *   │ ALM  │
 *   │ STU  │ ← vertical text stack (centred)
 *   │ SHP  │
 *   │ INS  │
 *   └──────┘
 *
 * Uses vertical-rl writing mode + 180deg rotation so labels read
 * bottom-to-top, matching the editorial side-nav convention.
 */
type Props = { desktop?: boolean }

export default function MobileNavRail({ desktop = false }: Props) {
  return (
    <aside className={`${styles.root} ${desktop ? styles.rootDesktop : ''}`}>
      <Link href="/" className={styles.logo} aria-label="alm — home">
        {/* SVG is a grey rectangle with transparent letter cutouts — */}
        {/* white background here shows through the letter holes.    */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/alm_logo.svg" alt="alm" className={styles.logoImg} />
      </Link>

      <nav className={styles.links} aria-label="Primary">
        <a href="/" className={styles.link}>
          ALMANAC
        </a>
        <a href="/studio" className={styles.link}>
          STUDIO
        </a>
        <a href="/shop" className={styles.link}>
          SHOP
        </a>
        <a
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          INSTAGRAM
        </a>
      </nav>
    </aside>
  )
}
