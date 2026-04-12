/**
 * One-off script: updates studio pages in the existing DB with real text content.
 * Removes "Books" page, updates andrea/practice/point-of-departure/contact.
 *
 * Run with:  pnpm tsx scripts/update-studio.ts
 */
import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload/payload.config'

const lexParagraph = (text: string) => ({
  type: 'paragraph',
  format: '' as const,
  indent: 0,
  version: 1,
  direction: 'ltr' as const,
  textFormat: 0,
  textStyle: '',
  children: [{ type: 'text', format: 0, mode: 'normal', style: '', text, detail: 0, version: 1 }],
})

const lexMulti = (...paragraphs: string[]) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: paragraphs.map(lexParagraph),
  },
})

const updates: Record<string, { title?: string; sortOrder?: number; content: ReturnType<typeof lexMulti> }> = {
  andrea: {
    content: lexMulti(
      "Lenardin's approach to architecture and design has been shaped by growing up and studying in Vienna, where the visual and performing arts are part of everyday discourse. A sensitivity to the layers of time and meaning that accrue to places is a hallmark of her work, joined to an equal commitment to innovation.",
      "Her education in architecture is complemented by professional studies in graphic design, product design, and fashion design. Inspired by the Renaissance architect's polyvalence and ability to engage every dimension of a project, Lenardin is driven by the question: can I do more, only to arrive at less?",
      "By eliciting something particular from the generic and infusing the mundane with effortless artfulness, Lenardin's open-ended approach enables her to devise distinctive design solutions and execute them with rigor and ingenuity.",
      'Andrea Lenardin Madden AIA',
      'Mag Arch, University of Applied Arts, Vienna | M.Arch, SCI-Arc, Los Angeles',
      'Schindler Fellow | Fulbright Scholar',
    ),
  },
  practice: {
    content: lexMulti(
      'a l m project is a multidisciplinary design studio led by Andrea Lenardin Madden. The work of the studio is comprehensive in scope, touching every aspect of a project—architecture, interiors, and landscape; brand experience development, identity design, graphics and packaging; display and environmental signage systems, retail design, and digital interfaces.',
      'Each new project sets a l m on a journey. Energized as much by curiosity as by a desire to balance the elemental with the innovative, the studio begins by defining the distinctive mood that will inform a space, a building, an object, and ultimately shape its character and meaning. A collaborative process and a shared commitment to excellence ensure a final result of substance and integrity. Based in Los Angeles and Vienna, the studio works fluently across cultures and time zones.',
    ),
  },
  'point-of-departure': {
    content: lexMulti(
      'Over the years, Andrea Lenardin Madden has built a practice at the intersection of architecture and art, with an eye toward the broader domain of placemaking. The studio\'s projects are keyed to a specific place and time, and are guided by two experiential approaches that have come to frame its thinking: instant days and future memories.',
      'Lenardin coined the term "instant days" to describe an early theoretical project that gave form to a vision of architectural practice as a holistic consideration of space and the objects it contains—one in which every aspect is imbued with both visceral and visual content that nourishes inhabitants and users.',
      'Guided by this underlying methodology, the process moves through deep analysis, strategic exploration of program, and the distillation of intrinsic elements and qualities. The result is an open-ended system in which change is embraced as an opportunity to set the stage for future memories.',
    ),
  },
  contact: {
    sortOrder: 4,
    content: lexMulti(
      'a l m project inc',
      '5544 Hollywood Boulevard, Los Angeles CA 90028',
      'Los Angeles +1 323 570 0571',
      'studio@almproject.com',
      'Vienna +43 1 581 1896',
      'atelier@almproject.com',
      'a l m Los Angeles is currently accepting internship applications.',
      'studio@almproject.com',
    ),
  },
}

async function run() {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'studio-pages',
    limit: 100,
    overrideAccess: true,
  })

  for (const page of docs) {
    if (page.pageSlug === 'books') {
      await payload.delete({ collection: 'studio-pages', id: page.id, overrideAccess: true })
      console.log('  ✓ deleted books')
      continue
    }
    const update = updates[page.pageSlug]
    if (update) {
      await payload.update({
        collection: 'studio-pages',
        id: page.id,
        data: update,
        overrideAccess: true,
      })
      console.log(`  ✓ updated ${page.pageSlug}`)
    }
  }
  console.log('done.')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
