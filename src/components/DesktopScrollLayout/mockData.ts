/**
 * Mock data for the M2 prototype and local dev fallback.
 * Shape matches EntryDetail so DesktopScrollLayout works with
 * both mock and real Payload data without conversion.
 *
 * Images use picsum.photos for deterministic placeholder photos.
 * sizes are null since picsum has no separate size variants.
 */

import type { EntryDetail, EntryImageItem } from '@/types/entry'

const pic = (seed: string, w = 1600, h = 1200): EntryImageItem['image'] => ({
  id: 0,
  url: `https://picsum.photos/seed/${seed}/${w}/${h}`,
  width: w,
  height: h,
  alt: `Placeholder image ${seed}`,
  isAnimatedGif: false,
  sizes: { thumbnail: null, medium: null, large: null },
})

export const mockEntries: EntryDetail[] = [
  {
    id: 1,
    slug: 'project-almanach-001',
    entryNumber: 1,
    title: 'Project Almanach 001',
    year: '2019',
    place: 'Los Angeles',
    plainDescription:
      'A multi-image entry exploring color, form, and the editorial archive format. The first frame establishes a register; subsequent frames extend it without departing. This is the canonical multi-image study.',
    sortOrder: 5,
    images: [
      { image: pic('alm-001-a'), caption: 'Frame one' },
      { image: pic('alm-001-b'), caption: 'Frame two' },
      { image: pic('alm-001-c'), caption: 'Frame three' },
    ],
  },
  {
    id: 2,
    slug: 'project-almanach-002',
    entryNumber: 2,
    title: 'Project Almanach 002',
    year: '2018-2020',
    place: 'Vienna',
    plainDescription:
      'Identity work and packaging study. Two-image set, edges held tight, no captions. The interval between the two frames carries the entire idea.',
    sortOrder: 4,
    images: [
      { image: pic('alm-002-a') },
      { image: pic('alm-002-b') },
    ],
  },
  {
    id: 3,
    slug: 'single-frame-study',
    entryNumber: 3,
    title: 'Single Frame Study',
    year: '2021',
    place: 'Berlin',
    plainDescription:
      'A single-image entry. Bold and quiet. There is nothing to cycle through — the carousel dots should not appear.',
    sortOrder: 3,
    images: [{ image: pic('alm-003') }],
  },
  {
    id: 4,
    slug: 'note-on-method',
    entryNumber: 4,
    title: 'Note on Method',
    year: '2022',
    place: null,
    plainDescription:
      'A text-only entry. There are no images here. The left panel should remain blank — light grey, no crossfade target. This is the edge case that proves the layout does not assume images exist. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    sortOrder: 2,
    images: [],
  },
  {
    id: 5,
    slug: 'motion-test',
    entryNumber: 5,
    title: 'Motion Test',
    year: '2024',
    place: 'Studio',
    plainDescription:
      'An entry containing what would be an animated GIF in production. For the prototype, this is a single placeholder image; the real GIF preservation pipeline is verified in M1.',
    sortOrder: 1,
    images: [{ image: pic('alm-005'), caption: 'Should still animate' }],
  },
]
