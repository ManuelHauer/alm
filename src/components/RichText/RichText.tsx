/**
 * RichText — renders Payload Lexical JSON as HTML server-side.
 *
 * Used by studio pages and (eventually) TXT entry descriptions.
 * Pass the raw Lexical JSON from Payload's richText field.
 */

import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'

import styles from './RichText.module.css'

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  className?: string
}

export default function RichText({ data, className }: Props) {
  if (!data) return null

  const html = convertLexicalToHTML({ data })

  return (
    <div
      className={`${styles.richText} ${className ?? ''}`}
      // Safe: HTML is generated from trusted CMS content, not user input
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
