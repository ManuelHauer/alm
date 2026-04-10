import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { handleGifUpload } from '../hooks/handleGifUpload'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Media — Payload's built-in upload collection. Per handoff §5.3.
 *
 * staticDir resolves relative to this file: src/payload/collections/Media.ts
 * → ../../../media (project root /media). The /media folder is in
 * .gitignore and will be a Docker volume mount in production.
 *
 * GIF animation handling: handleGifUpload tags GIFs with isAnimatedGif.
 * Day-1 verification (2026-04-11) confirmed Sharp's resize variants DO
 * preserve animation, so the flag is informational. See hooks/handleGifUpload.ts.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  upload: {
    staticDir: path.resolve(dirname, '../../../media'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: undefined, position: 'centre' },
      { name: 'medium', width: 1200, height: undefined, position: 'centre' },
      { name: 'large', width: 2400, height: undefined, position: 'centre' },
    ],
  },
  hooks: {
    beforeChange: [handleGifUpload],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'isAnimatedGif',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description:
          'Auto-detected on upload. Sharp 0.34 preserves animation in resize variants, but the flag remains for GIF-aware frontend logic.',
      },
    },
  ],
}
