/**
 * Server-side helper — fetches all published entries with full detail.
 * Used by server components (/ and /entry/[slug]) to avoid an HTTP
 * roundtrip to the API routes. The API routes (/api/entries/...) are
 * for client-side use during mobile navigation.
 */

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { Media } from '@/payload-types'
import type { EntryDetail, EntryImageItem } from '@/types/entry'

function mapMedia(media: Media): EntryImageItem['image'] {
  return {
    id: media.id,
    url: media.url ?? '',
    width: media.width ?? 0,
    height: media.height ?? 0,
    alt: media.alt,
    isAnimatedGif: media.isAnimatedGif ?? false,
    sizes: {
      thumbnail: media.sizes?.thumbnail?.url
        ? {
            url: media.sizes.thumbnail.url,
            width: media.sizes.thumbnail.width ?? 0,
            height: media.sizes.thumbnail.height ?? 0,
          }
        : null,
      medium: media.sizes?.medium?.url
        ? {
            url: media.sizes.medium.url,
            width: media.sizes.medium.width ?? 0,
            height: media.sizes.medium.height ?? 0,
          }
        : null,
      large: media.sizes?.large?.url
        ? {
            url: media.sizes.large.url,
            width: media.sizes.large.width ?? 0,
            height: media.sizes.large.height ?? 0,
          }
        : null,
    },
  }
}

export async function getAllEntries(): Promise<EntryDetail[]> {
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'entries',
    depth: 1,
    sort: '-sortOrder',
    limit: 1000,
  })

  return docs.map((entry) => ({
    id: entry.id,
    slug: entry.slug,
    entryNumber: entry.entryNumber,
    title: entry.title,
    year: entry.year ?? null,
    place: entry.place ?? null,
    plainDescription: entry.plainDescription ?? null,
    sortOrder: entry.sortOrder ?? 0,
    images: (entry.images ?? [])
      .filter((row) => typeof row.image === 'object')
      .map((row) => ({
        id: row.id,
        caption: row.caption,
        image: mapMedia(row.image as Media),
      })),
  }))
}
