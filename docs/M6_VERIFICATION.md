# M6 Verification Report

**Milestone:** M6 — Production Deploy
**Status:** 🟡 In progress — app live, content loaded, frontend polish ongoing, DNS cutover pending
**Date started:** 2026-04-14
**Last updated:** 2026-04-20
**Repo:** https://github.com/ManuelHauer/alm

---

## 1. Infrastructure completed (2026-04-14)

| Task | Status | Notes |
|---|---|---|
| Hetzner CPX31 provisioned | ✅ | Ubuntu 24.04, 5.78.205.65 |
| Coolify installed + running | ✅ | http://5.78.205.65:8000 |
| Coolify app service deployed | ✅ | Auto-deploy on push to `main` — GitHub webhook wired 2026-04-14 |
| Coolify Postgres resource | ✅ | Managed separately from app container |
| Persistent media volume | ✅ | Named Docker volume → `/app/media` |
| `prodMigrations` wired | ✅ | Fixed: `push: true` is a no-op in production (NODE_ENV guard in Payload source); initial migration generated and runs on every cold boot (idempotent) |
| Layout cold-boot 500 fixed | ✅ | `getCachedSiteSettings()` try/catch — defaults on DB unavailability |
| Empty-entries SSR crash fixed | ✅ | `EntryNavigator` guard: `if (!currentEntry) return null` |

**Current app URL:**
`http://5.78.205.65` (user changed from sslip.io URL in Coolify)

---

## 2. Content + data (2026-04-14 – 2026-04-15)

| Task | Status | Notes |
|---|---|---|
| WP XML migration | ✅ | 172 entries created, 30 skipped (dupes/drafts), 0 image errors |
| 11 studio entries from almproject.com | ✅ | Scraped + created via `scripts/add-studio-entries.ts` |
| Folios assigned | ✅ | Architecture, Identity, Writing, Press, Books, Awards, News |
| Images loaded | ✅ | ~620 media items in production |
| entryNumber auto-assigned | ✅ | 220 entries, numbers 1–220 |

---

## 3. Bug fixes + polish (2026-04-14 – 2026-04-15)

| Fix | Status | Notes |
|---|---|---|
| Shuffle mode | ✅ | Random entry on homepage load via `unstable_cache` + `Math.random()` |
| Folio 405 (admin relationship picker) | ✅ | `GET /api/folios?limit=` returns Payload format; POST handler added |
| Search → wrong image on desktop | ✅ | `initialSlug` passed to `DesktopScrollLayout`, used to init `focusedId` |
| Desktop auto-focus: entry at vertical centre | ✅ | Pre-computed scroll offsets; focus follows middle of viewport |
| Desktop empty state (no images) | ✅ | Shows entry number + title + description centred in image column |
| Mobile description missing | ✅ | `plainDescription` shown below title in `MobileEntryView` |
| Mobile scroll crash | ✅ | Eliminated `getBoundingClientRect()` from hot path; pre-computed offsets + RAF throttle |
| Image loading (shimmer + preload) | ✅ | Adjacent entries preloaded via `new window.Image()`; `#efefea` placeholder during load |
| Nav rail text size on mobile | ✅ | `clamp(0.5625rem, 2.8vw, 0.6875rem)` — scales with viewport |
| Intro animation — reload grey flash | ✅ | Inline `<script>` in `<head>` stamps `html[data-intro-played]`; CSS hides overlay before paint |
| Intro animation — pre-animation text flash | ✅ | `useState([])` — letters empty until `useEffect` scrambles them |
| Search autofocus | ✅ | Desktop only (min-width 768px), no keyboard pop-up on mobile |
| entryNumber readOnly in admin | ✅ | Field set `readOnly: true`; auto-assigned, can't be manually edited |
| Media folders | ✅ | `folders: true` on Media collection; migration `20260414_211440` adds `payload_folders` table; runs on next boot |
| Search empty state | ✅ | Three horizontal rules (text-document pictogram) via pure CSS `background-image` |

---

## 3b. Post-2026-04-15 polish (staging iteration)

Work shipped to the staging IP (`http://5.78.205.65`) between 2026-04-15 and
2026-04-20 while fixing frontend issues surfaced on the live deploy.

| Fix / feature | Commit | Notes |
|---|---|---|
| Mobile IMG view rebuilt as continuous scroll stream | `13b7f81` | Replaces paged carousel on mobile IMG |
| Prevent horizontal scroll in mobile IMG stream | `7bd518a` | |
| Contain carousel overflow at slot level | `8e201d1` | Follow-up to horizontal-scroll fix |
| ALMANAC nav link in left rail | `ddfbcf7` | |
| Wrong-entry-on-tap bug + IMG stream gap → 130px | `7e95ae3` | |
| Fix OOM crash on fast scroll (IMG + TXT views) | `3ce91c2` | |
| IMG/TXT toggle redesign — orange pill + white circle | `c5e465e` | |
| Mode-switch recentring, desktop flash prevention, Vialog font, logo gap | `dd98f32` | |
| Toggle gradient, easier diagonal swipe, stable desktop resize focus | `66e6f35` | |
| Desktop resize focus, divider gap, radial corner gradients | `3d85aba` | |
| Prevent diagonal swipes from scrolling instead of advancing carousel | `b460a4f` | |
| **Scroll-perf merge** — single-copy scroll, throttled activate + `replaceState`, memo Slot | `c4e31d7` / `dce221e` | **Closes M3 tradeoff #1** — desktop URL now updates on scroll |
| Staging noindex gate (`ALM_NOINDEX` env flag) | `5b9774e` | Set `ALM_NOINDEX=1` in Coolify Production env to keep `http://5.78.205.65` out of search until DNS cutover |

