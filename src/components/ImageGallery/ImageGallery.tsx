import type { EntryImageItem } from '@/types/entry'

import styles from './ImageGallery.module.css'

type Props = {
  images: EntryImageItem[]
  currentIndex: number
  dragOffset: number
  isTransitioning: boolean
  onDotClick: (index: number) => void
}

function wrapIdx(i: number, len: number) {
  return ((i % len) + len) % len
}

export default function ImageGallery({
  images,
  currentIndex,
  dragOffset,
  isTransitioning,
  onDotClick,
}: Props) {
  if (images.length === 0) return null

  const len = images.length
  const slots = [-1, 0, 1].map((offset) => ({
    offset,
    item: images[wrapIdx(currentIndex + offset, len)],
  }))

  return (
    <div className={styles.root}>
      <div className={styles.track}>
        {slots.map(({ offset, item }) => {
          return (
            <div
              key={offset}
              className={styles.slot}
              style={{
                transform: `translateX(calc(${offset * 100}% + ${dragOffset}px))`,
                transition: isTransitioning ? 'transform 220ms ease-out' : 'none',
              }}
            >
              {item.image && (
                <img
                  className={styles.image}
                  src={item.image.sizes?.medium?.url ?? item.image.url}
                  alt={item.image.alt}
                  draggable={false}
                />
              )}
            </div>
          )
        })}
      </div>

      {len > 1 && (
        <div className={styles.dots}>
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`}
              onClick={() => onDotClick(i)}
              aria-label={`Image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
