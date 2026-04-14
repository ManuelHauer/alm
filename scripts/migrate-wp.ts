/**
 * WordPress XML → Payload migration (v2).
 *
 * Uses the Payload REST API (not Local API) so it runs locally against
 * the remote production server — no DB tunnel or Docker exec needed.
 *
 * Fixes over v1:
 *  - Gallery shortcode ids parsed for correct image order
 *  - ACF fields extracted for media posts (publication_name, etc.)
 *  - publication_date used as `year` for media posts
 *  - Strips gallery shortcodes + HTML before writing description
 *  - --test flag: processes first 10 almanac + 10 media posts only
 *
 * Usage:
 *   PAYLOAD_URL=http://5.78.205.65 pnpm migrate -- \
 *     --xml scripts/almproject.WordPress.2026-04-14.xml \
 *     [--dry-run] [--test] [--skip-images]
 *
 * Fields that need manual review after migration:
 *   - place:   not in WP data — fill in Payload admin
 *   - year:    single year only — Andrea may want ranges ("2008–2010")
 *   - folios:  wpCategories/wpTags in customFields for reference
 */

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import http from 'node:http'
import { parseStringPromise } from 'xml2js'

// ─── config ───────────────────────────────────────────────────────────────────

const PAYLOAD_URL = process.env.PAYLOAD_URL ?? 'http://5.78.205.65'
const PAYLOAD_EMAIL = process.env.PAYLOAD_EMAIL ?? 'andrea@alm.local'
const PAYLOAD_PASSWORD = process.env.PAYLOAD_PASSWORD ?? 'Alm2024admin!'

// ─── types ────────────────────────────────────────────────────────────────────

interface WpItem {
  title: string[]
  'content:encoded': string[]
  'wp:post_id': string[]
  'wp:post_date': string[]
  'wp:post_date_gmt': string[]
  'wp:post_name': string[]
  'wp:post_type': string[]
  'wp:post_parent': string[]
  'wp:status': string[]
  'wp:attachment_url'?: string[]
  category?: Array<{ _: string; $: { domain: string; nicename: string } }>
  'wp:postmeta'?: Array<{
    'wp:meta_key': string[]
    'wp:meta_value': string[]
  }>
}

interface WpAttachment {
  id: string
  url: string
  parentId: string
  title: string
}

interface WpPost {
  id: string
  title: string
  slug: string
  date: Date
  htmlContent: string
  /** IDs from [gallery ids="..."] shortcodes, in display order */
  galleryIds: string[]
  /** IDs of attachments with wp:post_parent = this post (fallback) */
  parentAttachmentIds: string[]
  categories: string[]
  tags: string[]
  /** Non-underscore postmeta — includes ACF field values */
  acfFields: Record<string, string>
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function extractText(val: unknown): string {
  if (val === undefined || val === null) return ''
  const arr = Array.isArray(val) ? val : [val]
  const first = arr[0]
  if (typeof first === 'string') return first
  if (typeof first === 'object' && first !== null && '_' in (first as object)) {
    return String((first as { _: string })._)
  }
  return String(first ?? '')
}

/** Parse all [gallery ids="..."] shortcodes from WP body HTML. */
function parseGalleryIds(html: string): string[] {
  const ids: string[] = []
  const re = /\[gallery[^\]]*\bids="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    for (const id of m[1].split(',')) {
      const trimmed = id.trim()
      if (trimmed) ids.push(trimmed)
    }
  }
  return ids
}

