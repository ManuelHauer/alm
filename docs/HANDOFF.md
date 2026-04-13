# ALM PROJECT — Implementation Handoff

> **Single source of truth.** Combines product spec, architecture, content model,
> UX behavior, and execution milestones.
>
> **For AI agents:** Read this entire file before writing any code.
> Then read `docs/M3_STATUS.md` for the current UI component inventory.
>
> Last updated: 2026-04-13 | M1 ✅ M2 ✅ M3 ✅ M4 ✅ M5 ✅ M6 ⬜

---

## 1. Product Overview

**alm** is a portfolio/almanac website for a l m project, a multidisciplinary design
studio led by Andrea Lenardin Madden (architecture, interiors, identity, packaging).
The site is centered around an ever-growing list of **entries** — a chronological
archive of projects, events, and studio life spanning 2004 to present (~130 entries,
growing monthly).

The site replaces an existing WordPress site at almproject.com.

**Primary user:** Alm (Andrea / studio team) — non-technical, needs to manage all
content without developer help.

**Visitors:** Design professionals, clients, press, collaborators worldwide.

---

## 2. Exact Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | pinned to create-payload-app version |
| CMS | Payload CMS (embedded in Next.js) | 3.x |
| Database | PostgreSQL | 16 |
| DB Adapter | @payloadcms/db-postgres | latest |
| Rich Text | Lexical (@payloadcms/richtext-lexical) | latest |
| Image Processing | Sharp (via Payload) | 0.34.2+ |
| Language | TypeScript | 5.x |
| Deployment | Docker Compose on Hetzner VPS | — |
| PaaS | Coolify (self-hosted) | latest |
| CDN | Cloudflare (free tier, DNS + caching) | — |
| Analytics | None. Optional: Plausible (self-hosted, cookieless) | — |

**Critical version constraint:** Pin the exact Payload version from `create-payload-app`.
Do NOT independently upgrade Next.js or React. Payload 3 + React 19 has known interop
edge cases — stay on the tested combination.

---

## 3. Brand Identity

### Colors

| Name | Hex | Usage |
|---|---|---|
| Primary orange | `#e85c23` | Entry numbers (focused), toggle pill, active dots, active entry numbers |
| Black | `#1A1A1A` | Body text |
| Background | `#fafaf8` | Page and column backgrounds |
| Secondary text | `#888` | Titles, captions in image column |
| Separator | `0.5px solid #808080` | Rail border, entry dividers |

CSS variables (declared in `src/app/(frontend)/styles.css`):
```css
:root {
  --alm-orange: #e85c23;
  --rail-width: 4.3125rem;   /* 69px */
  --separator: 0.5px solid #808080;
  --font-sans: 'Vialog LT', 'Helvetica Neue', Helvetica, Arial, sans-serif;
}
```

### Typography

- **Font:** Vialog LT Regular (custom web font, woff2 + woff)
- Files: `public/fonts/Vialog-LT-Regular.woff2` and `.woff`
- `@font-face` in `src/app/(frontend)/styles.css`
- Do NOT import Google Fonts or any external font CDN (privacy)

### Design Direction

Editorial, minimal, clean. Think gallery/museum website. Generous whitespace.
Content-first. Orange used sparingly: entry numbers in focus, toggle button, active states.

### Assets

- `public/alm_logo.svg` — grey rectangle with transparent letter cutouts. Display on
  white background so cutouts appear white ("white text on grey"). Do NOT recolor.
- `public/search.svg` — search icon, `fill="#808080"`. Loaded via `<img>` tag so
  `currentColor` CSS inheritance does not apply; color is baked into the SVG.

---

## 4. Page Tree / Route Map

```
/                          → Landing (latest or random entry)
/entry/[slug]              → Direct link to a specific entry (shareable URL)
/search                    → Search + folio filtering
/studio                    → Studio overview
/studio/andrea             → Andrea Lenardin Madden bio
/studio/practice           → Practice description + contact info
/studio/point-of-departure → Point of Departure essay
/studio/books              → Books (content TBD)
/studio/contact            → Contact information
/admin                     → Payload admin panel (auth-protected)
```

