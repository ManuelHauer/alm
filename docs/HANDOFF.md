# ALM PROJECT — Final Implementation Handoff

> This is the single source of truth for building the alm website.
> It combines the product spec, architecture, content model, UX behavior,
> and execution milestones into one document.
> 
> Claude Code: read this entire file before writing any code.

---

## 1. Product Overview

**alm** is a portfolio/almanac website for a l m project, a multidisciplinary design studio led by Andrea Lenardin Madden (architecture, interiors, identity, packaging). The site is centered around an ever-growing list of **entries** — a chronological archive of projects, events, and studio life spanning 2004 to present (~130 entries, growing monthly).

The site replaces an existing WordPress site at almproject.com.

**Primary user:** Alm (Andrea / studio team) — non-technical, needs to manage all content without developer help.

**Visitors:** Design professionals, clients, press, collaborators worldwide.

---

## 2. Exact Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | **Use whatever version `create-payload-app` installs** |
| CMS | Payload CMS (embedded in Next.js) | 3.x |
| Database | PostgreSQL | 16 |
| DB Adapter | @payloadcms/db-postgres | latest |
| Rich Text | Lexical (@payloadcms/richtext-lexical) | latest |
| Image Processing | Sharp (via Payload) | latest |
| Styling | Tailwind CSS | 4.x |
| Language | TypeScript | 5.x |
| Deployment | Docker Compose on Hetzner VPS | — |
| PaaS | Coolify (self-hosted) | latest |
| CDN | Cloudflare (free tier, DNS + caching) | — |
| Analytics | None at launch. Optional: Plausible (self-hosted, cookieless) | — |

All tools are open-source and self-hosted. No vendor lock-in.

### Critical version constraint
Pin the exact Payload version that ships with `create-payload-app`. Do NOT independently upgrade Next.js or React. Payload 3 + React 19 has known interop edge cases — stay on the tested combination.

---

## 3. Brand Identity

### Colors
- **Primary orange:** `#E8531E` (verify against PDF swatches; if contrast on white fails WCAG AA, darken to `#D14A18`)
- **Black:** `#1A1A1A`
- **White:** `#FFFFFF`
- **Light grey (backgrounds):** `#F5F5F5`
- **Medium grey (secondary text):** `#888888`

### Typography
- System sans-serif stack: `"Helvetica Neue", Arial, sans-serif`
- Do NOT import Google Fonts or any external font CDN (privacy)
- Confirm with client before choosing a web font

### Design Direction
- Editorial, minimal, clean. Think gallery/museum website.
- Generous whitespace. No decorative elements.
- Content-first. The images and text ARE the design.
- Orange is used sparingly: entry numbers in focus, toggle button, active states.

---

## 4. Page Tree / Route Map

```
/                          → Landing (latest or random entry)
/entry/[slug]              → Direct link to a specific entry (shareable URL)
/search                    → Search + folio filtering
/studio                    → Studio overview (links to subpages)
/studio/andrea             → Andrea Lenardin Madden bio
/studio/practice           → Practice description + contact info
/studio/point-of-departure → Point of Departure essay
/studio/books              → Books (content TBD)
/studio/contact            → Contact information
/admin                     → Payload admin panel (auto-generated, auth-protected)
```

**Discarded from old site (do NOT build):**
- Media page (awards/press/books)
- Acronyms page
- Footer icon badges ("art limits mediocrity" etc.)
- "NOT TESTED ON ANIMALS" footer tagline
- Separate "work" page (work projects become regular entries)

### Important: /entry/[slug] behavior
This route must render the **same entry navigator component** used on `/`, initialized at the specified entry. It is NOT a separate detail page. When a user shares `/entry/some-project`, the recipient lands on that entry but can navigate prev/next as normal.

Implementation: the `/entry/[slug]/page.tsx` server component fetches the entry + the full entry index, then renders the same client-side navigator with an `initialEntrySlug` prop.

---

## 5. Content Model (Payload Collections)

### 5.1 Entries (the core collection)

