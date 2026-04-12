import type { EntryImageItem } from '@/types/entry'

import styles from './ImageGallery.module.css'

/**
 * ImageGallery — pure display component.
 *
 * Renders a 3-slot carousel (prev / cur / next) with a light editorial
 * background and contained images. No dots, no gesture handler — the
 * parent (MobileEntryView or DesktopScrollLayout) owns all interaction.
 *
 * Slots are translated by `dragOffset` during drag. On commit, the
 * parent flies the slots to ±viewport and swaps currentIndex.
 */

type Props = {
  images: EntryImageItem[]
  currentIndex: number
  dragOffset: number
  isTransitioning: boolean
}

function wrapIdx(i: number, len: number) {
  return ((i % len) + len) % len
}

export default function ImageGallery({
  images,
  currentIndex,
  dragOffset,
  isTransitioning,
}: Props) {
  if (images.length === 0) return null

  const len = images.length
  const slots = [-1, 0, 1].map((offset) => ({
    offset,
    item: images[wrapIdx(currentIndex + offset, len)],
  }))

  return (
    <div className={styles.root}>
      {slots.map(({ offset, item }) => (
        <div
          key={offset}
          className={styles.slot}
          style={{
            transform: `translateX(calc(${offset * 100}% + ${dragOffset}px))`,
            transition: isTransitioning ? 'transform 220ms ease-out' : 'none', // reset fires at 250ms — see MobileEntryView
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
      ))}
    </div>
  )
}
