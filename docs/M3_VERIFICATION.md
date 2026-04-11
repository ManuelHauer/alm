# M3 Verification Report

**Milestone:** M3 — Mobile Entry View + Wiring
**Status:** ✅ Complete (accepted with known follow-ups)
**Date verified:** 2026-04-11
**Commits:** `f5e3c57` → HEAD on `main`
**Repo:** https://github.com/ManuelHauer/alm

---

## 1. Tracks

M3 was split into three tracks:

| Track | Description | Status |
|---|---|---|
| A | Data layer — entry types and API routes | ✅ |
| C | Routing shell — EntryNavigator, Header, BottomNav, routes | ✅ |
| B | Mobile UI — MobileEntryView, ImageGallery | ✅ |

Track C was built before Track B (tradeoffs documented in `project_alm_tradeoffs.md`).

---

## 2. Files created or modified

```
src/types/entry.ts                              # shared types: EntryDetail, EntryIndexItem, etc.
src/lib/getEntries.ts                           # server-side getAllEntries() via Payload directly
src/app/api/entries/index/route.ts              # GET /api/entries/index → EntryIndexItem[]
src/app/api/entries/[slug]/route.ts             # GET /api/entries/[slug] → EntryDetail | 404
src/app/(frontend)/page.tsx                     # home page → EntryNavigator
src/app/(frontend)/entry/[slug]/page.tsx        # direct entry link → EntryNavigator + initialSlug
src/components/EntryNavigator/EntryNavigator.tsx
src/components/EntryNavigator/EntryNavigator.module.css
src/components/Header/Header.tsx
src/components/Header/Header.module.css
src/components/BottomNav/BottomNav.tsx
src/components/BottomNav/BottomNav.module.css
src/components/MobileEntryView/MobileEntryView.tsx
src/components/MobileEntryView/MobileEntryView.module.css
src/components/ImageGallery/ImageGallery.tsx
src/components/ImageGallery/ImageGallery.module.css
src/components/DesktopScrollLayout/mockData.ts  # updated: MockEntry → EntryDetail, numeric IDs
```

---

## 3. Acceptance criteria

| Criterion (from §M3) | Status | Notes |
|---|---|---|
| Mobile shows current entry (image + text) | ✅ | Image area 62vh, info area scrollable |
| Swipe left/right navigates image carousel | ✅ | 3-slot carousel, axis-locked drag |
| Swipe up/down navigates entries | ✅ | Vertical axis lock → entry navigation |
| IMG/TXT toggle functional on mobile | ✅ | BottomNav pill, passed as prop |
| URL updates on mobile navigation | ✅ | `history.replaceState` on navigate |
| Navigation wraps (first ↔ last) | ✅ | `wrapIdx` in both ImageGallery and MobileEntryView |
| Desktop layout unchanged | ✅ | DesktopScrollLayout unchanged |
| `/entry/[slug]` direct links work | ✅ | `generateMetadata` + `initialSlug` prop |
| Home page (`/`) works | ✅ | Loads most-recent entry first |

---

## 4. Architecture

### Data flow
```
Server component (page.tsx)
  → getAllEntries()          ← Payload direct (no HTTP roundtrip)
  → <EntryNavigator entries={entries} initialSlug={slug} />

EntryNavigator (client)
  → isMobile (matchMedia, SSR defaults to desktop/false)
  → Desktop: <DesktopScrollLayout entries={entries} />
  → Mobile:  <MobileEntryView entry={currentEntry} ... onNavigate={handleNavigate} />
```

### Mobile navigation
All entries are already in memory (SSR bundle). Mobile navigation is a pure array lookup —
no `/api/entries/[slug]` fetch needed. Much faster UX than on-demand fetch.

### Gesture handling
Single `useDrag` handler on the image area with manual axis lock:
- First 6px of movement determines `lockedAxis` ('h' or 'v')
- Horizontal: image carousel (same 3-slot/commitSwipe pattern as desktop)
- Vertical: entry navigation (50px threshold or velocity > 0.5)
- `filterTaps: true` prevents accidental gesture-on-tap

### Layout chain (mobile)
```
EntryNavigator .root    → height: 100dvh, flex column
  EntryNavigator .main  → flex: 1, min-height: 0, flex column
    MobileEntryView .root → flex: 1, min-height: 0, flex column
      .imageArea          → flex: 0 0 62%
      .infoArea           → flex: 1 1 0, overflow-y: auto
```
`min-height: 0` at each level is required to prevent flex children from
overflowing their parent's height.

---

## 5. Known follow-ups (non-blocking)

- **Gesture refinement** — swipe feel, thresholds, and entry transition animation
  need tuning with real content on a real device
- **Entry transition animation** — vertical swipe commits immediately (no visual
  entry-slide animation yet); add a translateY fly-in/out in a follow-up
- **Desktop URL on scroll** — not wired (C-before-B tradeoff); add `onFocusChange`
  prop to `DesktopScrollLayout` when needed
- **Full bundle SSR** — all `EntryDetail[]` SSR'd into page bundle (~50–100KB at
  130 entries); monitor at M6, add lazy hydration if needed
- **Safari / iOS testing** — gesture and layout behavior unverified on real device
- **IMG/TXT toggle on desktop** — `imgTxtView` state is owned by `EntryNavigator`
  but not yet wired into `DesktopScrollLayout`
- **Text-only entries on mobile** — `noImage` placeholder shown; may need design treatment

---

## 6. How to verify locally

```bash
pnpm install
cp test.env .env.local
docker compose up -d
pnpm dev
```

**Desktop** (`> 767px`): Open `http://localhost:3000` — same as M2 prototype.

**Mobile** (resize to `< 768px` or use devtools device emulation):
- Open `http://localhost:3000` — first entry loads
- Image area fills top ~62% of screen
- Swipe left/right on image → carousel advances
- Swipe up/down on image → navigates to next/prev entry
- Bottom nav pill → toggles IMG/TXT (TXT hides image area)

**Direct link:** `http://localhost:3000/entry/single-frame-study` — loads that entry,
full desktop + mobile navigation available from there.
