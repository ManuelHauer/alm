import React from 'react'
import type { Metadata, Viewport } from 'next'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

import IntroAnimation from '@/components/IntroAnimation/IntroAnimation'
import './styles.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: {
    default: 'alm',
    template: '%s — alm',
  },
  description: 'alm project — editorial archive',
  openGraph: {
    siteName: 'alm project',
    type: 'website',
  },
}

// Force dynamic rendering so next build never tries to pre-render pages
// that need a live database connection. All frontend pages inherit this.
export const dynamic = 'force-dynamic'

// Cache site-settings for 60s to avoid a DB hit on every request
const getCachedSiteSettings = unstable_cache(
  async () => {
    const payload = await getPayload({ config: configPromise })
    return payload.findGlobal({ slug: 'site-settings' })
  },
  ['site-settings'],
  { revalidate: 60 },
)

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props
  let introEnabled = true
  try {
    const siteSettings = await getCachedSiteSettings()
    introEnabled = siteSettings.introAnimation ?? true
  } catch {
    // DB unavailable on first boot — use defaults so the page still renders
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <IntroAnimation enabled={introEnabled} />
        {/* skip-to-content link — visually hidden until focused */}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <main id="main-content">{children}</main>
      </body>
    </html>
  )
}
