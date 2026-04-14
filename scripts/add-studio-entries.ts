/**
 * add-studio-entries.ts — Create the 11 studio portfolio entries from almproject.com.
 *
 * Downloads each image from almproject.com, uploads to Payload media,
 * then creates the entry with title, description, place, folios, and image.
 *
 * Folio IDs (production):
 *   5 = architecture, 6 = identity, 7 = writing, 8 = press,
 *   9 = books, 10 = awards, 11 = news
 *
 * Usage:
 *   PAYLOAD_URL=http://5.78.205.65 pnpm tsx scripts/add-studio-entries.ts [--dry-run]
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import https from 'node:https'
import http from 'node:http'

// ─── config ──────────────────────────────────────────────────────────────────

const PAYLOAD_URL = process.env.PAYLOAD_URL ?? 'http://5.78.205.65'
const PAYLOAD_EMAIL = process.env.PAYLOAD_EMAIL ?? 'andrea@alm.local'
const PAYLOAD_PASSWORD = process.env.PAYLOAD_PASSWORD ?? 'Alm2024admin!'
const DRY_RUN = process.argv.includes('--dry-run')

// ─── entry definitions ───────────────────────────────────────────────────────

const ENTRIES = [
  {
    title: 'DESERT GOLD',
    description: 'Restoration of the McCurdy Residence by William Cody, Eldorado Club.',
    place: 'Indian Wells, CA',
    folioIds: [5],
    imageUrl: 'https://almproject.com/wp-content/uploads/2025/05/ALM_0188-comped.jpg',
    imageAlt: 'Desert Gold — McCurdy Residence restoration',
  },
  {
    title: 'EMBASSY FOR WOMEN',
    description: 'Architecture, interiors and creative direction for the Vital Voices Headquarters.',
    place: 'Washington, DC',
    folioIds: [5, 6],
    imageUrl: 'https://almproject.com/wp-content/uploads/2023/08/05-vital-voices-scaled.jpg',
    imageAlt: 'Embassy for Women — Vital Voices Headquarters',
  },
  {
    title: 'UNA A LA VOLTA',
    description: "Architecture and identity for Pizzana's fourth location.",
    place: 'Beverly Hills, CA',
    folioIds: [5, 6],
    imageUrl: 'https://almproject.com/wp-content/uploads/2023/08/02-pizzana-scaled.jpg',
    imageAlt: 'Una a la Volta — Pizzana Beverly Hills',
  },
  {
    title: 'MULHOLLAND DRIVE',
    description: 'Architecture and identity for Otium, Downtown Los Angeles.',
    place: 'Los Angeles, CA',
    folioIds: [5],
    imageUrl: 'https://almproject.com/wp-content/uploads/2023/08/03-mulholland-scaled.jpg',
    imageAlt: 'Mulholland Drive — Otium restaurant',
  },
  {
    title: 'BENU',
    description: "Architecture and identity for Corey Lee's restaurant in SoMa.",
    place: 'San Francisco, CA',
    folioIds: [5, 6],
    imageUrl: 'https://almproject.com/wp-content/uploads/2023/08/04-benu-scaled.jpg',
    imageAlt: 'Benu — Corey Lee restaurant',
  },
  {
    title: 'ITTORYU GOZU',
    description: 'Architecture and identity for the private dining club in SoMa.',
    place: 'San Francisco, CA',
    folioIds: [5, 6],
    imageUrl: 'https://almproject.com/wp-content/uploads/2023/08/06-gozu-scaled.jpg',
    imageAlt: 'Ittoryu Gozu — private dining club',
  },
  {
    title: 'SHIRO',
    description: 'Identity and packaging for the miso brand by chef Shotaro Kamio.',
    place: 'Los Angeles, CA',
    folioIds: [6],
    imageUrl: 'https://almproject.com/wp-content/uploads/2023/08/07-shiro-scaled.jpg',
    imageAlt: 'Shiro — miso brand identity',
  },
  {
    title: 'IN SITU',
    description: "Architecture and identity for SFMOMA's restaurant.",
    place: 'San Francisco, CA',
    folioIds: [5, 6],
    imageUrl: 'https://almproject.com/wp-content/uploads/2023/08/08-insitu-scaled.jpg',
    imageAlt: 'In Situ — SFMOMA restaurant',
  },
  {
    title: 'CHOBANI CAFÉ',
    description: "Architecture and identity for Chobani's café.",
    place: 'New York, NY',
    folioIds: [5, 6],
    imageUrl: 'https://almproject.com/wp-content/uploads/2023/08/09-chobani-scaled.jpg',
    imageAlt: 'Chobani Café — New York City',
  },
  {
    title: 'ON A CLEAR DAY YOU CAN DREAM FOREVER',
    description: 'Identity for Odys + Penelope.',
    place: 'Los Angeles, CA',
    folioIds: [6],
    imageUrl: 'https://almproject.com/wp-content/uploads/2023/08/10-on-a-clear-day-scaled.jpg',
    imageAlt: 'On a Clear Day You Can Dream Forever — Odys + Penelope',
  },
  {
    title: 'GOOD MORNING LA',
    description: '',
    place: 'Los Angeles, CA',
    folioIds: [6],
    imageUrl: null,
    imageAlt: null,
  },
]

// ─── helpers ─────────────────────────────────────────────────────────────────

function downloadToFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(dest)
    proto
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          file.close()
          fs.unlinkSync(dest)
          reject(new Error(`HTTP ${res.statusCode} downloading ${url}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
      })
      .on('error', (err) => {
        file.close()
        try { fs.unlinkSync(dest) } catch { /* ignore */ }
        reject(err)
      })
  })
}

