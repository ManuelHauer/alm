import Link from 'next/link'
import MobileNavRail from '@/components/MobileNavRail/MobileNavRail'
import { getSiteSettings } from '@/lib/getSiteSettings'
import styles from './not-found.module.css'

export const metadata = {
  title: '404 — Not Found',
}

export default async function NotFound() {
  const siteSettings = await getSiteSettings().catch(() => null)

  return (
    <div className={styles.page}>
      <MobileNavRail shopUrl={siteSettings?.shopUrl ?? null} instagramUrl={siteSettings?.instagramUrl ?? null} />
      <div className={styles.content}>
        <p className={styles.code}>404</p>
        <p className={styles.message}>Page not found.</p>
        <Link href="/" className={styles.link}>← Back to archive</Link>
      </div>
    </div>
  )
}
