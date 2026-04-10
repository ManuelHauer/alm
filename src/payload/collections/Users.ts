import type { CollectionConfig } from 'payload'

/**
 * Users — Payload's built-in auth collection. Per handoff §5.6.
 *
 * Multiple admin users supported out of the box. Auth uses Payload's
 * native HTTP-only cookies (allowed by hard constraint §8.9 — admin
 * auth cookies are exempted from the cookieless requirement).
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email'],
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
  ],
}
