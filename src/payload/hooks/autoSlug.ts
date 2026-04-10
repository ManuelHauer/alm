import type { CollectionBeforeValidateHook } from 'payload'

/**
 * Generates a URL-safe slug from `title` if no slug is provided.
 *
 * Implementation is intentionally tiny — no `slugify` dependency. Lowercases,
 * strips diacritics, replaces non-alphanumeric runs with `-`, trims leading
 * and trailing dashes. Good enough for entry titles like "Project Foo" or
 * "Café 2019".
 *
 * Note: this does NOT enforce uniqueness — that's handled by the unique
 * constraint on the slug field. If a collision occurs, the validate step
 * will reject the create and surface the error to the admin user.
 */
const slugify = (input: string): string =>
  input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const autoSlug: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data
  if (data.slug && String(data.slug).trim().length > 0) return data
  if (!data.title) return data

  return {
    ...data,
    slug: slugify(String(data.title)),
  }
}