/** Strip shortcodes, HTML tags, and decode entities → plain text. */
function stripToPlain(html: string): string {
  return html
    .replace(/\[gallery[^\]]*\]/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8220;/g, '\u201c')
    .replace(/&#8221;/g, '\u201d')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8230;/g, '\u2026')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Extract a 4-digit year from a string like "august-september 2013" → "2013". */
function extractYear(s: string): string {
  const m = s.match(/\b(19|20)\d{2}\b/)
  return m ? m[0] : ''
}

function toLexicalParagraph(text: string) {
  return {
    root: {
      type: 'root',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      children: [
        {
          type: 'paragraph',
          format: '' as const,
          indent: 0,
          version: 1,
          direction: 'ltr' as const,
          textFormat: 0,
          textStyle: '',
          children: [
            {
              type: 'text',
              format: 0,
              mode: 'normal',
              style: '',
              text,
              detail: 0,
              version: 1,
            },
          ],
        },
      ],
    },
  }
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location
          if (loc) return downloadToBuffer(loc).then(resolve).catch(reject)
          return reject(new Error('Redirect with no Location header'))
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

function filenameFromUrl(url: string): string {
  return path.basename(new URL(url).pathname)
}

function mimeFromUrl(url: string): string {
  const ext = path.extname(url).toLowerCase()
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  }
  return map[ext] ?? 'image/jpeg'
}

// ─── Payload REST helpers ─────────────────────────────────────────────────────

async function payloadLogin(): Promise<string> {
  const res = await fetch(`${PAYLOAD_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PAYLOAD_EMAIL, password: PAYLOAD_PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { token: string }
  return data.token
}

async function uploadMedia(
  token: string,
  buf: Buffer,
  filename: string,
  mime: string,
  alt: string,
): Promise<number> {
  const form = new FormData()
  form.append('file', new Blob([buf], { type: mime }), filename)
  // Payload 3 multipart: extra fields must be in a _payload JSON string
  form.append('_payload', JSON.stringify({ alt: alt || filename }))
  const res = await fetch(`${PAYLOAD_URL}/api/media`, {
    method: 'POST',
    headers: { Authorization: `JWT ${token}` },
    body: form,
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Media upload failed (${res.status}): ${txt.slice(0, 200)}`)
  }
  const data = (await res.json()) as { doc: { id: number } }
  return data.doc.id
}

async function createEntry(token: string, entry: Record<string, unknown>): Promise<number> {
  const res = await fetch(`${PAYLOAD_URL}/api/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    body: JSON.stringify(entry),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Entry creation failed (${res.status}): ${txt.slice(0, 300)}`)
  }
  const data = (await res.json()) as { doc: { id: number } }
  return data.doc.id
}