**Discarded from old site:** Media page, Acronyms page, footer icon badges,
"NOT TESTED ON ANIMALS" tagline, separate "work" page.

### /entry/[slug] behavior

This route renders the **same EntryNavigator component** used on `/`, initialized at
the specified entry. It is NOT a separate detail page. When a user shares
`/entry/some-project`, the recipient lands on that entry but can navigate normally.

Implementation: the `/entry/[slug]/page.tsx` server component fetches the entry +
full entry index, then renders `EntryNavigator` with `initialSlug` prop.

---

## 5. Content Model (Payload Collections)

### 5.1 Entries (core collection)

```typescript
// src/payload/collections/Entries.ts
export const Entries: CollectionConfig = {
  slug: 'entries',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['entryNumber', 'title', '_status', 'sortOrder'],
  },
  versions: { drafts: true },  // USE PAYLOAD'S NATIVE DRAFT/PUBLISH
  fields: [
    { name: 'entryNumber', type: 'number', required: true, unique: true },
    { name: 'title',       type: 'text',   required: true },
    { name: 'slug',        type: 'text',   required: true, unique: true },
    { name: 'year',        type: 'text' },   // e.g. "2012-2015"
    { name: 'place',       type: 'text' },   // e.g. "Los Angeles"
    { name: 'description', type: 'richText' }, // Lexical: bold/italic/link/paragraph only
    { name: 'plainDescription', type: 'textarea', admin: { readOnly: true } }, // auto-extracted
    {
      name: 'images', type: 'array',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text' },
      ],
    },
    { name: 'folios', type: 'relationship', relationTo: 'folios', hasMany: true },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    { name: 'customFields', type: 'json' },
  ],
  hooks: {
    beforeValidate: [ autoEntryNumber, autoSlug ],
    afterChange:    [ extractPlainDescription ],
  },
}
```

### 5.2 Folios

Curated collections (NOT tags). Entry can belong to zero or many. Appear as filter chips on search page.

```typescript
export const Folios: CollectionConfig = {
  slug: 'folios',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name',  type: 'text', required: true, unique: true },
    { name: 'slug',  type: 'text', required: true, unique: true },
    { name: 'description', type: 'textarea' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
  ],
}
```

### 5.3 Media

Payload built-in upload collection.

```typescript
export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: '../media',
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    imageSizes: [
      { name: 'thumbnail', width: 400,  height: undefined, position: 'centre' },
      { name: 'medium',    width: 1200, height: undefined, position: 'centre' },
      { name: 'large',     width: 2400, height: undefined, position: 'centre' },
    ],
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
  ],
}
```

**GIF handling (M1 verified):** Sharp 0.34.2 preserves animation frames through all
resize variants. No workaround needed. A `handleGifUpload` hook tags `isAnimatedGif: true`
as a future tripwire in case Sharp regresses.

### 5.4 Studio Pages

```typescript
export const StudioPages: CollectionConfig = {
  slug: 'studio-pages',
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'pageSlug', type: 'text', required: true, unique: true },
    { name: 'title',    type: 'text', required: true },
    { name: 'content',  type: 'richText' },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
  ],
}
```

Pre-seeded: `andrea`, `practice`, `point-of-departure`, `books`, `contact`

### 5.5 Site Settings (Global)

```typescript
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  fields: [
    { name: 'shuffleMode',     type: 'checkbox', defaultValue: true },
    { name: 'introAnimation',  type: 'checkbox', defaultValue: true },
    { name: 'instagramUrl',    type: 'text', defaultValue: 'https://instagram.com/almproject' },
    { name: 'shopUrl',         type: 'text', defaultValue: '' },
  ],
}
```

### 5.6 Users

Payload built-in `auth: true` collection with `name` field.

---

## 6. UX Behavior Spec

