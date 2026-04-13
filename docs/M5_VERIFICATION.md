# M5 Verification Report

**Milestone:** M5 — Polish
**Status:** ✅ Complete
**Date verified:** 2026-04-13
**Final commit:** `0afd20c` on `main`
**Repo:** https://github.com/ManuelHauer/alm

---

## 1. Tasks completed

| Task (from §M5) | Status | Notes |
|---|---|---|
| SEO: dynamic title, description, OG tags | ✅ | All pages covered; OG image from first entry image |
| IntroAnimation: "NO COOKIES EVER" | ✅ | Split-flap, sessionStorage, skippable, reduced-motion aware |
| Loading states: lazy image loading | ✅ | EntryCard thumbs + off-screen carousel slots |
| Error pages: 404, 500 | ✅ | not-found.tsx + error.tsx under (frontend) |
| Accessibility: skip-to-content, ARIA | ✅ | Skip link, :focus-visible, nested `<main>` fixed |
| prefers-reduced-motion | ✅ | Global CSS rule + JS hook for inline transitions |
| Zero cookies on public pages | ✅ | sessionStorage only; no document.cookie anywhere |
| robots.txt + sitemap.xml | ✅ | Auto-generated via App Router conventions |

### Additional fixes delivered in M5

| Fix | Details |
|---|---|
| Nested `<main>` (invalid HTML) | `EntryNavigator` mobile `<main>` → `<div role="region" aria-label="Entry viewer">` |
| Draft entries in search SSR | Added `draft: false` + `_status` filter to `search/page.tsx` SSR query |
| 405 on Payload REST API | `api/entries/[slug]` shadow-intercepted Payload's `PATCH /api/entries/:id`; moved to `api/entries/by-slug/[slug]` |
| studio.module.css parse error | Stray `:` at end of file |
| IntroAnimation bg | `#111` → `#808080` |
| Tab keyboard navigation | `:focus-visible` global rule; nav rail + toggle get orange ring |
| MobileTxtView clearTimeout null | `if (timer !== null) clearTimeout(timer)` |

---

## 2. Files created

```
src/hooks/useReducedMotion.ts                      # hook: window.matchMedia reduced-motion
src/components/IntroAnimation/IntroAnimation.tsx   # split-flap overlay, sessionStorage guard
src/components/IntroAnimation/IntroAnimation.module.css
src/app/(frontend)/not-found.tsx                   # 404 page
src/app/(frontend)/not-found.module.css
src/app/(frontend)/error.tsx                       # 500 page (must be 'use client')
src/app/robots.ts                                  # /robots.txt (App Router convention)
src/app/sitemap.ts                                 # /sitemap.xml with all entry slugs
src/app/api/entries/by-slug/[slug]/route.ts        # moved from entries/[slug]/route.ts
docs/M4_VERIFICATION.md
docs/M5_VERIFICATION.md                            # ← this file
```

## 3. Files modified

```
src/app/(frontend)/layout.tsx          # async, metadata template, viewport, IntroAnimation, skip link
src/app/(frontend)/styles.css          # skip-link styles, :focus-visible, shimmer keyframe, reduced-motion
src/app/(frontend)/page.tsx            # generateMetadata with OG image
src/app/(frontend)/entry/[slug]/page.tsx  # generateMetadata with OG image + dimensions
src/app/(frontend)/search/page.tsx     # metadata description + draft filter on SSR query
src/app/(frontend)/studio/page.tsx     # metadata description
src/app/(frontend)/studio/[slug]/page.tsx  # OG image from heroImage; title format fix
src/app/(frontend)/studio/studio.module.css  # removed stray colon
src/components/EntryNavigator/EntryNavigator.tsx   # <main> → <div role="region">
src/components/EntryNavigator/EntryNavigator.module.css  # .floatingToggle :focus-visible
src/components/MobileNavRail/MobileNavRail.module.css    # .link :focus-visible
src/components/ImageGallery/ImageGallery.tsx       # useReducedMotion + loading="lazy" on adjacent slots
src/components/EntryCard/EntryCard.tsx             # loading="lazy" on thumbnail
src/components/MobileTxtView/MobileTxtView.tsx     # clearTimeout null-safety
.env                                               # added NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

**Deleted:**
```
src/app/api/entries/[slug]/route.ts    # replaced by by-slug/[slug] to unblock Payload REST API
```

---

## 4. Architecture notes

### SEO + OG images
`layout.tsx` is now `async` and fetches `site-settings` global (cached 60s via `unstable_cache`).
OG image URLs require an absolute URL — `NEXT_PUBLIC_SERVER_URL` is the prefix. Set to
`http://localhost:3000` in `.env`; override to the production domain before deploy.