```typescript
// src/payload/collections/Entries.ts
import type { CollectionConfig } from 'payload'

export const Entries: CollectionConfig = {
  slug: 'entries',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['entryNumber', 'title', '_status', 'sortOrder'],
  },
  // USE PAYLOAD'S NATIVE DRAFT/PUBLISH — do NOT use a manual status field
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: 'entryNumber',
      type: 'number',
      required: true,
      unique: true,
      admin: { description: 'Auto-assigned. Override only if needed.' },
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
      admin: { description: 'Auto-generated from title. Used in URLs.' },
    },
    {
      name: 'year',
      type: 'text',
      admin: { description: 'e.g. "2012-2015" or "2019"' },
    },
    {
      name: 'place',
      type: 'text',
      admin: { description: 'e.g. "Los Angeles" or "Germany"' },
    },
    {
      name: 'description',
      type: 'richText',
      // Configure Lexical with minimal toolbar: bold, italic, link, paragraph only.
      // No headings, no embeds, no tables, no images in rich text.
    },
    {
      // Plain text extraction of description, used for search indexing and SEO meta.
      // Populated automatically by afterChange hook — do NOT edit manually.
      name: 'plainDescription',
      type: 'textarea',
      admin: { readOnly: true, description: 'Auto-generated from description. Used for search.' },
    },
    {
      name: 'images',
      type: 'array',
      admin: { description: 'One or more images. Drag to reorder. GIFs supported.' },
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
      admin: { description: 'Assign this entry to one or more curated collections.' },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Higher number = more recent. Controls display order.' },
    },
    {
      name: 'customFields',
      type: 'json',
      admin: { description: 'Flexible key-value pairs for extra properties (e.g. collaborator, client).' },
    },
  ],
  hooks: {
    beforeValidate: [
      // autoEntryNumber: if creating new entry, set entryNumber = max(entryNumber) + 1
      // autoSlug: generate slug from title using slugify if slug not set
    ],
    afterChange: [
      // extractPlainDescription: traverse Lexical JSON tree, extract all text nodes,
      // concatenate, store in plainDescription field.
      // This is ~20 lines: recursive walk of the Lexical AST extracting .text from text nodes.
    ],
  },
}
```

### 5.2 Folios

Folios are **curated collections** — NOT tags. An entry can belong to zero or multiple folios. Folios are managed separately and appear as filter chips on the search page.

```typescript
export const Folios: CollectionConfig = {
  slug: 'folios',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'description', type: 'textarea' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
  ],
}
```

### 5.3 Media

Payload built-in upload collection. Configure image sizes for responsive delivery.

**GIF handling is critical:** Sharp strips animation frames from GIFs. Test this on day 1. If Payload 3 does not support per-file imageSizes override, the workaround is: check mimeType in a beforeOperation hook and set imageSizes to `[]` for GIFs, serving originals only. If that doesn't work, create a separate `gifs` collection with no image processing. Document what worked.

```typescript
export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: '../media',
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: undefined, position: 'centre' },
      { name: 'medium', width: 1200, height: undefined, position: 'centre' },
      { name: 'large', width: 2400, height: undefined, position: 'centre' },
    ],
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
  ],
}
```

### 5.4 Studio Pages

```typescript
export const StudioPages: CollectionConfig = {
  slug: 'studio-pages',
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'pageSlug', type: 'text', required: true, unique: true },
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'richText' },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
  ],
}
```

Pre-seed with these pages (content from the existing site):
- `andrea` — Andrea Lenardin Madden bio
- `practice` — Practice text + contact info
- `point-of-departure` — Point of Departure essay
- `books` — (content TBD, empty placeholder)
- `contact` — Contact info (LA and Vienna addresses, phone, email)

### 5.5 Site Settings (Payload Global)

```typescript
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  fields: [
    { name: 'shuffleMode', type: 'checkbox', defaultValue: true,
      admin: { description: 'When ON, landing page shows a random entry. When OFF, shows the latest.' } },
    { name: 'introAnimation', type: 'checkbox', defaultValue: true,
      admin: { description: 'Show the "NO COOKIES EVER" intro animation on first visit.' } },
    { name: 'instagramUrl', type: 'text', defaultValue: 'https://instagram.com/almproject' },
    { name: 'shopUrl', type: 'text', defaultValue: '' },
  ],
}
```

### 5.6 Users

Payload's built-in Users collection. Supports multiple admin users out of the box.

```typescript
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  fields: [
    { name: 'name', type: 'text' },
  ],
}
```

---

## 6. UX Behavior Spec

