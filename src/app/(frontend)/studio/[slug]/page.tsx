import Link from 'next/link'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'

import MobileNavRail from '@/components/MobileNavRail/MobileNavRail'
import RichText from '@/components/RichText/RichText'
import type { Media } from '@/payload-types'

import styles from '../studio.module.css'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'studio-pages',
    where: { pageSlug: { equals: slug } },
    limit: 1,
  })
  const page = docs[0]
  if (!page) return { title: 'Studio' }

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
  const heroMedia =
    page.heroImage && typeof page.heroImage === 'object'
      ? (page.heroImage as import('@/payload-types').Media)
      : null
  const ogImageUrl =
    baseUrl && heroMedia?.sizes?.large?.url
      ? `${baseUrl}${heroMedia.sizes.large.url}`
      : undefined

  return {
    title: page.title,
    openGraph: {
      title: page.title,
      ...(ogImageUrl && { images: [{ url: ogImageUrl, alt: page.title }] }),
    },
  }
}

export default async function StudioSubPage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'studio-pages',
    where: { pageSlug: { equals: slug } },
    depth: 1,
    limit: 1,
  })

  const page = docs[0]
  if (!page) notFound()

  const heroMedia =
    page.heroImage && typeof page.heroImage === 'object'
      ? (page.heroImage as Media)
      : null

  return (
    <div className={styles.page}>
      <MobileNavRail />
      <div className={styles.root}>
      <div className={styles.content}>
        <Link href="/studio" className={styles.back}>← Studio</Link>

        {heroMedia?.url && (
          <div className={styles.hero}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroMedia.sizes?.large?.url ?? heroMedia.url}
              alt={heroMedia.alt ?? page.title}
              className={styles.heroImg}
            />
          </div>
        )}

        <h1 className={styles.pageTitle}>{page.title}</h1>

        {page.content && <RichText data={page.content} />}
      </div>
      </div>
    </div>
  )
}
