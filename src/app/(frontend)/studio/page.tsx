import Link from 'next/link'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'

import MobileNavRail from '@/components/MobileNavRail/MobileNavRail'
import { getSiteSettings } from '@/lib/getSiteSettings'
import styles from './studio.module.css'

export const metadata = {
  title: 'Studio',
  description: 'About alm project — a multidisciplinary design studio led by Andrea Lenardin Madden.',
}

export default async function StudioOverviewPage() {
  const payload = await getPayload({ config: configPromise })

  const [{ docs }, siteSettings] = await Promise.all([
    payload.find({ collection: 'studio-pages', sort: 'sortOrder', limit: 100 }),
    getSiteSettings().catch(() => null),
  ])

  if (!docs.length) notFound()

  return (
    <div className={styles.page}>
      <MobileNavRail shopUrl={siteSettings?.shopUrl ?? null} instagramUrl={siteSettings?.instagramUrl ?? null} />
      <div className={styles.root}>
        <div className={styles.content}>
          <h1 className={styles.pageTitle}>Studio</h1>
          <nav>
            <ul className={styles.navList}>
              {docs.map((page) => (
                <li key={page.id} className={styles.navItem}>
                  <Link href={`/studio/${page.pageSlug}`}>{page.title}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  )
}