### 6.1 Homepage / Landing

- On load, check `site-settings.shuffleMode`.
- If ON → pick a random published entry (avoid repeating current).
- If OFF → pick the entry with the highest `sortOrder` (latest).
- Render entry in **IMG mode** by default (mobile).
- URL stays `/`. As user navigates, URL updates to `/entry/[slug]` via `history.replaceState` (no full reload).
- Tapping the "a l m" logo: if shuffle ON → random entry. If shuffle OFF → latest entry.

### 6.2 Entry Model — Two Views (IMG and TXT)

Every entry has exactly two content views:

**IMG view:** Shows the entry's image carousel (if images exist). Entry number (orange), title below, carousel dots if multiple images.

**TXT view:** Shows the entry's text content. Entry number (orange), title, year, place, full rich text description. Scrollable.

**There is no separate "detail page."** Entries are always viewed inline — either as IMG or TXT.

### 6.3 Mobile Behavior

- Screen shows ONE entry at a time, in either IMG or TXT view.
- **IMG/TXT toggle** (bottom of screen): orange pill toggle. Switches between views. The toggle state persists when navigating to the next/prev entry.
- **Navigation between entries:**
  - Swipe up/down → next/prev entry
  - Tap top half of screen → prev entry
  - Tap bottom half of screen → next entry
  - (These tap zones are on the image area or empty area, not on text content)
- **Image carousel (within an entry in IMG mode):**
  - Swipe left/right → next/prev image
  - Carousel dot indicators show position
  - Images use `object-fit: contain` (preserve aspect ratio, no crop)
- **Swipe conflict resolution:** Use `@use-gesture/react` with **axis lock**. Once a gesture begins, lock to whichever axis the first 10px of movement favors. Do NOT use velocity-based detection — it causes misfires on diagonal swipes. Axis lock matches native iOS behavior.
- **Text-only entries (no images):**
  - Always show TXT view.
  - Toggle is greyed out / disabled.
  - When navigating to a text-only entry while in IMG mode, show TXT view. When leaving, restore IMG mode if the next entry has images.

### 6.4 Desktop Behavior — Scroll-Linked Gallery

**Layout:**
- Left panel (~60% width): **sticky** (`position: sticky; top: 0; height: 100vh`). Shows the image gallery of the "in focus" entry.
- Right panel (~40% width): **scrollable** column of entry text blocks.
- No IMG/TXT toggle on desktop (both are always visible).

**Scroll snapping:**
- Right panel uses `scroll-snap-type: y proximity` (**NOT mandatory** — mandatory breaks when description text is longer than viewport).
- Each entry text block is a snap target (`scroll-snap-align: start`).
- When scroll snaps to a new entry, the left image gallery switches to that entry's images.

**Entry text blocks:**
- Fixed height (100vh or close to it) to maintain consistent snap targets.
- If description overflows the block, use `overflow-y: auto` **within** the block for internal scrolling. Do NOT let the block grow taller — this would break snap consistency.
- Content: entry number, title, year + place, description.

**Focus behavior:**
- The entry whose text block is snapped/most visible is "in focus."
- Detect focus: use `scrollend` event (or `IntersectionObserver` as fallback for Safari).
- In-focus entry: number is orange, text at full opacity.
- All other visible entry text blocks: `opacity: 0.4`, `transition: opacity 200ms`.
- Left gallery crossfades to the in-focus entry's images (~300ms CSS transition on opacity).

**Text-only entries on desktop:**
- Left panel shows empty/blank (light grey background or subtle "no image" state).
- Text block shows at full opacity when in focus.

**Image carousel on desktop:**
- Carousel dots below image in left panel for multi-image entries.
- Left/right arrow keys or click arrows to cycle images within entry.

### 6.5 Entry Navigation Logic

- All published entries are ordered by `sortOrder` descending (newest first).
- "Next" = lower sortOrder (older). "Prev" = higher sortOrder (newer).
- Navigation wraps: after the oldest entry, "next" goes to the newest (loop).
- On initial load, fetch a lightweight **entry index**: `[{ id, slug, entryNumber, title, firstImageThumbnailUrl, hasImages, sortOrder }]` for all published entries. Cache this aggressively (ISR: revalidate every 60s).
- Full entry data (description, all images) is fetched per-entry on demand.