### 6.1 Homepage / Landing

- Check `site-settings.shuffleMode`: ON → random published entry; OFF → highest sortOrder (latest).
- Render in IMG mode by default.
- URL stays `/`. Navigation updates to `/entry/[slug]` via `history.replaceState`.

### 6.2 Entry Model

Every entry has exactly two content views:
- **IMG:** Image carousel. Entry number (orange), title, dots.
- **TXT:** Text content. Entry number, title, year, place, description.

No separate detail page.

### 6.3 Mobile Layout

**Structure:** Fixed left vertical nav rail + main content area + floating IMG/TXT toggle pill.

```
[NavRail 69px fixed] | [mobileMain flex:1]         [floating pill fixed bottom-right]
                                                    [search icon fixed top-right]
```

**MobileNavRail** (`src/components/MobileNavRail/`):
- Width: `--rail-width` = 69px, `border-right: var(--separator)`
- Top: alm logo SVG (`public/alm_logo.svg`), `padding: 0`, white background
- Bottom: STUDIO / SHOP / INSTAGRAM links, `writing-mode: vertical-rl; transform: rotate(180deg)`, 9px
- Right border: `var(--separator)` = `0.5px solid #808080`

**IMG mode** (`MobileEntryView`):
- Flex-column: top tap zone (flex:1) → image block → bottom tap zone (flex:1)
- Top/bottom tap zones → prev/next entry. Image block tap → switch to TXT.
- Image: intrinsic aspect-ratio height (from `image.width / image.height`), max 62vh, `padding: 0 12px`
- Entry number top-left (orange), title bottom-left, dots bottom-right (orange active dot)
- Carousel: 3-slot (`@use-gesture/react`), 220ms CSS / 250ms JS reset

**TXT mode** (`MobileTxtView`):
- All entries × 3 copies for seamless infinite loop
- On mount: instant scroll to active entry at 30% focus line (middle copy, copy-1)
- Scroll listener teleports ±middleSetHeight at boundaries; `requestAnimationFrame` guard skips
  active-entry detection on teleport tick to prevent flicker
- Active entry: opacity 1 on content/number; others: 0.38 opacity. Border always at full weight
  (opacity applied to `.entryContent` and `.entryNumber`, NOT `.entry` — border stays solid)
- Layout: `padding: 9px 11px 11px 69px`. Entry number: absolute, `top: 6px; width: 43px`
- Typography: title + meta right-aligned; description `text-align: justify; text-align-last: right`
- Tapping entry → `onSelectEntry` → switch to IMG mode for that entry

**IMG/TXT toggle pill** (in `EntryNavigator`):
- Fixed bottom-right, `background: var(--alm-orange, #e85c23)`
- White indicator slides left (IMG) / right (TXT)
- Active side: `color: #111` via `.pillImg .pillOption:nth-child(1)` / `.pillTxt .pillOption:nth-child(2)`
  (**use `:nth-child()`, NOT `:last-child`** — pillIndicator is the 3rd child, breaks `:last-child`)
- Disabled (opacity 0.35) when entry has no images and mode is IMG

**Mobile search icon** (in `EntryNavigator`):
- `position: fixed; top: 0; right: 0`
- Corner gradient: `linear-gradient(to bottom left, rgba(250,250,248,0.95) 0%, transparent 100%)`
- Links to `/search`

**Gestures:**
- Horizontal swipe → image carousel (axis lock at 10px, `filterTaps: true`)
- Vertical swipe → entry navigation (instant, no animation)

### 6.4 Desktop Layout — Three-Column

`EntryNavigator` detects `≥768px` and renders `DesktopScrollLayout` directly (self-contained).

```
[NavRail 69px] | [imageCol resizable ~66%] [divider 1px] [textCol flex:1]
```

**Root:** `display: flex; height: 100dvh; overflow: hidden` — no page scroll.

