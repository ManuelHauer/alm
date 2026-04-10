import type { CollectionConfig } from 'payload'

import { autoSlug } from '../hooks/autoSlug'

/**
 * Folios — curated collections, NOT tags. Per handoff §5.2.
 *
 * An entry can belong to zero or many folios. Folios appear as filter
 * chips on /search and are managed independently of entries.
 */
export const Folios: CollectionConfig = {
  slug: 'folios',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'sortOrder'],
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeValidate: [
      // Reuse the title-based slug helper by aliasing `name` → `title` shape.
      ({ data, ...rest }) => {
        if (!data) return data
        const aliased = { ...data, title: data.title ?? data.name }
        return autoSlug({ data: aliased, ...rest })
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
    },
  ],
}
