import type { CollectionBeforeValidateHook } from 'payload'

/**
 * Auto-assigns the next entryNumber on create if one isn't provided.
 *
 * Strategy: query for the entry with the highest entryNumber and add 1.
 * Race condition note: in a single-admin CMS this is fine. If concurrent
 * creates ever become a concern, switch to a Postgres sequence.
 *
 * Per handoff §5.1: "Auto-assigned. Override only if needed."
 */
export const autoEntryNumber: CollectionBeforeValidateHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== 'create') return data
  if (data?.entryNumber != null) return data

  const result = await req.payload.find({
    collection: 'entries',
    sort: '-entryNumber',
    limit: 1,
    depth: 0,
    pagination: false,
    // Include drafts so the counter never collides with an unpublished entry
    draft: true,
    overrideAccess: true,
  })

  const highest = result.docs[0]?.entryNumber ?? 0
  return {
    ...data,
    entryNumber: highest + 1,
  }
}