async function login(): Promise<string> {
  const res = await fetch(`${PAYLOAD_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PAYLOAD_EMAIL, password: PAYLOAD_PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { token?: string }
  if (!data.token) throw new Error('No token in login response')
  return data.token
}

async function uploadMedia(token: string, filePath: string, alt: string): Promise<number> {
  const form = new FormData()
  const bytes = fs.readFileSync(filePath)
  const blob = new Blob([bytes], { type: 'image/jpeg' })
  form.append('file', blob, path.basename(filePath))
  // Payload 3 multipart: non-file fields must be in a _payload JSON string
  form.append('_payload', JSON.stringify({ alt: alt || path.basename(filePath) }))

  const res = await fetch(`${PAYLOAD_URL}/api/media`, {
    method: 'POST',
    headers: { Authorization: `JWT ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Media upload failed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { doc?: { id?: number } }
  const id = data.doc?.id
  if (!id) throw new Error(`No media ID in upload response: ${JSON.stringify(data)}`)
  return id
}

/** Derive slug the same way the autoSlug hook does. */
function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Returns the existing entry ID if a matching slug already exists, else null. */
async function findBySlug(token: string, slug: string): Promise<number | null> {
  const res = await fetch(
    `${PAYLOAD_URL}/api/entries?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
    { headers: { Authorization: `JWT ${token}` } },
  )
  if (!res.ok) return null
  const data = await res.json() as { docs?: Array<{ id: number }> }
  return data.docs?.[0]?.id ?? null
}

async function deleteEntry(token: string, id: number): Promise<void> {
  await fetch(`${PAYLOAD_URL}/api/entries/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `JWT ${token}` },
  })
}

async function upsertEntry(
  token: string,
  entry: (typeof ENTRIES)[number],
  mediaId: number | null,
): Promise<void> {
  const body: Record<string, unknown> = {
    title: entry.title,
    place: entry.place || undefined,
    description: entry.description
      ? {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: entry.description }],
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        }
      : undefined,
    folios: entry.folioIds,
    images: mediaId ? [{ image: mediaId }] : [],
    _status: 'published',
  }

  // Remove undefined fields
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k])

  const slug = slugify(entry.title)
  const existingId = await findBySlug(token, slug)

  if (existingId) {
    // Update existing entry
    const res = await fetch(`${PAYLOAD_URL}/api/entries/${existingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Update entry failed: ${res.status} ${await res.text()}`)
    const data = await res.json() as { doc?: { id?: number; entryNumber?: number } }
    console.log(`  ↺ Updated: entry #${data.doc?.entryNumber} id=${data.doc?.id}`)
  } else {
    // Create new entry
    const res = await fetch(`${PAYLOAD_URL}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Create entry failed: ${res.status} ${await res.text()}`)
    const data = await res.json() as { doc?: { id?: number; entryNumber?: number } }
    console.log(`  ✓ Created: entry #${data.doc?.entryNumber} id=${data.doc?.id}`)
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) {
    console.log('[DRY RUN] No changes will be made.\n')
    for (const e of ENTRIES) {
      console.log(`  ${e.title} | folios: ${e.folioIds.join(', ')} | image: ${e.imageUrl ?? 'none'}`)
    }
    return
  }

  console.log(`Logging in to ${PAYLOAD_URL}…`)
  const token = await login()
  console.log('Logged in.\n')

  // Clean up the 3 image-less entries created in a failed earlier run
  // (IDs 226, 227, 228 — DESERT GOLD, EMBASSY FOR WOMEN, UNA A LA VOLTA)
  const STALE_IDS = [226, 227, 228]
  console.log('Deleting stale image-less entries from previous run…')
  for (const id of STALE_IDS) {
    await deleteEntry(token, id)
    console.log(`  Deleted id=${id}`)
  }
  console.log()

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alm-entries-'))

  for (const entry of ENTRIES) {
    console.log(`Processing: ${entry.title}`)

    let mediaId: number | null = null

    if (entry.imageUrl && entry.imageAlt) {
      const filename = entry.imageUrl.split('/').pop()!
      const localPath = path.join(tmpDir, filename)

      try {
        process.stdout.write(`  Downloading image…`)
        await downloadToFile(entry.imageUrl, localPath)
        process.stdout.write(` done\n`)

        process.stdout.write(`  Uploading to Payload…`)
        mediaId = await uploadMedia(token, localPath, entry.imageAlt)
        process.stdout.write(` mediaId=${mediaId}\n`)
      } catch (err) {
        console.error(`  ✗ Image error: ${err instanceof Error ? err.message : err}`)
        console.log(`  Continuing without image…`)
      } finally {
        try { fs.unlinkSync(localPath) } catch { /* ignore */ }
      }
    } else {
      console.log(`  No image for this entry.`)
    }

    await upsertEntry(token, entry, mediaId)
  }

  // Cleanup temp dir
  try { fs.rmdirSync(tmpDir) } catch { /* ignore */ }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
