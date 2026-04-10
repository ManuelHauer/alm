import { postgresAdapter } from '@payloadcms/db-postgres'
import {
  BoldFeature,
  ItalicFeature,
  LinkFeature,
  ParagraphFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Entries } from './collections/Entries'
import { Folios } from './collections/Folios'
import { Media } from './collections/Media'
import { StudioPages } from './collections/StudioPages'
import { Users } from './collections/Users'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// src/payload/ → src/
const srcDir = path.resolve(dirname, '..')

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: srcDir,
    },
  },
  collections: [Entries, Folios, Media, StudioPages, Users],
  globals: [SiteSettings],
  // Project-wide default editor — also used by any field that doesn't override.
  // Per handoff §5.1, the Entries.description field is restricted to the same
  // minimal toolbar (bold/italic/link/paragraph), so the default is sufficient.
  editor: lexicalEditor({
    features: () => [
      ParagraphFeature(),
      BoldFeature(),
      ItalicFeature(),
      LinkFeature(),
    ],
  }),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(srcDir, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [],
})