### 6.6 Search Page (`/search`)

- **Search bar** at top, large and prominent.
- **Folio filter chips** below search bar. Horizontal scrollable row. Tapping a chip toggles it. Multiple can be active (OR logic: entries in ANY selected folio).
- **Results** update as user types (debounced 300ms) and as filters change.
- Results displayed as a **grid of entry cards**: thumbnail image (or placeholder if no image), entry number, title.
- Tapping a card navigates to `/entry/[slug]`.
- **Empty state:** "No entries found."
- **Initial state** (no query, no filters): show all published entries as a browsable grid, ordered by sortOrder.

**Search implementation:** Use Payload's built-in `where` queries with `like` operator on `title`, `plainDescription`, `year`, `place`. This is simpler than raw SQL tsvector and sufficient for ~200 entries. If search quality is poor, upgrade to tsvector later. **Folios are filter-only in MVP and are not included in text search ranking.**

### 6.7 Studio Pages (`/studio/*`)

- `/studio` shows a simple navigation list linking to subpages.
- Each subpage renders its rich text content from the database.
- Layout: centered text column, `max-width: 700px`. Clean typography.
- Hero image at top if set.
- Mobile: full-width with padding.
- Small back/breadcrumb navigation.

### 6.8 Intro Animation

- **Split-flap display** showing "NO COOKIES EVER" — placeholder implementation for MVP.
- Plays ONCE per session. Tracked via `sessionStorage` key `alm-intro-played` (NOT cookies, NOT localStorage).
- Duration: ~2.5 seconds. Skippable by tap/click.
- Can be disabled in admin via `site-settings.introAnimation`.
- Implementation: full-screen overlay, centered text, fade in then fade out. CSS animation only for MVP.

### 6.9 Header

- **Left:** "a l m" logo/wordmark. Tap = shuffle to random entry (if shuffle ON) or go to latest (if shuffle OFF).
- **Right:** Search icon (🔍). Tap = navigate to `/search`.
- Minimal. Fixed/sticky at top. White background.

### 6.10 Bottom Navigation (Mobile)

- Fixed at bottom of screen.
- Contains: IMG/TXT toggle (center), nav links as side labels.
- Side labels (vertically oriented text, as in the mockups): STUDIO, SHOP, INSTAGRAM.
- STUDIO → `/studio`. SHOP → external Printify URL. INSTAGRAM → external Instagram URL.

### 6.11 Loading States

- **Entry navigation:** crossfade (~300ms). If data not loaded, show shimmer/skeleton. No spinner.
- **Images:** lazy loading with light grey background placeholder. (Blur-up/blur hash deferred to post-MVP.)
- **Search results:** skeleton card grid while loading.
- **Studio pages:** skeleton text blocks.

### 6.12 Animation Philosophy

- Minimal, purposeful. No gratuitous motion.
- Entry transitions: crossfade, ~300ms.
- IMG/TXT toggle: crossfade, ~200ms.
- Desktop focus changes: opacity transition, ~200ms.
- Scroll snapping: native CSS, no JS scroll hijacking.
- `prefers-reduced-motion`: respect it. Disable ALL transitions and animations.
- No parallax. No bouncing. No scroll-triggered animations.

### 6.13 Accessibility

