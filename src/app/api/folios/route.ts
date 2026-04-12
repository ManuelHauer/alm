/**
 * GET /api/folios
 *
 * Returns all folios sorted by sortOrder asc (for filter chips).
 * Cached by Next.js — revalidated on demand.
 */

import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

export type FolioItem = {
  id: number
  name: string
  slug: string
  sortOrder: number
}

export async function GET() {
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'folios',
    sort: 'sortOrder',
    limit: 100,
  })

  const result: FolioItem[] = docs.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    sortOrder: f.sortOrder ?? 0,
  }))

  return NextResponse.json(result)
}
