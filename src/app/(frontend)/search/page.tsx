import configPromise from '@payload-config'
import { getPayload } from 'payload'

import MobileNavRail from '@/components/MobileNavRail/MobileNavRail'
import type { FolioItem } from '../../api/folios/route'
import type { Media } from '@/payload-types'
import type { EntryIndexItem } from '@/types/entry'
import SearchView from './SearchView'
import styles from './search.module.css'

export const metadata = {
  title: 'Search — alm',
}

export default async function SearchPage() {
  const payload = await getPayload({ config: configPromise })

  // Load all entries and folios server-side for initial render
  const [entriesResult, foliosResult] = await Promise.all([
    payload.find({
      collection: 'entries',
      depth: 1,
      sort: '-sortOrder',
      limit: 1000,
    }),
    payload.find({
      collection: 'folios',
      sort: 'sortOrder',
      limit: 100,
    }),
  ])

  const entries: EntryIndexItem[] = entriesResult.docs.map((entry) => {
    const firstImageRow = entry.images?.[0]
    const media =
      firstImageRow && typeof firstImageRow.image === 'object'
        ? (firstImageRow.image as Media)
        : null
    return {
      id: entry.id,
      slug: entry.slug,
      entryNumber: entry.entryNumber,
      title: entry.title,
      hasImages: (entry.images?.length ?? 0) > 0,
      firstImageThumbnailUrl: media?.sizes?.thumbnail?.url ?? media?.url ?? null,
      sortOrder: entry.sortOrder ?? 0,
    }
  })

  const folios: FolioItem[] = foliosResult.docs.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    sortOrder: f.sortOrder ?? 0,
  }))

  return (
    <div className={styles.page}>
      <MobileNavRail />
      <SearchView initialEntries={entries} folios={folios} />
    </div>
  )
}
