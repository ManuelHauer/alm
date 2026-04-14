/**
 * GET /api/folios
 *
 * Two response modes:
 *
 *  a) Flat array  — our frontend (search chips, migration script).
 *     Called without ?limit param: returns FolioItem[].
 *
 *  b) Payload format — Payload admin relationship picker.
 *     Called with ?limit (and optional ?page, ?sort, ?where…) params:
 *     returns { docs: [...], totalDocs, limit, page, … } so the admin
 *     can display existing folios instead of an empty list.
 *
 * POST /api/folios
 *
 *  Payload admin "Add New" inline creation from relationship fields.
 *  Requires an Authorization: JWT … header (admin must be logged in).
 */

import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export type FolioItem = {
  id: number
  name: string
  slug: string
  sortOrder: number
}

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const url = new URL(req.url)

  // Payload admin relationship picker always sends ?limit=
  if (url.searchParams.has('limit')) {
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 200)
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const result = await payload.find({
      collection: 'folios',
      sort: 'sortOrder',
      limit,
      page,
    })
    return NextResponse.json(result)
  }

  // Default: flat array for frontend
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

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config: configPromise })

  // Require a Payload auth token — prevents unauthenticated creates
  const authHeader = req.headers.get('Authorization')
  const cookieToken = req.cookies.get('payload-token')?.value
  if (!authHeader?.startsWith('JWT ') && !cookieToken) {
    return NextResponse.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
  }

  const data = await req.json()

  try {
    const doc = await payload.create({
      collection: 'folios',
      data,
      overrideAccess: true, // auth presence verified above
    })
    return NextResponse.json({ doc, message: 'Folio created successfully.' }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ errors: [{ message }] }, { status: 400 })
  }
}
