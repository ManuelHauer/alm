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

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'studio-pages',
    limit: 100,
  })
  return docs.map((page) => ({ slug: page.pageSlug }))
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
  return { title: page ? `${page.title} — alm` : 'Studio — alm' }
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
