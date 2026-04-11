# M2 Verification Report

**Milestone:** M2 — Desktop Scroll Prototype
**Status:** ✅ Complete (accepted with known follow-ups)
**Date verified:** 2026-04-11
**Tag:** `m2-complete`
**Commits:** `dd6d41e` → `f6306b9` on `main`
**Repo:** https://github.com/ManuelHauer/alm

---

## 1. Files created or modified

```
src/components/DesktopScrollLayout/DesktopScrollLayout.tsx   # main component
src/components/DesktopScrollLayout/DesktopScrollLayout.module.css
src/components/DesktopScrollLayout/mockData.ts               # 5 mock entries
src/app/(frontend)/m2-prototype/page.tsx                     # isolated demo route
src/app/(frontend)/layout.tsx                                # added suppressHydrationWarning
```

---

## 2. Interaction model (revised from §M2 spec)

The original spec described a scroll-snap layout with 100vh fixed-height entry blocks.
During implementation this was revised based on review:

| Spec | Implemented |
|---|---|
| `scroll-snap-type: y proximity`, 100vh blocks | Continuous scroll, natural entry heights |
| `scrollend` / IntersectionObserver focus detection | Scroll listener + virtual focus line at 30% |
| Crossfade between stacked opacity layers | 3-slot pointer-drag carousel (prev/cur/next) |
| Arrow keys only for image cycling | Pointer drag + trackpad scroll + prev/next click areas |

**Why:** The snap+100vh model forced one entry per viewport and made short or text-only entries impossible to hold in focus. Continuous scroll with a focus line is more readable and scales naturally to real content lengths.

---

## 3. Acceptance criteria

| Criterion (from §M2) | Status | Notes |
|---|---|---|
| Right panel scrolls to advance entries | ✅ | Continuous, no snap |
| Left image updates when focus changes | ✅ | 3-slot carousel, 220ms fly transition |
| Transition is smooth | ✅ | Physical drag feel, configurable threshold |
| Long descriptions fit within block | ✅ | Natural height, no clipping |
| Text-only entry shows blank left panel | ✅ | `leftEmpty` shown, slots not rendered |
| Works in Chrome AND Safari | ⚠️ | Verified Chrome; Safari TBD (M3 follow-up) |
| No scroll hijacking | ✅ | Axis lock, native feel |

**Added beyond spec:**
- Infinite-loop carousel (wrapIdx — no hard stops)
- Horizontal trackpad scroll on left panel triggers carousel
- Vertical trackpad scroll on left panel forwarded to right panel
- Single-click focus (isProgrammaticScroll ref prevents listener override)
- Last entry reachable via `padding-bottom: 70vh` on right panel

---

## 4. Focus detection

Virtual focus line at 30% from the top of the right scroll panel.
On scroll, `updateFocus` finds the entry whose top most recently crossed
above that line — the last heading the user scrolled past.

`isProgrammaticScroll` ref blocks `updateFocus` for 600ms after a
programmatic `scrollTo`, so single-click focus is immediate and not
overwritten mid-animation.

---

## 5. Image carousel

Three absolutely-positioned slots (prev / cur / next) translate together
with `dragOffset` during pointer drag. On release:

- Past 25% of panel width → `commitSwipe(direction)`: slots fly to
  ±panelWidth (220ms ease), then index updates and offset resets
  without transition (slots already in final position — no visual jump)
- Below threshold → snap back (220ms ease)

`isTransitioningRef` guards `commitSwipe` against double-fire from
rapid clicks or overlapping trackpad events.

Infinite loop: `wrapIdx = ((i % len) + len) % len`. No hard stops.

Trackpad horizontal scroll: accumulates `deltaX` (threshold 80px,
cooldown 500ms). Scroll right → next, scroll left → prev.

---

## 6. M2 follow-up notes (non-blocking, carry into M3)

- **Safari verification** — pointer events and wheel forwarding untested
- **Real data** — focus logic and carousel behavior to re-verify once
  wired to Payload (M3 task 11)
- **Very long descriptions** — natural height should handle them, but
  confirm no layout edge cases with real content
- **Left panel empty state** — currently "no image" text on grey; may
  need a subtler treatment (design decision deferred)
- **Image crossfade on entry change** — slots remount on focus change
  (no pre-loaded crossfade like the original stacked approach); evaluate
  with real images in M3

---

## 7. How to verify locally

```bash
git checkout m2-complete   # or stay on main
pnpm install
cp test.env .env.local
docker compose up -d       # postgres
pnpm dev
```

Open `http://localhost:3000/m2-prototype`

- Scroll right panel → entries advance, left image updates
- Click any dimmed entry → focuses immediately, scrolls into position
- Drag left panel left/right → image slides, wraps infinitely
- Hover left/right edges of image → chevron appears, click to advance
- Two-finger horizontal scroll on left panel → image carousel
- Two-finger vertical scroll on left panel → right panel scrolls
- Entry 4 (Note on Method) → left panel shows blank grey
