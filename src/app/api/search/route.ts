/**
 * GET /api/search?q=...&folios=slug1,slug2
 *
 * Full-text search over entries. All params are optional.
 *
 * q       — searches title, plainDescription, year, place (Payload `like`, OR logic)
 * folios  — comma-separated folio slugs; entry must belong to at least one (OR)
 *
 * Returns EntryIndexItem[] sorted by sortOrder desc.
 * Not cached — search results are always fresh.
 */

import configPromise from '@payload-config'
import type { Where } from 'payload'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import type { Media } from '@/payload-types'
import type { EntryIndexItem } from '@/types/entry'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const folioSlugs = searchParams
    .get('folios')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? []

  const payload = await getPayload({ config: configPromise })

  // Build where clause
  const conditions: Where[] = []

  if (q) {
    conditions.push({
      or: [
        { title: { like: q } },
        { plainDescription: { like: q } },
        { year: { like: q } },
        { place: { like: q } },
      ],
    })
  }

  if (folioSlugs.length > 0) {
    // Resolve folio slugs → ids first
    const { docs: folios } = await payload.find({
      collection: 'folios',
      where: { slug: { in: folioSlugs } },
      limit: 100,
    })
    const folioIds = folios.map((f) => f.id)
    if (folioIds.length > 0) {
      conditions.push({ folios: { in: folioIds } })
    }
  }

  const where: Where = conditions.length > 0
    ? conditions.length === 1
      ? conditions[0]
      : { and: conditions }
    : {}

  const { docs } = await payload.find({
    collection: 'entries',
    where,
    depth: 1,
    sort: '-sortOrder',
    limit: 1000,
  })

  const results: EntryIndexItem[] = docs.map((entry) => {
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

  return NextResponse.json(results)
}