**MobileNavRail** (desktop variant, prop `desktop={true}`):
- Same 69px rail, but links centered vertically (`flex: 1; justify-content: center`)
- Link font size: 14px (vs 9px on mobile)

**Image column** (`imageCol`):
- `position: relative; height: 100dvh; overflow: hidden`
- Default ~66% of `(viewport - rail)`, user-resizable via drag divider (0.30–0.85)
- `IMG_COL_PADDING = 20px` each side — subtracted from available width in `imageSize` computation
  so carousel never touches column edges
- `imageSize` computed via `ResizeObserver` on `imageColRef`:
  ```
  availW = colW - 40
  maxH = colH * 0.78   (leaves room for labels above/below)
  aspect = img.width / img.height
  height-constrained if availW/maxH > aspect, else width-constrained
  returns { stackWidth, innerHeight }
  ```
- **imageStack** (flex-column, width = `stackWidth`): centers number + carousel + footer
  as a group, aligned with image edges:
  - `entryNumber`: above image, orange `var(--alm-orange)`, 12px, tabular-nums
  - `imageInner`: the carousel only (`carouselClip` + slots + dots overlay removed)
  - `imageFooter` (flex row): `imageTitle` (left, 12px) + `dots` (right, flex-shrink: 0)
- Dots moved OUTSIDE the carousel — in `imageFooter` row, not inside `carouselClip`
- Search icon: `position: absolute; top: 0; right: 0`, 44×44px, no gradient, `public/search.svg`
- Pointer drag + horizontal wheel for carousel navigation
- **Keyboard:** `↑`/`↓` = prev/next entry; `←`/`→` = carousel prev/next
  (implemented via `window.addEventListener('keydown', ...)` with `focusedIdRef` for closure safety)

**Drag divider:**
- `flex: 0 0 3px` (hit area); visual line is `border-left: 0.5px solid #808080`
- Hover/active: `border-left: 1px solid #525252`
- Pointer events update `splitFraction` state (clamped 0.30–0.85)

**Text column** (`textCol`):
- `flex: 1; overflow: hidden` — contains `MobileTxtView` which manages its own scroll
- Scroll drives `focusedId` via `onActivate`; clicking entry also sets `focusedId`

**No BottomNav. No IMG/TXT pill. Header component not used.**

### 6.5 Entry Navigation Logic

- Ordered by `sortOrder` descending (newest first)
- "Down"/"Next" = lower sortOrder (older). "Up"/"Prev" = higher sortOrder (newer)
- Wraps: after oldest → newest, and vice versa
- Full `EntryDetail[]` SSR'd into bundle at page load (~50–100KB at 130 entries)

### 6.6 Search Page (`/search`)

- Search bar (large, prominent) + folio filter chips (horizontal scroll, OR logic)
- Results debounced 300ms, grid of entry cards (thumbnail, number, title)
- Payload `where` queries with `like` on `title`, `plainDescription`, `year`, `place`
- Empty state: "No entries found." | Initial state: all entries as grid

### 6.7 Studio Pages (`/studio/*`)

Centered text column, `max-width: 700px`. Hero image if set. Rich text from DB.

### 6.8 Intro Animation

- "NO COOKIES EVER" split-flap display
- Plays once per session: `sessionStorage` key `alm-intro-played`
- 2.5s duration, skippable on tap, can disable in admin via `site-settings.introAnimation`

### 6.9 Loading / Animation

- Entry transitions: crossfade ~300ms
- Toggle: crossfade ~200ms
- `prefers-reduced-motion`: disable ALL transitions
- No parallax, no bouncing, no scroll hijacking

### 6.10 Accessibility

- Semantic HTML: `<main>`, `<nav>`, `<aside>`, ARIA labels on toggle/carousel/search
- Keyboard: `↑`/`↓` prev/next entry (desktop), Tab through interactive elements
- All images: `alt` from Media collection's `alt` field
- Color contrast: orange `#e85c23` on white — verify WCAG AA

---

## 7. Repo Structure (actual, post-M5)

