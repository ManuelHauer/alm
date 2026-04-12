/**
 * GET /api/entries/index
 *
 * Returns the lightweight entry index used for navigation.
 * Sorted descending by sortOrder (higher = more recent = first).
 *
 * Response: EntryIndexItem[]
 *
 * Used by EntryNavigator to build the full entry list on mount,
 * and by MobileEntryView to know what to swipe to next/prev.
 * Cached by Next.js — revalidated on demand via Payload's afterChange hook.
 */

import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import type { Media } from '@/payload-types'
import type { EntryIndexItem } from '@/types/entry'

export async function GET() {
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'entries',
    depth: 1, // populate images[].image so we can extract the thumbnail URL
    sort: '-sortOrder',
    limit: 1000, // ~130 entries in production; 1000 is a safe ceiling
    draft: false, // only return published versions, never drafts
    where: { _status: { equals: 'published' } },
  })

  const index: EntryIndexItem[] = docs.map((entry) => {
    const firstImageRow = entry.images?.[0]
    const media =
      firstImageRow && typeof firstImageRow.image === 'object'
        ? (firstImageRow.image as Media)
        : null

    return {
      id: entry.id,
      slug: entry.slug,
      entryNumber: entry.entryNumber,
      title: entry.title,
      hasImages: (entry.images?.length ?? 0) > 0,
      firstImageThumbnailUrl: media?.sizes?.thumbnail?.url ?? media?.url ?? null,
      sortOrder: entry.sortOrder ?? 0,
    }
  })

  return NextResponse.json(index)
}