- Semantic HTML: `<main>`, `<nav>`, `<article>` per entry, `<figure>` + `<figcaption>` for images.
- All images require `alt` text (from Media collection's `alt` field).
- Keyboard: arrow keys for prev/next entry, Tab through interactive elements.
- Focus management: when navigating to new entry, move focus to entry title.
- Skip-to-content link.
- ARIA labels on: IMG/TXT toggle, carousel controls, search input, navigation.
- Color contrast: verify orange on white meets WCAG AA. If it fails, darken orange to `#D14A18`.

---

## 7. Repo Structure

```
alm/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (frontend)/               # Public route group
│   │   │   ├── page.tsx              # Landing / homepage
│   │   │   ├── entry/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx      # Direct entry link (same navigator, different start)
│   │   │   ├── search/
│   │   │   │   └── page.tsx          # Search + folio filter
│   │   │   ├── studio/
│   │   │   │   ├── page.tsx          # Studio overview
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx      # Studio subpage
│   │   │   └── layout.tsx            # Public layout (header, bottom nav)
│   │   ├── (payload)/                # Payload admin (auto-generated)
│   │   │   └── admin/
│   │   │       └── [[...segments]]/
│   │   │           └── page.tsx
│   │   ├── api/                      # API routes
│   │   │   ├── entries/
│   │   │   │   └── index/route.ts    # GET lightweight entry index
│   │   │   └── search/route.ts       # GET search results
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css               # Tailwind + brand tokens
│   ├── payload/
│   │   ├── payload.config.ts         # Main Payload config
│   │   ├── collections/
│   │   │   ├── Entries.ts
│   │   │   ├── Folios.ts
│   │   │   ├── Media.ts
│   │   │   ├── StudioPages.ts
│   │   │   └── Users.ts
│   │   ├── globals/
│   │   │   └── SiteSettings.ts
│   │   └── hooks/
│   │       ├── autoEntryNumber.ts
│   │       ├── autoSlug.ts
│   │       ├── extractPlainDescription.ts
│   │       └── handleGifUpload.ts
│   ├── components/
│   │   ├── EntryCard.tsx
│   │   ├── ImageGallery.tsx
│   │   ├── ImgTxtToggle.tsx
│   │   ├── DesktopScrollLayout.tsx
│   │   ├── MobileEntryView.tsx
│   │   ├── EntryNavigator.tsx        # Shared navigator used by / and /entry/[slug]
│   │   ├── SearchBar.tsx
│   │   ├── FolioChips.tsx
│   │   ├── IntroAnimation.tsx
│   │   ├── Header.tsx
│   │   ├── BottomNav.tsx
│   │   └── RichTextRenderer.tsx
│   └── lib/
│       ├── queries.ts
│       ├── types.ts
│       └── constants.ts              # Brand colors, breakpoints
├── media/                            # Uploaded files (Docker volume mount)
├── scripts/
│   ├── seed.ts
│   └── migrate-wp.ts
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── tailwind.config.ts
├── tsconfig.json
├── next.config.ts
└── package.json
```

---

## 8. Hard Constraints

These are non-negotiable. Do not deviate.

1. Public-facing routes (`/`, `/entry/*`, `/search`, `/studio/*`) must not set any application or tracking cookies.
2. **NEVER** use `document.cookie` in the public frontend code.
3. Do NOT import Google Fonts or any external font CDN.
4. Use `sessionStorage` (not `localStorage`) for the intro animation flag.
5. Use Payload's native `versions: { drafts: true }` on Entries — do NOT use a manual `status` select field.
6. Pin the exact Payload version from `create-payload-app` — do not upgrade Next.js or React independently.
7. All image uploads must preserve GIF animation. Test this on day 1.
8. The `/entry/[slug]` route renders the same navigator as `/`, not a separate page.
9. Payload admin authentication may use secure HTTP-only auth cookies if required by Payload's built-in auth. Do not build a custom auth system.
10. Cloudflare features that introduce unnecessary visitor cookies should remain disabled.

### Privacy / cookies summary

- No analytics, pixels, consent banners, or third-party scripts that introduce tracking cookies.
- The public site is cookieless in normal browsing.
- If any cookies are present, they must be strictly infrastructure/auth related (Payload admin, Cloudflare security) and documented.

---

## 9. Implementation Milestones

### M1: Foundation (Days 1–2)

**Goal:** Payload CMS running with all collections, admin functional, GIF handling verified.

**Tasks:**
1. Run `npx create-payload-app@latest` — select Next.js + PostgreSQL.
2. Define all collections: Entries (with `versions: { drafts: true }`), Folios, Media, StudioPages, Users.
3. Define global: SiteSettings.
4. Implement hooks:
   - `autoEntryNumber`: beforeValidate — if new entry, set entryNumber = max + 1
   - `autoSlug`: beforeValidate — generate slug from title if not set
   - `extractPlainDescription`: afterChange — recursive walk of Lexical JSON AST, extract `.text` from text nodes, concatenate, store in `plainDescription`
5. Configure Lexical rich text: bold, italic, link, paragraph ONLY. No headings, embeds, tables, or images.
6. **Test GIF upload:** Upload an animated GIF to Media collection. Check if generated sizes preserve animation. If not (likely), implement workaround and document it.
7. Create `scripts/seed.ts`: admin user, 5 test entries (2 multi-image, 1 single-image, 1 text-only, 1 with animated GIF), 2 folios, studio pages with real content.
8. Docker Compose: postgres service for local dev.
9. Verify: `npm run dev`, admin at localhost:3000/admin, CRUD everything.

**Acceptance criteria:**
- [ ] Admin panel loads at /admin
- [ ] Can create entry with images, assign folio, publish via Payload's draft/publish
- [ ] Can create text-only entry (no images)
- [ ] Animated GIF displays correctly after upload (not static)
- [ ] Entry numbers auto-increment
- [ ] Slugs auto-generate from title
- [ ] plainDescription auto-populates from rich text
- [ ] Site settings (shuffle mode) toggleable
- [ ] Studio pages seeded with real content
- [ ] Draft/publish workflow works via Payload's native versions

---

### M2: Desktop Scroll-Snap Prototype (Days 3–5)

**Goal:** The hardest UI component proven in isolation before building anything else.

**Tasks:**
1. Create `src/components/DesktopScrollLayout.tsx` as isolated component.
2. Use hardcoded mock data (5 entries matching seed data structure).
3. Layout: left panel 60% width, `position: sticky; top: 0; height: 100vh`. Right panel 40%, scrollable.
4. Right panel: `scroll-snap-type: y proximity` (**not** mandatory). Each entry block: `scroll-snap-align: start`.
5. Entry blocks: fixed height (~100vh). If description overflows, `overflow-y: auto` within the block — do NOT let blocks grow taller.
6. Focus detection: `scrollend` event (or IntersectionObserver fallback for Safari).
7. In-focus: entry number orange `#E8531E`, full opacity. Others: `opacity: 0.4`, transition 200ms.
8. Left panel: crossfade to in-focus entry's first image (300ms CSS opacity transition).
9. Text-only entries: left panel shows blank/light grey.
10. Multi-image entries: carousel dots in left panel, left/right arrow keys to cycle.

**Acceptance criteria:**
- [ ] Scroll snaps to entry blocks on right panel
- [ ] Left image updates when focus changes
- [ ] Crossfade transition is smooth
- [ ] Long descriptions scrollable within their fixed-height block
- [ ] Text-only entry shows blank left panel
- [ ] Works in Chrome AND Safari
- [ ] No scroll hijacking — native scroll feel

---

### M3: Mobile Entry View + Wiring (Days 6–9)

**Goal:** Full mobile experience working with real Payload data.

**Tasks:**
1. Responsive breakpoint: `<768px` = mobile layout, `≥768px` = desktop layout.
2. Create `EntryNavigator.tsx` — shared component used by both `/` and `/entry/[slug]`. Accepts `initialEntrySlug` prop (optional).
3. `MobileEntryView`: full-screen, one entry at a time. IMG and TXT views.
4. `ImageGallery`: horizontal swipe for images (`@use-gesture/react` with **axis lock**). Carousel dots. `object-fit: contain`.
5. `ImgTxtToggle`: orange pill at bottom center. Toggles IMG/TXT. State persists across entries. Greyed out for no-image entries.
6. Entry navigation: vertical swipe = next/prev entry. Tap top half = prev, tap bottom half = next. Axis lock prevents swipe conflicts.
7. Wire to Payload data: API route `GET /api/entries/index` returning lightweight entry list `[{ id, slug, entryNumber, title, firstImageThumbnailUrl, hasImages, sortOrder }]`.
8. Full entry data fetched on demand per entry.
9. URL management: `history.replaceState` to `/entry/[slug]` on navigation.
10. `/entry/[slug]/page.tsx`: server component fetches entry + entry index, renders `EntryNavigator` with `initialEntrySlug`.
11. Wire `DesktopScrollLayout` to real Payload data (same data flow as mobile).
12. `Header`: "a l m" logo left (shuffle/latest behavior), search icon right.
13. `BottomNav`: toggle center, STUDIO/SHOP/INSTAGRAM side labels.
14. Apply brand colors and typography.

**Acceptance criteria:**
- [ ] Mobile: swipe left/right changes images within entry
- [ ] Mobile: swipe up/down changes entries
- [ ] No swipe conflicts (axis lock works)
- [ ] IMG/TXT toggle switches views with crossfade
- [ ] Toggle greyed out for text-only entries
- [ ] URL updates to `/entry/[slug]` on navigation
- [ ] `/entry/[slug]` works as direct link (server-renders, then hydrates with full navigation)
- [ ] Desktop layout works with real data (same as M2 but wired)
- [ ] Header and bottom nav functional
- [ ] Navigation wraps (oldest → newest and back)

---

### M4: Search + Studio (Days 10–12)

**Goal:** Search and studio pages complete.

**Tasks:**
1. Search API route: accepts query string + optional folio IDs. Uses Payload's `where` queries with `like` operator on `title`, `plainDescription`, `year`, `place`. Filters by folio relationship. Returns entry cards.
2. Search page: `SearchBar` (debounced 300ms) + `FolioChips` (horizontal scroll, toggle, OR logic) + results grid of `EntryCard` components.
3. `EntryCard`: thumbnail (or grey placeholder if no image), entry number, title. Links to `/entry/[slug]`.
4. Empty state: "No entries found."
5. Initial state (no query, no filters): all published entries as grid, ordered by sortOrder.
6. Studio overview page: list of subpage links from StudioPages collection.
7. Studio subpages: render rich text from DB. Centered column `max-w-[700px]`. Hero image if set.

**Acceptance criteria:**
- [ ] Search returns relevant results for keywords
- [ ] Folio chips filter correctly (OR logic)
- [ ] Search + folio filters combine correctly
- [ ] Results update as user types
- [ ] Studio pages render rich text correctly
- [ ] Studio navigation works (overview → subpage → back)

---

### M5: Polish (Days 13–15)

**Goal:** Production-ready quality.

**Tasks:**
1. SEO: dynamic `<title>`, `<meta description>` (from `plainDescription`), OG tags per page. Entry OG image = first image medium size.
2. `IntroAnimation`: full-screen overlay, "NO COOKIES EVER" centered, fade in → fade out after 2.5s. Skippable on tap. `sessionStorage` key `alm-intro-played`. Check `site-settings.introAnimation`.
3. Loading states: skeleton shimmer for entries and search results. Image lazy loading with grey background.
4. Error pages: custom 404 and 500.
5. Accessibility: skip-to-content, ARIA labels on toggle/carousel/search, keyboard arrow navigation, focus management on entry change. Contrast check on orange.
6. `prefers-reduced-motion`: disable all transitions/animations.
7. Lighthouse audit: target >90 all categories.

**Acceptance criteria:**
- [ ] OG tags render correctly (test with opengraph.xyz or similar)
- [ ] Intro plays once per session, does not replay on navigation or reload within session
- [ ] No layout shift on load
- [ ] Keyboard navigation works throughout
- [ ] Lighthouse >90 where practical, no launch-blocking regressions
- [ ] Zero cookies visible on public pages in browser devtools (admin cookies acceptable)

---

### M6: Deployment + Migration (Days 16–20)

**Goal:** Live on staging, WordPress data migrated.

**Tasks:**
1. `Dockerfile`: multi-stage build for Next.js + Payload.
2. `docker-compose.yml`: next-payload + postgres + volumes for media and DB data.
3. Deploy to Hetzner VPS via Coolify.
4. Cloudflare: DNS, SSL, cache rules (cache `/media/*` and static assets aggressively).
5. WordPress migration script (`scripts/migrate-wp.ts`):
   - Read WP XML export or CSV (user provides the export)
   - For each post: extract title, date → year, HTML content
   - **Content conversion strategy:** Convert HTML to plaintext (strip tags). Store in `plainDescription`. For `description` rich text, store as a single Lexical paragraph with the plaintext. Alm can re-format entries manually in admin over time. This is safer than fragile HTML-to-Lexical conversion. **Preserving content completeness is more important than preserving original rich formatting.**
   - Download images from WP uploads, upload via Payload Local API
   - Assign entry numbers sequentially by date (oldest = 1)
   - Publish all migrated entries
6. Run migration on staging.
7. QA with Alm: review migrated entries.
8. Backup cron: daily `pg_dump` + media rsync to Hetzner Storage Box.

**Acceptance criteria:**
- [ ] Site accessible at staging URL with SSL
- [ ] All ~130 entries migrated with images
- [ ] Admin functional on staging
- [ ] Backups running and verified (test a restore)
- [ ] Cloudflare caching confirmed (check response headers)

---

## 10. Migration Details

### What We're Migrating
- ~130 almanac entries (WP posts)
- ~11 "work" projects from homepage (become regular entries)
- All associated images (served as-is, NOT reprocessed through Sharp)
- Studio page content (Andrea, Practice, Point of Departure)

### What We're NOT Migrating
- Media/press page items
- Acronyms
- Footer elements
- WordPress theme/plugin data

### Human Help Required
- Alm must provide WP export (CSV or XML) and media access (zip or server access)
- Alm must QA all migrated entries in admin
- Some entries will need manual rich text re-formatting

---

## 11. Deployment Topology

```
                    ┌──────────────┐
                    │  Cloudflare  │
                    │  (free CDN)  │
                    │  DNS + SSL   │
                    │  + caching   │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │  Hetzner VPS │
                    │  CPX31       │
                    │  ~€16/month  │
                    │              │
                    │  ┌────────┐  │
                    │  │Coolify │  │
                    │  │(PaaS)  │  │
                    │  └───┬────┘  │
                    │      │       │
                    │  ┌───┴────┐  │
                    │  │Docker  │  │
                    │  │Compose │  │
                    │  │        │  │
                    │  │Next.js │  │
                    │  │+Payload│  │
                    │  │:3000   │  │
                    │  │        │  │
                    │  │Postgres│  │
                    │  │:5432   │  │
                    │  └────────┘  │
                    │              │
                    │  /media/     │
                    │  (images)    │
                    └──────────────┘

Backups → Hetzner Storage Box (~€3.50/month)
Total monthly cost: ~€20
```

---

## 12. Backup Strategy

- **Database:** Daily `pg_dump` via cron, compressed, stored on VPS + synced to Hetzner Storage Box. Retain 30 days.
- **Media:** Daily rsync of `/media/` to Storage Box.
- **Code:** Git repository. All Payload config is in code — fully reproducible.
- **Disaster recovery:** New VPS + Docker Compose + pg_restore + media restore = full rebuild in <1 hour.

---

## 13. Scope Deferrals (post-MVP)

These are explicitly NOT in scope for MVP. Do not build them.

- Real split-flap animation (CSS placeholder is sufficient)
- Image blur-up / blur hash placeholders (grey background is fine)
- Entry prefetching ±2 (nice optimization, not needed for launch)
- Sitemap generation (add in week after launch)
- Print stylesheet
- RSS feed
- Content versioning UI (Payload's built-in versions handle this)
- Plausible analytics
- Image focal point selection in admin
- Bulk entry import tool

---

## 14. Definition of Done (MVP)

- [ ] Admin: Alm can log in, create/edit/delete/reorder entries with images and GIFs
- [ ] Admin: Draft/publish workflow works via Payload's native versions
- [ ] Admin: Alm can manage folios, assign entries to folios
- [ ] Admin: Alm can edit studio page content
- [ ] Admin: Alm can toggle shuffle mode and intro animation
- [ ] Admin: Additional admin users can be created
- [ ] Mobile: Visitors see latest/random entry on landing
- [ ] Mobile: Visitors can navigate entries via swipe and tap zones
- [ ] Mobile: IMG/TXT toggle works, persists state, greyed out for no-image entries
- [ ] Mobile: Image carousel with swipe and dots
- [ ] Desktop: Scroll-linked gallery with snap, focus styling, image sync
- [ ] Search: keyword search works
- [ ] Search: folio filter chips work
- [ ] Studio: all subpages render correctly
- [ ] Shop/Instagram: external links work
- [ ] SEO: meta tags, OG images on all pages
- [ ] Intro: "NO COOKIES EVER" placeholder plays once per session
- [ ] Accessibility: keyboard nav, alt text, ARIA, contrast
- [ ] Performance: strong Lighthouse baseline, targeting >90 where practical without blocking launch
- [ ] Deployed on Hetzner via Coolify with Cloudflare CDN
- [ ] WordPress entries migrated
- [ ] Backups running
- [ ] Public site is cookieless in normal browsing
- [ ] No tracking cookies or analytics cookies are present
- [ ] Any auth/infrastructure cookies are documented and limited to admin or required edge/security behavior
- [ ] `/entry/[slug]` works as shareable direct link
