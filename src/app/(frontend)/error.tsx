'use client'

import styles from './not-found.module.css'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <p className={styles.code}>500</p>
        <p className={styles.message}>Something went wrong.</p>
        <button
          type="button"
          onClick={reset}
          className={styles.link}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