/** Returns the existing entry id + image count, or null if not found. */
async function findEntry(
  token: string,
  title: string,
  year: string,
): Promise<{ id: number; imageCount: number } | null> {
  const qs = new URLSearchParams({
    'where[and][0][title][equals]': title,
    'where[and][1][year][equals]': year,
    limit: '1',
    draft: 'true',
  })
  const res = await fetch(`${PAYLOAD_URL}/api/entries?${qs}`, {
    headers: { Authorization: `JWT ${token}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { totalDocs: number; docs: Array<{ id: number; images?: unknown[] }> }
  if (data.totalDocs === 0) return null
  const doc = data.docs[0]
  return { id: doc.id, imageCount: doc.images?.length ?? 0 }
}

async function patchEntryImages(
  token: string,
  id: number,
  images: Array<{ image: number; caption: string }>,
): Promise<void> {
  const res = await fetch(`${PAYLOAD_URL}/api/entries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    body: JSON.stringify({ images }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Entry PATCH failed (${res.status}): ${txt.slice(0, 200)}`)
  }
}

// ─── args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const xmlIndex = args.indexOf('--xml')
const xmlPath = xmlIndex !== -1 ? args[xmlIndex + 1] : null
const isDryRun = args.includes('--dry-run')
const skipImages = args.includes('--skip-images')
const isTest = args.includes('--test')

if (!xmlPath) {
  console.error(
    'Usage: PAYLOAD_URL=http://… pnpm migrate -- --xml path/to/export.xml [--dry-run] [--test] [--skip-images]',
  )
  process.exit(1)
}
if (!fs.existsSync(xmlPath)) {
  console.error(`File not found: ${xmlPath}`)
  process.exit(1)
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function migrate() {
  console.log(`\nalm WordPress → Payload migration (v2)`)
  console.log(`  Server:     ${PAYLOAD_URL}`)
  console.log(`  XML:        ${xmlPath}`)
  console.log(`  Dry run:    ${isDryRun}`)
  console.log(`  Test mode:  ${isTest}${isTest ? '  (10 almanac + 10 media)' : ''}`)
  console.log(`  Skip imgs:  ${skipImages}\n`)

  // 1. Parse XML
  console.log('1/5  Parsing XML…')
  const xml = fs.readFileSync(xmlPath!, 'utf-8')
  const parsed = await parseStringPromise(xml, { explicitArray: true })
  const channel = parsed?.rss?.channel?.[0]
  if (!channel) throw new Error('Could not find <channel> in XML. Valid WXR export?')
  const items: WpItem[] = channel.item ?? []
  console.log(`     ${items.length} items in XML`)

  // 2. Separate attachments / posts
  console.log('2/5  Parsing items…')
  const attachments = new Map<string, WpAttachment>()
  const allPosts: WpPost[] = []

  for (const item of items) {
    const postType = extractText(item['wp:post_type'])
    const id = extractText(item['wp:post_id'])

    if (postType === 'attachment') {
      const url = extractText(item['wp:attachment_url'])
      if (url) {
        attachments.set(id, {
          id,
          url,
          parentId: extractText(item['wp:post_parent']),
          title: extractText(item.title),
        })
      }
      continue
    }

    if (postType !== 'post') continue
    if (extractText(item['wp:status']) !== 'publish') continue

    const categories: string[] = []
    const tags: string[] = []
    for (const cat of item.category ?? []) {
      if (cat.$.domain === 'category') categories.push(cat._)
      else if (cat.$.domain === 'post_tag') tags.push(cat._)
    }

    // Only almanac and media posts
    if (!categories.includes('almanac') && !categories.includes('media')) continue

    const htmlContent = extractText(item['content:encoded'])

    // Extract non-underscore postmeta (ACF field values live here)
    const acfFields: Record<string, string> = {}
    for (const meta of item['wp:postmeta'] ?? []) {
      const key = extractText(meta['wp:meta_key'])
      const value = extractText(meta['wp:meta_value'])
      if (key && !key.startsWith('_') && value) acfFields[key] = value
    }

    allPosts.push({
      id,
      title: extractText(item.title),
      slug: extractText(item['wp:post_name']),
      date: new Date(extractText(item['wp:post_date_gmt']) + ' UTC'),
      htmlContent,
      galleryIds: parseGalleryIds(htmlContent),
      parentAttachmentIds: [],
      categories,
      tags,
      acfFields,
    })
  }

  // Attach parent-attached images (fallback for posts without gallery shortcodes)
  for (const [, att] of attachments) {
    const post = allPosts.find((p) => p.id === att.parentId)
    if (post) post.parentAttachmentIds.push(att.id)
  }

  // Sort oldest first
  allPosts.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Split by type
  let almanacPosts = allPosts.filter((p) => p.categories.includes('almanac'))
  let mediaPosts = allPosts.filter((p) => p.categories.includes('media'))

  console.log(`     Almanac: ${almanacPosts.length}  |  Media: ${mediaPosts.length}`)
  console.log(`     Attachments in XML: ${attachments.size}`)

  if (isTest) {
    almanacPosts = almanacPosts.slice(0, 10)
    mediaPosts = mediaPosts.slice(0, 10)
    console.log(`     → Test mode: 10 almanac + 10 media`)
  }

  // Merge back into chronological order
  const posts = [...almanacPosts, ...mediaPosts].sort((a, b) => a.date.getTime() - b.date.getTime())

  // ── dry run ──────────────────────────────────────────────────────────────
  if (isDryRun) {
    console.log('\n── Dry run preview ──────────────────────────────────────────────────')
    for (const post of posts) {
      const isMedia = post.categories.includes('media')
      const year = isMedia
        ? (extractYear(post.acfFields['publication_date'] ?? '') || String(post.date.getFullYear()))
        : String(post.date.getFullYear())
      const imgIds = post.galleryIds.length ? post.galleryIds : post.parentAttachmentIds
      const imgCount = imgIds.filter((id) => attachments.has(id)).length
      const type = isMedia ? 'media  ' : 'almanac'
      const subCats = post.categories.filter((c) => c !== 'almanac' && c !== 'media').join(', ')
      console.log(
        `  ${type}  ${year}  "${post.title}"` +
          `  [${imgCount} imgs | ${subCats || '—'}]`,
      )
      if (isMedia) {
        const pub = post.acfFields['publication_name'] ?? ''
        const pubDate = post.acfFields['publication_date'] ?? ''
        const author = post.acfFields['article_author'] ?? ''
        if (pub || pubDate)
          console.log(`           pub: "${pub}"  date: "${pubDate}"  author: "${author}"`)
      }
    }
    console.log(`\n  Total: ${posts.length} posts (${almanacPosts.length} almanac + ${mediaPosts.length} media)`)
    console.log('  Dry run done. Remove --dry-run to import.')
    return
  }

  // 3. Login
  console.log('3/5  Logging in…')
  const token = await payloadLogin()
  console.log('     OK')

  // 4. Import
  console.log('4/5  Importing…\n')
  let created = 0
  let skipped = 0
  let imagesFailed = 0

  for (const post of posts) {
    const isMedia = post.categories.includes('media')

    const year = isMedia
      ? (extractYear(post.acfFields['publication_date'] ?? '') || String(post.date.getFullYear()))
      : String(post.date.getFullYear())

    // Idempotency: skip if entry already exists AND has images.
    // If it exists with 0 images (e.g. previous run had upload errors), patch images.
    const existing = await findEntry(token, post.title, year)
    if (existing && existing.imageCount > 0) {
      console.log(`  SKIP  "${post.title}" (${year}) — already has ${existing.imageCount} img(s)`)
      skipped++
      continue
    }

    // Resolve images: gallery shortcode order first, fall back to parent-attached
    const imgIds = post.galleryIds.length > 0 ? post.galleryIds : post.parentAttachmentIds
    const imageList = imgIds
      .map((id) => attachments.get(id))
      .filter((a): a is WpAttachment => a !== undefined)

    // Upload images
    const uploadedImages: Array<{ image: number; caption: string }> = []
    if (!skipImages) {
      for (const img of imageList) {
        try {
          const buf = await downloadToBuffer(img.url)
          const mediaId = await uploadMedia(
            token,
            buf,
            filenameFromUrl(img.url),
            mimeFromUrl(img.url),
            img.title || post.title,
          )
          uploadedImages.push({ image: mediaId, caption: img.title || '' })
        } catch (err) {
          console.warn(`  ⚠ img failed: ${filenameFromUrl(img.url)} — ${(err as Error).message}`)
          imagesFailed++
        }
      }
    }

    // Description: strip HTML and shortcodes → single Lexical paragraph
    const plainText = stripToPlain(post.htmlContent)
    const description = plainText ? toLexicalParagraph(plainText) : undefined

    // sortOrder: date as YYYYMMDD so it's naturally sortable
    const sortOrder = parseInt(post.date.toISOString().slice(0, 10).replace(/-/g, ''), 10)

    // customFields
    const customFields: Record<string, unknown> = {
      wpPostId: post.id,
      wpSlug: post.slug,
      wpCategories: post.categories,
      wpTags: post.tags.length ? post.tags : undefined,
    }
    if (isMedia) {
      customFields.mediaEntry = {
        publicationName: post.acfFields['publication_name'] ?? '',
        publicationSubTitle: post.acfFields['publication_sub-title'] ?? '',
        publicationDate: post.acfFields['publication_date'] ?? '',
        articleTitle: post.acfFields['article_title'] ?? '',
        articleAuthor: post.acfFields['article_author'] ?? '',
        onlineArticleLink: post.acfFields['online_article_link'] ?? '',
        pageRange: post.acfFields['page_range'] ?? '',
      }
    }

    const type = isMedia ? 'media  ' : 'almanac'
    const imgNote = skipImages
      ? '(imgs skipped)'
      : `${uploadedImages.length}/${imageList.length} imgs`

    if (existing) {
      // Entry exists but had 0 images — patch with newly uploaded images
      if (uploadedImages.length > 0) {
        await patchEntryImages(token, existing.id, uploadedImages)
        console.log(`  PATCH ${type}  "${post.title}" (${year}) — ${imgNote}`)
      } else {
        console.log(`  SKIP  "${post.title}" (${year}) — exists, still 0 imgs uploadable`)
      }
      skipped++
    } else {
      await createEntry(token, {
        title: post.title,
        year,
        place: '',
        description,
        images: uploadedImages,
        sortOrder,
        _status: 'published',
        customFields,
      })
      created++
      console.log(`  OK  ${type}  "${post.title}" (${year}) — ${imgNote}`)
    }
  }

  // 5. Summary
  console.log('\n5/5  Done.\n')
  console.log(`  Created:     ${created}`)
  console.log(`  Skipped:     ${skipped}  (already existed)`)
  console.log(`  Img errors:  ${imagesFailed}`)
  if (imagesFailed > 0) {
    console.log('\n  ⚠ Some images failed. Re-run to retry — existing entries will be')
    console.log('    skipped but their missing images will NOT be retried automatically.')
    console.log('    Add them manually via /admin/collections/entries.')
  }
  console.log('\n  Review: /admin/collections/entries')
  process.exit(0)
}

migrate().catch((err) => {
  console.error('\n❌ Migration failed:', err)
  process.exit(1)
})
