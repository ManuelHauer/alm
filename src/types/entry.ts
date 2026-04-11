/**
 * Shared response types for the entries API routes.
 *
 * These are plain JSON-serialisable shapes — not Payload ORM types.
 * Components import from here; they never import from payload-types directly.
 *
 * EntryIndexItem  — lightweight, used for the navigation index list
 * EntryImageItem  — one image row inside a full entry
 * EntryDetail     — full entry, used for the main view render
 */

export type EntryIndexItem = {
  id: number
  slug: string
  entryNumber: number
  title: string
  hasImages: boolean
  firstImageThumbnailUrl: string | null
  sortOrder: number
}

export type EntryImageSize = {
  url: string
  width: number
  height: number
}

export type EntryImageItem = {
  id?: string | null
  caption?: string | null
  image: {
    id: number
    url: string
    width: number
    height: number
    alt: string
    isAnimatedGif: boolean
    sizes: {
      thumbnail: EntryImageSize | null
      medium: EntryImageSize | null
      large: EntryImageSize | null
    }
  }
}

export type EntryDetail = {
  id: number
  slug: string
  entryNumber: number
  title: string
  year: string | null
  place: string | null
  plainDescription: string | null
  images: EntryImageItem[]
  sortOrder: number
}
