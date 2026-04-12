# M3 Status — Mobile + Desktop UI

> Last updated: 2026-04-12
> Status: **MOSTLY DONE** — mobile complete, desktop 3-column layout complete.

---

## Architecture

### Layout system

| Element | Value | CSS var |
|---|---|---|
| Rail width | 69px | `--rail-width: 4.3125rem` |
| Primary orange | `#e85c23` | `--alm-orange` |
| Separator | `0.5px solid #808080` | `--separator` |
| Font | Vialog LT Regular | `--font-sans` |

Font files: `public/fonts/Vialog-LT-Regular.woff2` + `.woff`
Logo SVG: `public/alm_logo.svg` (grey rect + transparent letter cutouts → white on grey)
Search SVG: `public/search.svg` (fill `#808080`)

### Mobile layout

```
[NavRail 69px] | [mobileMain flex:1]       [floating pill bottom-right]
                  IMG mode: MobileEntryView
                  TXT mode: MobileTxtView
```

**EntryNavigator** owns: `isMobile`, `imgTxtView`, `currentEntry`. Conditionally renders mobile vs desktop branch.

**No BottomNav on mobile.** Floating `IMG/TXT` orange pill fixed bottom-right.

Mobile search icon: fixed top-right with corner gradient (overlay on all mobile views).

### Desktop layout

```
[NavRail 69px] | [imageCol ~66%] [divider 1px] [textCol ~33%]
```

- Both panels always visible. No toggle pill. No BottomNav.
- DesktopScrollLayout is self-contained (includes its own NavRail).
- Divider is drag-resizable (0.30–0.85 split fraction).
- Image column: entry number above image, carousel (pointer drag + horizontal wheel), dots at bottom of image, title below image. All labels track image bounds via `imageStack` JS-computed width.
- Text column: MobileTxtView (infinite loop scroll, click entry → focus image col).
- Keyboard: `↑`/`↓` = prev/next entry; `←`/`→` = carousel prev/next.

---

## Components — current state

| Component | File | Status | Notes |
|---|---|---|---|
| `MobileNavRail` | `src/components/MobileNavRail/` | ✅ Done | Logo 0 padding, 69px rail, vertical links, desktop variant (centered links) |
| `EntryNavigator` | `src/components/EntryNavigator/` | ✅ Done | Mobile/desktop split, floating orange pill, mobile search icon |
| `MobileEntryView` | `src/components/MobileEntryView/` | ✅ Done | Tap zones, intrinsic aspect-ratio height, carousel, 250ms fix |
| `MobileTxtView` | `src/components/MobileTxtView/` | ✅ Done | 3× infinite loop, teleport, click→IMG, consistent borders, justified text |
| `ImageGallery` | `src/components/ImageGallery/` | ✅ Done | No slot padding, 220ms transition |
| `DesktopScrollLayout` | `src/components/DesktopScrollLayout/` | ✅ Done | 3-col layout, imageStack label alignment, keyboard nav |
| `Header` | `src/components/Header/` | ⚠️ Superseded | Desktop-only remnant; no longer rendered, to be deleted |
| `BottomNav` | `src/components/BottomNav/` | ⚠️ Superseded | No longer rendered; to be deleted |

---

## CSS design tokens (applied session)

- Rail width: `69px` → CSS var `--rail-width`
- Orange: `#e85c23` on pill background, active dots, active entry number
- Separator: `0.5px solid #808080` on rail border + entry borders
- ImageGallery slot padding: `0` (fixes carousel white-flash)
- imageWrap: `aspect-ratio` from image data (max 62vh) — no fixed vH
- MobileEntryView imageBlock padding: `0 12px`
- MobileTxtView entry padding: `9px 11px 11px 69px`
- MobileTxtView description: `text-align: justify; text-align-last: right`
- MobileTxtView entryNumber: `top: 6px; width: 43px`
- MobileTxtView borders: opacity on `.entryContent`/`.entryNumber`, not `.entry` — keeps borders at full weight regardless of focus
- Floating pill: `background: var(--alm-orange)`, active side `color: #111`, inactive `rgba(255,255,255,0.6)` — `:nth-child()` selector instead of `:last-child` (3rd child is indicator)
- Carousel reset delay: 250ms JS vs 220ms CSS transition
- Font: Vialog LT applied globally via `--font-sans` on body
- Search icon: `fill="#808080"` in SVG (img tag, no CSS color inheritance)
- Desktop divider: `1px`, `rgba(0,0,0,0.12)`
- Desktop imageStack: JS-computed width shared by entryNumber, imageInner, imageTitle — labels align with image edges
- Desktop keyboard: `↑↓` entry navigation, `←→` carousel

---

## Remaining work

- [ ] **Delete `Header` and `BottomNav` components** — no longer rendered anywhere
- [ ] **Desktop URL-on-scroll** — `history.replaceState` as text col scrolls (deferred from M3)
- [ ] **Search page** — `/search` route (M4)
- [ ] **Rich text** — Lexical renderer for `description` field (currently `plainDescription` plaintext)
- [ ] **WordPress import** — M6

---

## Known limitations / deferred

- Desktop portrait images: labels track image bounds via JS measurement (ResizeObserver). Multi-image entries with mixed aspect ratios use first image's ratio for container.
- iOS momentum scroll and the infinite-loop teleport may occasionally interrupt momentum. Accepted for MVP.
- Desktop URL-on-scroll (`history.replaceState` as text col scrolls) not wired.
- Rich text (Lexical) not yet rendered — using `plainDescription` plaintext.
