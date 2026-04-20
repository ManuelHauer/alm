import type { Metadata } from 'next'

import { getAllEntries } from '@/lib/getEntries'
import { getSiteSettings } from '@/lib/getSiteSettings'
import EntryNavigator from '@/components/EntryNavigator/EntryNavigator'

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

  let initialSlug: string | undefined
  let shopUrl: string | null = null
  let instagramUrl: string | null = null
  try {
    const siteSettings = await getSiteSettings()
    if ((siteSettings.shuffleMode ?? true) && entries.length > 0) {
      const randomIdx = Math.floor(Math.random() * entries.length)
      initialSlug = entries[randomIdx].slug
    }
    shopUrl = siteSettings.shopUrl ?? null
    instagramUrl = siteSettings.instagramUrl ?? null
  } catch {
    // DB unavailable — fall through, use defaults
  }

  return <EntryNavigator entries={entries} initialSlug={initialSlug} shopUrl={shopUrl} instagramUrl={instagramUrl} />
}