### IntroAnimation timing
```
Characters cycle at 60ms intervals (random char set)
Lock-in left→right, 110ms stagger, first at 300ms
Last character locks at ≈1840ms
Hold 400ms → fade-out 300ms → unmount
Total: ≈2540ms
```
`sessionStorage.setItem('alm-intro-played', '1')` is set on mount (before animation plays)
so a mid-animation refresh doesn't repeat it.

### prefers-reduced-motion
Two-layer approach:
1. **CSS**: global rule in `styles.css` disables all `transition-duration` + `animation-duration`
   via `!important` — covers all CSS Modules automatically.
2. **JS**: `useReducedMotion()` hook (wraps `window.matchMedia`) wired into `ImageGallery`
   inline `style={{ transition }}` — these can't be reached by CSS alone.

### Payload REST API route conflict
Payload 3 serves its REST API via `(payload)/api/[...slug]/route.ts` (catch-all).
Our previous `api/entries/[slug]/route.ts` was more specific and intercepted
`PATCH /api/entries/:id` (numeric Payload document IDs), returning 405 since only
`GET` was exported. Fix: moved to `api/entries/by-slug/[slug]` — numeric IDs now
reach Payload's catch-all cleanly.

### Updating descriptions via REST API
Direct DOM injection into the Payload admin Lexical editor is unreliable.
The correct approach — PATCH the REST API with Lexical JSON:

```bash
curl -X PATCH 'http://localhost:3000/api/entries/<numeric-id>' \
  -H "Authorization: JWT <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": {
      "root": {
        "type": "root", "format": "", "indent": 0, "version": 1,
        "direction": "ltr",
        "children": [{
          "type": "paragraph", "format": "", "indent": 0, "version": 1,
          "direction": "ltr", "textFormat": 0, "textStyle": "",
          "children": [{
            "type": "text", "format": 0, "mode": "normal",
            "style": "", "detail": 0, "version": 1,
            "text": "Description text here."
          }]
        }]
      }
    }
  }'
```

The `extractPlainDescription` hook fires on `beforeChange` and auto-populates
`plainDescription`. No admin UI interaction needed.

---

## 5. How to verify locally

```bash
pnpm dev
```

**Intro animation:** Open `http://localhost:3000` in a fresh private window (clears
sessionStorage). "NO COOKIES EVER" split-flap plays, grey background, tap to skip.
Refresh in same tab → no replay.

**SEO:** `curl -s http://localhost:3000 | grep '<title'` → `<title>alm</title>`.
`curl -s http://localhost:3000/entry/<slug> | grep 'og:title'` → entry title.

**404:** Visit `http://localhost:3000/entry/does-not-exist` → minimal 404 page.

**Tab focus:** Tab through the page → logo, nav rail links, IMG/TXT toggle all get
orange focus ring. No element is skipped or has invisible focus state.

**robots / sitemap:** `http://localhost:3000/robots.txt` and
`http://localhost:3000/sitemap.xml`

**Payload REST (no longer blocked):** `PATCH http://localhost:3000/api/entries/:id`
with `Authorization: JWT <token>` returns 200, not 405.

**Zero cookies:** DevTools → Application → Cookies → `localhost:3000` should be empty
after visiting any public page (admin login cookies are on `/admin` only).
