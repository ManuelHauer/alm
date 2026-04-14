import type { Metadata } from 'next'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { getAllEntries } from '@/lib/getEntries'
import EntryNavigator from '@/components/EntryNavigator/EntryNavigator'

const getCachedSiteSettings = unstable_cache(
  async () => {
    const payload = await getPayload({ config: configPromise })
    return payload.findGlobal({ slug: 'site-settings' })
  },
  ['site-settings'],
  { revalidate: 60 },
)

export async function generateMetadata(): Promise<Metadata> {
  const entries = await getAllEntries()
  const first = entries[0]
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''

  const ogImageUrl =
    baseUrl && first?.images[0]?.image.sizes?.large?.url
      ? `${baseUrl}${first.images[0].image.sizes.large.url}`
      : undefined

  return {
    title: 'alm',
    description: 'alm project — editorial archive',
    openGraph: {
      title: 'alm project',
      description: 'alm project — editorial archive',
      ...(ogImageUrl && {
        images: [{ url: ogImageUrl, alt: 'alm project' }],
      }),
    },
  }
}

export default async function HomePage() {
  const entries = await getAllEntries()

  // Shuffle: pick a random entry as the landing entry when shuffleMode is on.
  // Math.random() runs per-request (outside the cache) so each visit gets a
  // different entry. The settings DB read is cached separately for 60s.
  let initialSlug: string | undefined
  try {
    const siteSettings = await getCachedSiteSettings()
    if ((siteSettings.shuffleMode ?? true) && entries.length > 0) {
      const randomIdx = Math.floor(Math.random() * entries.length)
      initialSlug = entries[randomIdx].slug
    }
  } catch {
    // DB unavailable — fall through, shows the first entry
  }

  return <EntryNavigator entries={entries} initialSlug={initialSlug} />
}