```
alm/
├── src/
│   ├── app/
│   │   ├── (frontend)/
│   │   │   ├── page.tsx                    # Landing — generateMetadata + OG image
│   │   │   ├── entry/[slug]/page.tsx       # Direct entry link — generateMetadata + OG image
│   │   │   ├── search/page.tsx             # Search + folio filter
│   │   │   ├── search/SearchView.tsx       # Client component: bar + chips + results grid
│   │   │   ├── studio/page.tsx             # Studio overview
│   │   │   ├── studio/[slug]/page.tsx      # Studio subpage — Lexical rich text
│   │   │   ├── not-found.tsx               # 404 page
│   │   │   ├── error.tsx                   # 500 page ('use client')
│   │   │   ├── styles.css                  # @font-face, CSS vars, :focus-visible, reduced-motion
│   │   │   └── layout.tsx                  # async RSC: metadata template, IntroAnimation, skip link
│   │   ├── (payload)/api/[...slug]/route.ts  # Payload REST API catch-all — DO NOT shadow with custom routes
│   │   ├── api/
│   │   │   ├── entries/index/route.ts      # GET /api/entries/index → lightweight EntryIndexItem[]
│   │   │   ├── entries/by-slug/[slug]/route.ts  # GET /api/entries/by-slug/:slug → EntryDetail
│   │   │   ├── search/route.ts             # GET /api/search?q=&folios=
│   │   │   └── folios/route.ts             # GET /api/folios
│   │   ├── robots.ts                       # /robots.txt
│   │   └── sitemap.ts                      # /sitemap.xml (all entry slugs)
│   ├── components/
│   │   ├── EntryNavigator/                 # Mobile/desktop split, owns mode state
│   │   │   ├── EntryNavigator.tsx          # isMobile detect, floating pill, search icon
│   │   │   └── EntryNavigator.module.css   # mobile layout; :focus-visible on toggle
│   │   ├── DesktopScrollLayout/            # Self-contained 3-col desktop layout
│   │   │   ├── DesktopScrollLayout.tsx     # NavRail + imageCol + divider + textCol
│   │   │   └── DesktopScrollLayout.module.css
│   │   ├── MobileNavRail/                  # Left vertical rail (mobile + desktop)
│   │   │   ├── MobileNavRail.tsx
│   │   │   └── MobileNavRail.module.css    # :focus-visible on links
│   │   ├── MobileEntryView/                # IMG mode: single entry, tap zones, carousel
│   │   │   ├── MobileEntryView.tsx
│   │   │   └── MobileEntryView.module.css
│   │   ├── MobileTxtView/                  # TXT mode: infinite loop stream
│   │   │   ├── MobileTxtView.tsx           # forwardRef, scrollToEntry, isProgrammaticScrollRef
│   │   │   └── MobileTxtView.module.css
│   │   ├── ImageGallery/                   # Shared carousel (MobileEntryView + DesktopScrollLayout)
│   │   │   ├── ImageGallery.tsx            # useReducedMotion + loading="lazy" on adjacent slots
│   │   │   └── ImageGallery.module.css
│   │   ├── IntroAnimation/                 # "NO COOKIES EVER" split-flap overlay
│   │   │   ├── IntroAnimation.tsx          # sessionStorage guard, reduced-motion aware
│   │   │   └── IntroAnimation.module.css
│   │   ├── EntryCard/                      # Search result card
│   │   │   ├── EntryCard.tsx               # loading="lazy" on thumbnail
│   │   │   └── EntryCard.module.css
│   │   └── RichText/                       # Lexical → HTML server component
│   │       └── RichText.tsx
│   ├── hooks/
│   │   └── useReducedMotion.ts             # window.matchMedia('prefers-reduced-motion')
│   ├── lib/
│   │   └── getEntries.ts                   # getAllEntries(): draft:false + _status:published
│   ├── payload/
│   │   ├── payload.config.ts
│   │   ├── collections/Entries.ts          # versions: { drafts: true }, access: _status published
│   │   ├── collections/Folios.ts
│   │   ├── collections/Media.ts
│   │   ├── collections/StudioPages.ts
│   │   ├── collections/Users.ts
│   │   ├── globals/SiteSettings.ts         # shuffleMode, introAnimation, instagramUrl, shopUrl
│   │   └── hooks/
│   │       ├── autoEntryNumber.ts
│   │       ├── autoSlug.ts
│   │       ├── extractPlainDescription.ts  # beforeChange: walks Lexical tree → plainDescription
│   │       └── handleGifUpload.ts
│   └── types/
│       └── entry.ts                        # EntryDetail, EntryIndexItem, EntryImageItem
├── public/
│   ├── alm_logo.svg
│   ├── search.svg
│   └── fonts/
│       ├── Vialog-LT-Regular.woff2
│       └── Vialog-LT-Regular.woff
├── docs/
│   ├── HANDOFF.md                          # ← THIS FILE
│   ├── M1_VERIFICATION.md
│   ├── M2_VERIFICATION.md
│   ├── M3_STATUS.md
│   ├── M4_VERIFICATION.md
│   ├── M5_VERIFICATION.md
│   └── DEPLOYMENT_NOTES.md
├── scripts/
│   ├── seed.ts                             # Idempotent seed (admin, 5 entries, 2 folios)
│   ├── update-studio.ts                    # One-off: update studio page text in DB
│   └── migrate-wp.ts                       # M6: WordPress import (not yet implemented)
├── next.config.ts                          # allowedDevOrigins: ['192.168.0.89'] for LAN dev
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## 8. Hard Constraints

1. Public routes must not set application or tracking cookies.
2. **NEVER** use `document.cookie` in frontend code.
3. Do NOT import Google Fonts or any external font CDN.
4. Use `sessionStorage` (not `localStorage`) for intro animation flag.
5. Use Payload's native `versions: { drafts: true }` — no manual status field.
6. Pin Payload version from `create-payload-app` — do not upgrade Next/React independently.
7. All image uploads must preserve GIF animation. ✅ Verified in M1.
8. `/entry/[slug]` renders the same navigator as `/`, not a separate page.
9. Payload admin auth cookies acceptable; no custom auth system.
10. Disable Cloudflare features that introduce visitor cookies.
11. **NEVER** add custom routes at `api/entries/[dynamic]` — shadows Payload's REST API.
    Use `api/entries/by-slug/[slug]` for slug-based lookups.
12. `NEXT_PUBLIC_SERVER_URL` must be set to the production domain for OG image URLs.
    Default in `.env`: `http://localhost:3000`.

