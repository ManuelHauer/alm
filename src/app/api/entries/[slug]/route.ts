/**
 * GET /api/entries/[slug]
 *
 * Returns the full entry for a given slug.
 * Used by EntryNavigator to fetch entry data on demand as the user navigates.
 *
 * Response: EntryDetail  |  404 { error: 'Not found' }
 */

import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import type { Media } from '@/payload-types'
import type { EntryDetail, EntryImageItem } from '@/types/entry'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'entries',
    depth: 1,
    where: { slug: { equals: slug } },
    limit: 1,
  })

  const entry = docs[0]
  if (!entry) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const images: EntryImageItem[] = (entry.images ?? [])
    .filter((row) => typeof row.image === 'object')
    .map((row) => {
      const media = row.image as Media
      return {
        id: row.id,
        caption: row.caption,
        image: {
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
        },
      }
    })

  const detail: EntryDetail = {
    id: entry.id,
    slug: entry.slug,
    entryNumber: entry.entryNumber,
    title: entry.title,
    year: entry.year ?? null,
    place: entry.place ?? null,
    plainDescription: entry.plainDescription ?? null,
    images,
    sortOrder: entry.sortOrder ?? 0,
  }

  return NextResponse.json(detail)
}
