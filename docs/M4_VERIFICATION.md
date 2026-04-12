# M4 Verification Report

**Milestone:** M4 — Search + Studio + Polish
**Status:** ✅ Complete
**Date verified:** 2026-04-12
**Final commit:** `ec06287` on `main`
**Repo:** https://github.com/ManuelHauer/alm

---

## 1. Tasks completed

| Task (from §M4) | Status | Notes |
|---|---|---|
| Delete `Header` + `BottomNav` components | ✅ | Removed from repo |
| Delete `/m2-prototype` route | ✅ | Removed from repo |
| `GET /api/search?q=...&folios=...` | ✅ | Payload `where` with `like` + folio filter |
| Search page: bar + folio chips + results grid | ✅ | `SearchView` client component + SSR page |
| `EntryCard`: thumbnail, number, title | ✅ | Grey placeholder if no image; links to `/entry/[slug]?from=search` |
| Studio overview + subpages (Lexical rich text) | ✅ | `RichText` server component via `convertLexicalToHTML` |
| `history.replaceState` in `MobileTxtView` scroll | ✅ | URL updates silently as scroll changes active entry |
| Real studio text content in DB | ✅ | `scripts/update-studio.ts` ran successfully; Books page deleted |

### Additional fixes delivered in M4

| Fix | Details |
|---|---|
| Desktop search icon not clickable | `setPointerCapture` on imageCol was eating clicks; fix: `onPointerDown={(e) => e.stopPropagation()}` on search link |
| Folio filter chips broken | Used `folios.value` (polymorphic syntax) instead of `{ folios: { in: ids } }` |
| Nav rail links visible only at page bottom | `.root` lacked `position: sticky; top: 0; align-self: flex-start; height: 100dvh` |
| Nav rail 9px font size on all pages | CSS cascade bug: `.link` base rule appeared after `@media (min-width: 768px)` block — moved before |
| Carousel overshoot/bounce | `commitDir` state using CSS `%` offsets replaces pixel-based commits — no overshoot |
| Carousel aspect ratio jump | `imageStack` and `imageInner` transitions added (90ms, ease-out) |
| Back button from search | `?from=search` query param → `showBack` prop → absolute-positioned link in image column |
| Favicon | `src/app/icon.png` (copied from `alm-favicon.png`); Next.js auto-injects `<link rel="icon">` |
| Draft entries visible in frontend | `draft: false` + `where: { _status: { equals: 'published' } }` added to `getEntries`, all API routes, and search route |
| Keyboard scroll-to-entry flicker | `isProgrammaticScrollRef` suppresses `onActivate` during smooth scroll; prevents "press twice" symptom |
| Carousel click zones | Invisible 18%-wide `<button>` zones on left/right edges of carousel |
| Swipe threshold reduced | `* 0.05` (from `* 0.15`) |
| Image column default width | `splitFraction` default `0.74` (was `0.667`) |
| Divider visual weight | `0.5px solid #808080`, 3px hit area, hover → `1px #525252` |
| Search button gradient overlap | Removed gradient, reduced to 44px × 44px |

---

## 2. Files created or modified

```
src/app/(frontend)/search/page.tsx                # SSR wrapper
src/app/(frontend)/search/SearchView.tsx          # client component: bar + chips + grid
src/app/(frontend)/search/SearchView.module.css
src/app/(frontend)/studio/page.tsx                # Studio overview
src/app/(frontend)/studio/[slug]/page.tsx         # Studio subpage
src/app/(frontend)/studio/studio.module.css
src/app/api/search/route.ts                       # GET /api/search?q=&folios=
src/app/api/folios/route.ts                       # GET /api/folios
src/app/api/entries/index/route.ts                # + draft:false + _status filter
src/app/api/entries/[slug]/route.ts               # + draft:false + _status filter
src/app/icon.png                                  # favicon
src/components/EntryCard/EntryCard.tsx
src/components/EntryCard/EntryCard.module.css
src/components/RichText/RichText.tsx              # Lexical → HTML server component
src/components/DesktopScrollLayout/DesktopScrollLayout.tsx   # many fixes
src/components/DesktopScrollLayout/DesktopScrollLayout.module.css
src/components/MobileTxtView/MobileTxtView.tsx    # forwardRef, scrollToEntry, isProgrammaticScrollRef
src/components/ImageGallery/ImageGallery.tsx      # commitDir prop
src/components/MobileEntryView/MobileEntryView.tsx # commitDir, showBack
src/components/EntryNavigator/EntryNavigator.tsx  # showBack prop
src/components/MobileNavRail/MobileNavRail.module.css # sticky fix, cascade fix
src/lib/getEntries.ts                             # + draft:false + _status filter
scripts/update-studio.ts                          # one-off: update DB with real studio text
```

**Deleted:**
```
src/components/Header/
src/components/BottomNav/
src/app/(frontend)/m2-prototype/
```

---

## 3. Architecture notes

### Draft filtering
Payload's local API (`getPayload`) runs with `overrideAccess: true` by default —
bypasses access control. Must explicitly add `draft: false` (return published snapshot
only, not latest version) AND `where: { _status: { equals: 'published' } }` (exclude
documents never published). Both guards needed in: `getEntries.ts`, `/api/entries/index`,
`/api/entries/[slug]`, `/api/search`.

### Carousel commit animation
`commitDir` state (−1 | 0 | 1) drives a CSS `%` offset on carousel slots:
`translateX(calc(${slot * 100}% + ${dragOffset}px + ${commitDir * -100}%))`.
Using `%` instead of pixels means the animation always lands at exact slot boundaries
regardless of column width — eliminates the overshoot that occurred when pixel offset
was based on the full column width but `100%` in CSS resolved to `stackWidth`.

### MobileTxtView as forwardRef
Exposes `scrollToEntry(id: number)` via `useImperativeHandle`.
`isProgrammaticScrollRef` + 500ms timer suppresses `onActivate` during keyboard-driven
smooth scroll, preventing intermediate entries from flickering into `focusedId`.

---

## 4. How to verify locally

```bash
pnpm dev
```

**Search:** `http://localhost:3000/search`
- Type in search bar → debounced results grid
- Click folio chip → filter entries by folio
- Click entry card → `/entry/[slug]?from=search`
- On entry page: back button visible in image column bottom-left

**Studio:** `http://localhost:3000/studio`
- Overview lists andrea / practice / point-of-departure / contact
- Each subpage renders real Lexical rich text content

**Draft filtering:**
- Unpublish an entry in `/admin` → it disappears from homepage and search
- Publishing it again → it reappears

**Desktop UX:**
- Drag divider to resize columns (3px hit area, hairline visual line)
- Click left/right edge zones of carousel to advance images
- ↑/↓ keys: focused entry scrolls into view in text column (no flicker)
- Aspect ratio change between carousel images: smooth 90ms transition
