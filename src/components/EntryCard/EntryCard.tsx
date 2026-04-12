import Link from 'next/link'

import type { EntryIndexItem } from '@/types/entry'

import styles from './EntryCard.module.css'

type Props = {
  entry: EntryIndexItem
}

export default function EntryCard({ entry }: Props) {
  const numberStr = String(entry.entryNumber).padStart(3, '0')

  return (
    <Link href={`/entry/${entry.slug}?from=search`} className={styles.card}>
      <div className={styles.thumb}>
        {entry.firstImageThumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.firstImageThumbnailUrl}
            alt={entry.title}
            className={styles.thumbImg}
            loading="lazy"
          />
        ) : (
          <div className={styles.thumbEmpty} />
        )}
      </div>
      <div className={styles.meta}>
        <span className={styles.number}>{numberStr}</span>
        <span className={styles.title}>{entry.title}</span>
      </div>
    </Link>
  )
}
