import type { MetadataRoute } from 'next'

import { getAllEntries } from '@/lib/getEntries'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'https://almproject.com'
  const entries = await getAllEntries()

  const studioSlugs = ['andrea', 'practice', 'point-of-departure', 'contact']

  return [
    { url: baseUrl, priority: 1.0, changeFrequency: 'daily' },
    { url: `${baseUrl}/search`, priority: 0.7, changeFrequency: 'weekly' },
    { url: `${baseUrl}/studio`, priority: 0.6, changeFrequency: 'monthly' },
    ...studioSlugs.map((slug) => ({
      url: `${baseUrl}/studio/${slug}`,
      priority: 0.5,
      changeFrequency: 'monthly' as const,
    })),
    ...entries.map((entry) => ({
      url: `${baseUrl}/entry/${entry.slug}`,
      priority: 0.8,
      changeFrequency: 'monthly' as const,
    })),
  ]
}
