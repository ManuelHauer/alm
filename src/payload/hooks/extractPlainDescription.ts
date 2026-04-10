import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Walks a Lexical editor JSON tree and concatenates every text node.
 *
 * Lexical's serialized shape is `{ root: { children: [...] } }` where every
 * node may have a `children` array (containers) and/or a `text` field
 * (text/leaf nodes). We do a simple recursive walk and join with spaces.
 *
 * Why beforeChange (not afterChange as the handoff literally says):
 * afterChange would require a follow-up `payload.update` to persist the
 * derived value, which costs an extra round-trip and risks recursion.
 * beforeChange lets us mutate `data` so the value is saved in the same
 * write. The algorithm — and the resulting field — is identical.
 */

type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
}

const walk = (node: LexicalNode | undefined, out: string[]): void => {
  if (!node) return
  if (typeof node.text === 'string' && node.text.length > 0) {
    out.push(node.text)
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child, out)
  }
}

export const extractPlainTextFromLexical = (
  richText: { root?: LexicalNode } | null | undefined,
): string => {
  if (!richText || !richText.root) return ''
  const parts: string[] = []
  walk(richText.root, parts)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export const extractPlainDescription: CollectionBeforeChangeHook = ({ data }) => {
  if (!data) return data
  return {
    ...data,
    plainDescription: extractPlainTextFromLexical(data.description),
  }
}
