import { getAllEntries } from '@/lib/getEntries'
import EntryNavigator from '@/components/EntryNavigator/EntryNavigator'

export const metadata = {
  title: 'alm',
  description: 'alm project — editorial archive',
}

export default async function HomePage() {
  const entries = await getAllEntries()
  return <EntryNavigator entries={entries} />
}
