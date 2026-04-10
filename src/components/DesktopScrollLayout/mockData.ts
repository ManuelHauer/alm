/**
 * Hardcoded mock data for the M2 desktop scroll-snap prototype.
 *
 * Per handoff §M2.2: "Use hardcoded mock data (5 entries matching seed
 * data structure)." Keeping the prototype self-contained means we can
 * iterate on the component without depending on the seed running, the
 * dev DB being in any particular state, or Payload's API surface.
 *
 * Shape mirrors what `Entries` produces with `depth: 2`: the `images`
 * array contains rows with an `image` object holding `url`, `width`,
 * `height`, plus an optional `caption`. Once M3 wires this to real
 * data, the swap is just `mockEntries` → API response.
 */

export type MockImage = {
  id: string
  url: string
  width: number
  height: number
  alt: string
}

export type MockEntryImage = {
  image: MockImage
  caption?: string
}

export type MockEntry = {
  id: string
  entryNumber: number
  title: string
  year: string
  place: string
  plainDescription: string
  images: MockEntryImage[]
}

// Picsum gives us deterministic placeholder photos at any size and varies
// by the seed in the URL — perfect for prototyping without bundling assets.
const pic = (seed: string, w = 1600, h = 1200): MockImage => ({
  id: `pic-${seed}`,
  url: `https://picsum.photos/seed/${seed}/${w}/${h}`,
  width: w,
  height: h,
  alt: `Placeholder image ${seed}`,
})

export const mockEntries: MockEntry[] = [
  {
    id: 'entry-1',
    entryNumber: 1,
    title: 'Project Almanach 001',
    year: '2019',
    place: 'Los Angeles',
    plainDescription:
      'A multi-image entry exploring color, form, and the editorial archive format. The first frame establishes a register; subsequent frames extend it without departing. This is the canonical multi-image study.',
    images: [
      { image: pic('alm-001-a'), caption: 'Frame one' },
      { image: pic('alm-001-b'), caption: 'Frame two' },
      { image: pic('alm-001-c'), caption: 'Frame three' },
    ],
  },
  {
    id: 'entry-2',
    entryNumber: 2,
    title: 'Project Almanach 002',
    year: '2018-2020',
    place: 'Vienna',
    plainDescription:
      'Identity work and packaging study. Two-image set, edges held tight, no captions. The interval between the two frames carries the entire idea.',
    images: [
      { image: pic('alm-002-a') },
      { image: pic('alm-002-b') },
    ],
  },
  {
    id: 'entry-3',
    entryNumber: 3,
    title: 'Single Frame Study',
    year: '2021',
    place: 'Berlin',
    plainDescription:
      'A single-image entry. Bold and quiet. There is nothing to cycle through — the carousel dots should not appear.',
    images: [{ image: pic('alm-003') }],
  },
  {
    id: 'entry-4',
    entryNumber: 4,
    title: 'Note on Method',
    year: '2022',
    place: '',
    plainDescription:
      'A text-only entry. There are no images here. The left panel should remain blank — light grey, no crossfade target. This is the edge case that proves the layout does not assume images exist. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    images: [],
  },
  {
    id: 'entry-5',
    entryNumber: 5,
    title: 'Motion Test',
    year: '2024',
    place: 'Studio',
    plainDescription:
      'An entry containing what would be an animated GIF in production. For the prototype, this is a single placeholder image; the real GIF preservation pipeline is verified in M1 (see handleGifUpload.ts).',
    images: [{ image: pic('alm-005'), caption: 'Should still animate' }],
  },
]
