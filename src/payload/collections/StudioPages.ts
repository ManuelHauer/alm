import type { CollectionConfig } from 'payload'

/**
 * StudioPages — managed content for /studio/* subpages. Per handoff §5.4.
 *
 * Pre-seeded with: andrea, practice, point-of-departure, books, contact.
 * pageSlug is the unique key the frontend looks up by.
 */
export const StudioPages: CollectionConfig = {
  slug: 'studio-pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['pageSlug', 'title', 'sortOrder'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'pageSlug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL segment after /studio/. e.g. "andrea", "practice".',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
    },
  ],
}