---

## 9. Implementation Milestones

### M1: Foundation — ✅ COMPLETE

**Status:** All acceptance criteria met. Tag: `m1-complete` (commit `d951a67`).

Collections, hooks, globals, seed script, GIF preservation verified.
See `docs/M1_VERIFICATION.md` for full audit trail.

**Key findings:**
- Sharp 0.34.2 preserves GIF animation frames through all resize variants. No workaround needed.
- `handleGifUpload` hook tags `isAnimatedGif: true` as a future tripwire.
- Seed creates: 1 admin (`admin@alm.local` / `almadmin1`), 2 folios, 5 entries, 5 studio pages.

---

### M2: Desktop Scroll Prototype — ✅ COMPLETE

**Status:** Accepted with known follow-ups (now superseded by M3 desktop). Tag: `m2-complete`.

The original scroll-snap spec was revised: continuous scroll + 30% focus line replaced
`scroll-snap-type` + 100vh blocks (which broke for short entries and text-only entries).

See `docs/M2_VERIFICATION.md` for full audit trail.

**Note:** The M2 DesktopScrollLayout (2-column scroll prototype) has been fully replaced by
the M3 3-column layout. The `/m2-prototype` route still exists for reference but should be
deleted before production.

---

### M3: Mobile + Desktop UI — ✅ COMPLETE

