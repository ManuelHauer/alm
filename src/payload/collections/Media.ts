import type { CollectionConfig } from 'payload'
import path from 'path'

import { handleGifUpload } from '../hooks/handleGifUpload'

/**
 * Media — Payload's built-in upload collection. Per handoff §5.3.
 *
 * staticDir uses process.cwd() so it resolves correctly in both local dev
 * (~/Code/alm → ~/Code/alm/media) and Docker standalone output (/app → /app/media).
 * The /media folder is in .gitignore and is a Docker volume mount in production.
 *
 * GIF animation handling: handleGifUpload tags GIFs with isAnimatedGif.
 * Day-1 verification (2026-04-11) confirmed Sharp's resize variants DO
 * preserve animation, so the flag is informational. See hooks/handleGifUpload.ts.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  folders: true,
  access: {
    read: () => true,
  },
  upload: {
    staticDir: path.resolve(process.cwd(), 'media'),
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
