# M6 Verification Report

**Milestone:** M6 — Production Deploy
**Status:** 🟡 In progress — infrastructure up, checklist items below pending
**Date started:** 2026-04-14
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
| Test data loaded | ✅ | 14 entries (5 published), 63 media files copied from localhost |

**Current app URL (sslip.io, temporary):**
`http://utf3x8de87jjp59gi2egibfo.5.78.205.65.sslip.io`
**User manually changed URL inside coolify to the server adress**
`http://5.78.205.65`

---

## 2. M6 checklist

### 2.1 Public site sanity

| Check | Status | Notes |
|---|---|---|
| Homepage loads reliably | ⬜ | Verify at final domain |
| `/entry/[slug]` works | ⬜ | |
| `/search` works | ⬜ | |
| `/studio/*` works | ⬜ | |
| Admin login works | ⬜ | Create first admin user at `/admin` |
| Media uploads work in production | ⬜ | Upload test image via admin |
| No unexpected 500s after cold boot | ✅ | Fixed — layout + EntryNavigator guarded |

### 2.2 Production environment sanity

| Check | Status | Notes |
|---|---|---|
| Real `PAYLOAD_SECRET` set | ✅ | Set in Coolify env vars |
| Real database credentials set | ✅ | Coolify-managed Postgres |
| `NEXT_PUBLIC_SERVER_URL` correct | ⬜ | Currently `https://almproject.com` in Coolify build args — correct value but DNS not pointed yet |
| Domain (almproject.com) points to server | ⬜ | DNS cutover from WordPress not done |
| SSL/TLS works | ⬜ | Coolify will provision Let's Encrypt once domain points |
| Uploads persist across redeploys | ✅ | Coolify named volume on `/app/media` |

### 2.3 Data sanity

| Check | Status | Notes |
|---|---|---|
| WordPress migration run | ⬜ | Export not yet available (per handoff §M6) |
| Entries checked | ⬜ | Currently 5 published test entries from localhost |
| Images checked | ⬜ | |
| Studio pages checked | ⬜ | |
| Slugs checked | ⬜ | |
| No obviously broken content | ⬜ | |

### 2.4 Backup sanity

| Check | Status | Notes |
|---|---|---|
| Database backup exists | ⬜ | Commands documented below; not yet automated |
| Media backup exists | ⬜ | |
| Restore path documented | ✅ | See DEPLOYMENT_NOTES.md |
| Restore test done | ⬜ | |

### 2.5 Security / ops sanity

| Check | Status | Notes |
|---|---|---|
| SSH access works | ✅ | `root@5.78.205.65`, key `~/.ssh/id_ed25519`, passphrase `alm` |
| Password auth disabled | ✅ | `PasswordAuthentication no` set in `/etc/ssh/sshd_config`, SSH reloaded 2026-04-14 |
| No accidental secrets in repo | ✅ | `.env` is gitignored; secrets only in Coolify env vars |
| Admin user credentials sane | ✅ | `admin@alm.local` (pw: NMguhHJX779j!) + `andrea@alm.local` (pw: Alm2024admin!) created directly in DB 2026-04-14 |

### 2.6 Final UX sanity

| Check | Status | Notes |
|---|---|---|
| Mobile works on real phones | ⬜ | |
| Desktop works in major browsers | ⬜ | |
| Intro animation behaves correctly | ⬜ | |
| Text/image modes feel correct | ⬜ | |
| No major broken interactions | ⬜ | |

---

## 3. Files created / modified in M6

```
src/migrations/20260414_015111.ts     # initial schema migration (all tables)
src/migrations/20260414_015111.json   # drizzle snapshot
src/migrations/index.ts               # exports migrations array
src/payload/payload.config.ts         # prodMigrations wired; push: true removed
src/app/(frontend)/layout.tsx         # try/catch around getCachedSiteSettings()
src/components/EntryNavigator/EntryNavigator.tsx  # empty-entries guard
docs/DEPLOYMENT_NOTES.md              # updated with actual production setup
docs/M6_VERIFICATION.md              # ← this file
```

---

## 4. Key gotchas discovered

### `push: true` is dev-only
`@payloadcms/db-postgres` `connect.js` line 110:
```js
// Only push schema if not in production
if (process.env.NODE_ENV !== 'production' && ...) {
    await pushDevSchema(this);
}
```
**Fix:** generate migrations with `pnpm payload migrate:create` and pass them as
`prodMigrations` in the postgres adapter config. Migrations run on every cold boot,
are idempotent (tracked in `payload_migrations` table).

### Coolify uses its own managed Postgres
The `docker-compose.yml` postgres service is ignored by Coolify — it provisions its
own postgres resource (`usvppwwx31tzkhjx9inol51d`). `DATABASE_URL` is injected by
Coolify at runtime and points to the managed instance.

### Media volume must be pre-configured
Without the Coolify persistent volume on `/app/media`, files are wiped on every
redeploy. Volume was configured in Coolify UI → Persistent Storage before going live.

---

## 5. What's next (priority order)

1. **Verify all public routes** — homepage, entry pages, search, studio
2. **Test media upload** — upload one image via admin to confirm Sharp processing + volume persistence
3. **WordPress export + migration** — when export is available (handoff §M6)
4. **DNS cutover** — point almproject.com → 5.78.205.65; Coolify provisions SSL automatically. After DNS is live:
   - Update GitHub webhook URL from `http://` → `https://` and re-enable SSL verification (GitHub repo → Settings → Webhooks)
   - Update the Coolify webhook secret to something that is not the admin password
   - Confirm `NEXT_PUBLIC_SERVER_URL` build arg is still `https://almproject.com` in Coolify
7. **Set up nightly backups** — cron pg_dump + media rsync (see DEPLOYMENT_NOTES.md)
8. **UX smoke test** — mobile + desktop, intro animation, all interactions