**Status:** All layouts working on localhost and LAN. Last commit: `4162f89`.

**What was built (diverges significantly from original spec):**

The architecture replaced the Header+BottomNav model with a persistent left NavRail on both
mobile and desktop. No bottom nav. No scroll-snap on desktop.

**Mobile:**
- Left NavRail (69px, fixed) — logo (0 padding), vertical links (9px)
- Floating orange pill (bottom-right) — IMG/TXT toggle
- Floating search icon (top-right) — corner gradient
- IMG mode: flex-column tap zones, intrinsic aspect-ratio images, 3-slot carousel
- TXT mode: 3× infinite loop, teleport scroll, active entry at 30% focus line

**Desktop:**
- Three-column layout: NavRail + image column + 1px divider + text column
- NavRail: same component, `desktop={true}`, links centered at 14px
- Image column: resizable (drag divider), 20px internal padding, `imageStack` pattern for
  label alignment (entry number above, title+dots row below), keyboard navigation
- Text column: MobileTxtView reused — click entry focuses image column
- No BottomNav, no Header, no IMG/TXT pill

**CSS tokens applied:**
- `--rail-width: 4.3125rem` (69px), `--alm-orange: #e85c23`, `--separator: 0.5px solid #808080`
- Vialog LT font loaded via `@font-face`
- Border consistency: opacity on `.entryContent` + `.entryNumber`, not `.entry` (border always full weight)
- Pill fix: `:nth-child(2)` for TXT label (not `:last-child` — broken by 3rd pillIndicator child)

**Dev config:**
- `next.config.ts` has `allowedDevOrigins: ['192.168.0.89']` for iPhone testing over LAN
- Start server: `pnpm dev --hostname 0.0.0.0`

**Known gaps (for M4/M5):**
- `Header` and `BottomNav` components still in repo but not rendered — delete in M4
- Rich text in TXT mode uses `plainDescription` plaintext (Lexical renderer deferred)
- Desktop URL-on-scroll (`history.replaceState`) not wired in text column scroll
- Search page (`/search`) not yet built

---

### M4: Search + Studio — ✅ COMPLETE

**Status:** All tasks complete. Final commit: `ec06287`. See `docs/M4_VERIFICATION.md`.

**What was built:**
- Search page (`/search`): debounced search bar + folio filter chips + results grid
- `GET /api/search?q=&folios=` with published-only filter
- `EntryCard` component with thumbnail + number + title
- Studio overview + subpages with Lexical → HTML rich text (`RichText` server component)
- `history.replaceState` in `MobileTxtView` scroll listener
- Back button on entry pages when arriving from `/search`
- Favicon (`src/app/icon.png`)

**Key fixes in M4:**
- Draft entries now hidden: `draft: false` + `where: { _status: 'published' }` in all entry queries
  (`getEntries.ts`, `/api/entries/index`, `/api/entries/by-slug/[slug]`, `/api/search`)
- Carousel commit animation: `commitDir` CSS `%` offset eliminates overshoot
- Keyboard scroll-to-entry: `isProgrammaticScrollRef` suppresses `onActivate` during smooth scroll
- Divider: `0.5px solid #808080`, 3px hit area, hover → `1px #525252`
- Desktop search button: 44×44px, no gradient overlay on carousel

---

### M5: Polish — ✅ COMPLETE

**Status:** All tasks complete. Final commit: `0afd20c`. See `docs/M5_VERIFICATION.md`.

