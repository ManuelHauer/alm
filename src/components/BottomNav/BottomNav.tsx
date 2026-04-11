import styles from './BottomNav.module.css'

type Props = {
  view: 'img' | 'txt'
  hasImages: boolean
  onToggle: () => void
}

/**
 * Bottom navigation bar.
 * Layout: STUDIO (left) | IMG·TXT toggle pill (center) | SHOP · INSTAGRAM (right)
 *
 * The toggle is only active on mobile (MobileEntryView uses it to switch
 * between IMG and TXT views). On desktop it renders greyed out — the
 * desktop layout always shows both image and text simultaneously.
 * hasImages=false also disables and greys the toggle.
 */
export default function BottomNav({ view, hasImages, onToggle }: Props) {
  return (
    <nav className={styles.root}>
      <div className={styles.side}>
        <a href="/studio" className={styles.link}>
          STUDIO
        </a>
      </div>

      <button
        type="button"
        className={`${styles.toggle} ${!hasImages ? styles.toggleDisabled : ''}`}
        onClick={onToggle}
        disabled={!hasImages}
        aria-label={`Switch to ${view === 'img' ? 'text' : 'image'} view`}
      >
        <span className={`${styles.pill} ${view === 'img' ? styles.pillImg : styles.pillTxt}`}>
          <span className={styles.pillOption}>IMG</span>
          <span className={styles.pillOption}>TXT</span>
          <span className={styles.pillIndicator} />
        </span>
      </button>

      <div className={`${styles.side} ${styles.sideRight}`}>
        <a href="/shop" className={styles.link}>
          SHOP
        </a>
        <span className={styles.dot}>·</span>
        <a href="https://instagram.com" className={styles.link} target="_blank" rel="noopener noreferrer">
          INSTAGRAM
        </a>
      </div>
    </nav>
  )
}
