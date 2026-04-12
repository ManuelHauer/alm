import type { Metadata } from 'next'

import { getAllEntries } from '@/lib/getEntries'
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
  return <EntryNavigator entries={entries} />
}