**Untracked e2e tests (WIP, not yet committed):**
- `tests/e2e/mobile-stream.e2e.spec.ts`
- `tests/e2e/prod-img-stream.e2e.spec.ts`
- `tests/e2e/tap-accuracy.e2e.spec.ts`

---

## 4. M6 remaining checklist

### 4.1 DNS cutover (blocking everything else)

| Check | Status | Notes |
|---|---|---|
| Domain almproject.com points to 5.78.205.65 | ⬜ | WordPress still live — coordinate cutover |
| SSL/TLS provisioned | ⬜ | Coolify provisions Let's Encrypt automatically once DNS points |
| GitHub webhook updated HTTP → HTTPS | ⬜ | **Must do after SSL is live** — update webhook URL in GitHub repo → Settings → Webhooks; re-enable SSL verification |
| `NEXT_PUBLIC_SERVER_URL` confirmed | ⬜ | Currently `https://almproject.com` in Coolify build args — correct, but verify after cutover |
| `ALM_NOINDEX=1` set in Coolify Production | ⬜ | Keeps the raw-IP staging out of search until DNS cuts over. **Remove this env var when you want Google to index the site.** |

### 4.2 Post-cutover verification

| Check | Status | Notes |
|---|---|---|
| Homepage loads at almproject.com | ⬜ | |
| `/entry/[slug]` works | ⬜ | |
| `/search` works | ⬜ | |
| `/studio/*` works | ⬜ | |
| Admin login works at almproject.com/admin | ⬜ | |
| Media uploads work (Sharp + volume) | ⬜ | Upload test image via admin |
| OG images use correct absolute URL | ⬜ | `NEXT_PUBLIC_SERVER_URL` must be `https://almproject.com` |

### 4.3 Ops

| Check | Status | Notes |
|---|---|---|
| Nightly DB backup automated | ⬜ | `cron pg_dump` — commands in DEPLOYMENT_NOTES.md |
| Media backup automated | ⬜ | rsync or similar |
| Restore path tested | ⬜ | Documented but untested |

### 4.4 Final UX smoke test

| Check | Status | Notes |
|---|---|---|
| Mobile — real device | ⬜ | |
| Desktop — major browsers | ⬜ | |
| Intro animation (first visit + reload) | ⬜ | |
| IMG / TXT toggle | ⬜ | |
| Search + folio filter | ⬜ | |
| Studio pages | ⬜ | |

---

## 5. Files created / modified across M6

```
src/migrations/20260414_015111.ts     # initial schema migration
src/migrations/20260414_211440.ts     # media folders migration
src/migrations/index.ts               # exports both migrations
src/payload/payload.config.ts         # prodMigrations wired
src/payload/collections/Entries.ts    # entryNumber readOnly in admin
src/payload/collections/Media.ts      # folders: true
src/app/(frontend)/layout.tsx         # try/catch + inline script for intro fix
src/app/(frontend)/styles.css         # html[data-intro-played] CSS rule
src/app/(frontend)/search/SearchView.tsx  # desktop autofocus
src/components/IntroAnimation/IntroAnimation.tsx  # useState([]) + id="alm-intro"
src/components/EntryCard/EntryCard.module.css     # text-document pictogram (empty state)
src/components/EntryNavigator/EntryNavigator.tsx  # preload adjacent entries
src/components/MobileEntryView/MobileEntryView.tsx  # plainDescription below title
src/components/MobileTxtView/MobileTxtView.tsx    # scroll crash fix (pre-computed offsets)
src/components/DesktopScrollLayout/DesktopScrollLayout.tsx  # empty state + initialSlug
src/app/api/folios/route.ts           # GET Payload format + POST handler
src/app/(frontend)/page.tsx           # shuffle mode
scripts/migrate-wp.ts                 # WP XML → Payload (172 entries)
scripts/add-studio-entries.ts         # 11 almproject.com studio entries
docs/M6_VERIFICATION.md              # ← this file
```

---

## 6. Key gotchas

### `push: true` is dev-only
`@payloadcms/db-postgres` only pushes schema in `NODE_ENV !== 'production'`.
Use `pnpm payload migrate:create` + `prodMigrations` array for all schema changes.

### Payload 3 multipart uploads
Non-file fields (e.g. `alt`) must be sent as `_payload` JSON string, not as individual form fields:
```js
form.append('_payload', JSON.stringify({ alt: 'description' }))
```

### Coolify uses its own managed Postgres
The docker-compose postgres service is ignored — Coolify provisions its own resource.
`DATABASE_URL` is injected at runtime.

### Media volume must be pre-configured
Without the Coolify persistent volume on `/app/media`, files are wiped on every redeploy.

### After DNS cutover
- Update GitHub webhook to `https://` URL and re-enable SSL verification
- Verify `NEXT_PUBLIC_SERVER_URL=https://almproject.com` in Coolify build args
