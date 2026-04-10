import type { CollectionConfig } from 'payload'

import { autoEntryNumber } from '../hooks/autoEntryNumber'
import { autoSlug } from '../hooks/autoSlug'
import { extractPlainDescription } from '../hooks/extractPlainDescription'

/**
 * Entries — the core collection. Per handoff §5.1.
 *
 * Drafts/publish handled by Payload's native `versions: { drafts: true }`.
 * Do NOT add a manual `status` select field (constraint §8.5).
 */
export const Entries: CollectionConfig = {
  slug: 'entries',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['entryNumber', 'title', '_status', 'sortOrder'],
  },
  access: {
    // Public read for published entries only.
    // Drafts are visible to authenticated users via the admin panel.
    read: ({ req: { user } }) => {
      if (user) return true
      return {
        _status: { equals: 'published' },
      }
    },
  },
  versions: {
    drafts: true,
  },
  hooks: {
    beforeValidate: [autoEntryNumber, autoSlug],
    beforeChange: [extractPlainDescription],
  },
  fields: [
    {
      name: 'entryNumber',
      type: 'number',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Auto-assigned. Override only if needed.',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Auto-generated from title. Used in URLs.',
      },
    },
    {
      name: 'year',
      type: 'text',
      admin: {
        description: 'e.g. "2012-2015" or "2019"',
      },
    },
    {
      name: 'place',
      type: 'text',
      admin: {
        description: 'e.g. "Los Angeles" or "Germany"',
      },
    },
    {
      name: 'description',
      type: 'richText',
      // Inherits the project-wide minimal Lexical config:
      // bold / italic / link / paragraph only.
    },
    {
      name: 'plainDescription',
      type: 'textarea',
      admin: {
        readOnly: true,
        description:
          'Auto-generated from description on save. Used for search and SEO meta. Do not edit manually.',
      },
    },
    {
      name: 'images',
      type: 'array',
      admin: {
        description: 'One or more images. Drag to reorder. GIFs supported.',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
        },
      ],
    },
    {
      name: 'folios',
      type: 'relationship',
      relationTo: 'folios',
      hasMany: true,
      admin: {
        description: 'Assign this entry to one or more curated collections.',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      index: true,
      admin: {
        description: 'Higher number = more recent. Controls display order.',
      },
    },
    {
      name: 'customFields',
      type: 'json',
      admin: {
        description:
          'Flexible key-value pairs for extra properties (e.g. collaborator, client).',
      },
    },
  ],
}