**What was built:**
- SEO: `generateMetadata` with OG image on all pages; title template `%s — alm`
- `IntroAnimation`: "NO COOKIES EVER" split-flap, grey (#808080) bg, sessionStorage, 2.5s, skippable
- Error pages: `not-found.tsx` (404) + `error.tsx` (500)
- `robots.ts` + `sitemap.ts` (all published entry slugs)
- Accessibility: skip-to-content link, `:focus-visible` global rule (orange ring), nested `<main>` fixed
- `prefers-reduced-motion`: global CSS rule + `useReducedMotion` hook for JS inline transitions
- Lazy loading: `loading="lazy"` on EntryCard thumbnails + off-screen carousel slots
- `NEXT_PUBLIC_SERVER_URL` env var added (set to production domain before deploy)

**Critical routing note:**
`(payload)/api/[...slug]/route.ts` is Payload's REST catch-all. **Never add a custom route
at `api/entries/[dynamic]`** — it will shadow Payload's numeric-ID endpoints and cause 405
on PATCH/PUT/DELETE. Use `api/entries/by-slug/[slug]` for slug-based lookups.

---

### M6: Deployment + WordPress Migration — ⬜ NOT STARTED

**Goal:** Live on staging, all ~130 entries migrated from WordPress.

**Tasks:**
1. `Dockerfile`: multi-stage Next.js + Payload build.
2. `docker-compose.yml`: next-payload + postgres + media volume.
3. Deploy to Hetzner VPS via Coolify.
4. Cloudflare: DNS, SSL, cache `/media/*` aggressively.
5. WordPress migration (`scripts/migrate-wp.ts`):
   - Read WP XML export
   - Convert HTML → plaintext for `plainDescription`; store as single Lexical paragraph in `description`
   - Download images from WP uploads → upload via Payload Local API
   - Entry numbers by date (oldest = 1)
   - Publish all migrated entries
6. QA with Alm. Backup cron: daily `pg_dump` + media rsync to Hetzner Storage Box.

**Note:** WordPress export not yet available. Alm must provide XML export + media access.

---

## 10. How to Run Locally

### One-time setup

```bash
brew install node@22 pnpm postgresql@16
brew link --force --overwrite node@22
brew services start postgresql@16

psql postgres -c "CREATE ROLE alm WITH LOGIN PASSWORD 'alm';"
psql postgres -c "CREATE DATABASE alm OWNER alm;"

git clone https://github.com/ManuelHauer/alm.git ~/Code/alm
cd ~/Code/alm
pnpm install

# .env (not committed)
echo "DATABASE_URL=postgres://alm:alm@localhost:5432/alm" > .env
echo "PAYLOAD_SECRET=$(openssl rand -hex 32)" >> .env
echo "NEXT_PUBLIC_SERVER_URL=http://localhost:3000" >> .env
# For production: set NEXT_PUBLIC_SERVER_URL=https://almproject.com
```

### Daily dev

```bash
pnpm dev                          # localhost:3000
pnpm dev --hostname 0.0.0.0       # + LAN access at 192.168.0.89:3000 (iPhone testing)
pnpm seed                         # wipe + re-seed (admin@alm.local / almadmin1)
pnpm generate:types               # after schema changes
```

### Key URLs

| URL | What |
|---|---|
| `localhost:3000` | Main app |
| `localhost:3000/admin` | Payload admin |
| `localhost:3000/search` | Search page |
| `localhost:3000/studio` | Studio overview |
| `localhost:3000/robots.txt` | robots.txt (auto-generated) |
| `localhost:3000/sitemap.xml` | sitemap (auto-generated) |
| `192.168.0.89:3000` | LAN access (iPhone) |

---

## 11. Deployment Topology

```
Cloudflare (DNS + SSL + cache)
    ↓
Hetzner VPS CPX31 (~€16/mo)
    └── Coolify (PaaS)
          └── Docker Compose
                ├── Next.js + Payload (:3000)
                └── PostgreSQL (:5432)
                /media/ (Docker volume)

Backups → Hetzner Storage Box (~€3.50/mo)
Total: ~€20/mo
```

---

## 12. Backup Strategy

- **DB:** Daily `pg_dump`, compressed, VPS + Storage Box, 30-day retention
- **Media:** Daily rsync of `/media/` to Storage Box
- **Code:** Git — all Payload config in code, fully reproducible
- **Recovery:** New VPS + Docker Compose + `pg_restore` + media restore < 1 hour
