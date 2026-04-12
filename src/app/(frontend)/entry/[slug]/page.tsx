import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import EntryNavigator from '@/components/EntryNavigator/EntryNavigator'
import { getAllEntries } from '@/lib/getEntries'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ from?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const entries = await getAllEntries()
  const entry = entries.find((e) => e.slug === slug)
  if (!entry) return {}

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
  const ogImageUrl =
    baseUrl && entry.images[0]?.image.sizes?.large?.url
      ? `${baseUrl}${entry.images[0].image.sizes.large.url}`
      : undefined

  return {
    title: entry.title,
    description: entry.plainDescription ?? undefined,
    openGraph: {
      title: entry.title,
      description: entry.plainDescription ?? undefined,
      ...(ogImageUrl && {
        images: [
          {
            url: ogImageUrl,
            width: entry.images[0].image.sizes?.large
              ? entry.images[0].image.width
              : undefined,
            height: entry.images[0].image.sizes?.large
              ? entry.images[0].image.height
              : undefined,
            alt: entry.title,
          },
        ],
      }),
    },
  }
}

/**
 * /entry/[slug] — direct entry link.
 *
 * Server-renders with the correct initial entry so the page is fully
 * crawlable and shareable. After hydration, EntryNavigator takes over
 * and the user can navigate the full archive from this entry.
 */
export default async function EntryPage({ params, searchParams }: Props) {
  const [{ slug }, { from }] = await Promise.all([params, searchParams])
  const entries = await getAllEntries()
  if (!entries.find((e) => e.slug === slug)) notFound()

  return <EntryNavigator entries={entries} initialSlug={slug} showBack={from === 'search'} />
}
