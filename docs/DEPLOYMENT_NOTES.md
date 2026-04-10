# Deployment Notes

Operational reference for the alm site. Companion to `docs/HANDOFF.md`
(spec) and `README.md` (none yet — to be written for M6).

## Local development environment (current as of M1)

| Tool | Version | Install command |
|---|---|---|
| Node | 22 LTS (22.22.2 as of 2026-04-10) | `brew install node@22 && brew link --force --overwrite node@22` |
| pnpm | 10.x | `brew install pnpm` |
| PostgreSQL | 16 (native, not Docker) | `brew install postgresql@16 && brew services start postgresql@16` |
| GitHub CLI | latest | `brew install gh` then `gh auth login` |

The repo's `engines` field requires `node ^18.20.2 || >=20.9.0`. Node 22 is
LTS and Sharp 0.34.2 ships prebuilt binaries for it. **Do not use Node 25+
locally** — it's untested against Payload 3.82 and Sharp may need to compile
from source.

## Postgres setup (local)

Native install (Docker is M6-only — see below). After
`brew services start postgresql@16`:

```bash
psql postgres -c "CREATE ROLE alm WITH LOGIN PASSWORD 'alm';"
psql postgres -c "CREATE DATABASE alm OWNER alm;"
```

`.env` should contain (NOT committed):

```
DATABASE_URI=postgres://alm:alm@localhost:5432/alm
PAYLOAD_SECRET=<random 32+ char string>
```

Schema is auto-managed by Payload's Postgres adapter on first `pnpm dev` —
no manual migrations during M1–M5. Migrations get formalized in M6.

## Docker Desktop (deferred to M6)

**Status:** Not installed locally. Local dev uses native Postgres because
the production deployment target is a Hetzner VPS using Docker Compose,
and we don't need Docker locally until M6 (deployment).

**Why not installed yet:** `brew install --cask docker` requires sudo
to write to `/Applications`, and the install attempt during M1 failed
because the brew cask installer ran non-interactively under Claude Code
and couldn't prompt for the user's sudo password. Pivoting to native
Postgres unblocked M1 immediately at zero cost.

**When you need Docker (M6):**

1. Manual install (interactive, requires sudo password):
   ```bash
   brew install --cask docker
   ```
   This downloads Docker Desktop ~600MB and installs it to `/Applications`.
   You'll be prompted for your macOS password once.

2. Launch Docker Desktop from Applications. Wait for the whale icon in
   the menu bar to stop animating (means engine is up). First launch
   asks you to accept the license and may prompt for Rosetta on Apple
   Silicon — both are one-time.

3. Verify:
   ```bash
   docker --version
   docker compose version
   docker run --rm hello-world
   ```

4. After Docker is running, M6 will add `docker-compose.yml` at the
   project root with services for `postgres`, `app` (Next.js), and
   eventually `caddy` (reverse proxy + Let's Encrypt) for the production
   Hetzner deployment. Local dev can keep using native Postgres OR
   switch to the Compose stack — both are supported as long as
   `DATABASE_URI` in `.env` points at the right host.

**Alternative if Docker Desktop is unwanted on the dev machine:**
Colima (`brew install colima docker docker-compose && colima start`)
provides a lightweight Docker engine without the Desktop GUI. Same
`docker compose` workflow, no sudo required for install. Acceptable
substitute for M6 if disk space or licensing is a concern.

## Production target (M6)

- **Host:** Hetzner Cloud VPS (CX22 or larger), Ubuntu 24.04 LTS
- **Stack:** Docker Compose — postgres + Next.js app + Caddy reverse proxy
- **Domain:** almproject.com (DNS to be cut over from current WordPress)
- **TLS:** Caddy auto-provisions Let's Encrypt
- **Backups:** Per handoff §11 — nightly `pg_dump` to S3-compatible
  storage + `/media` rsync
- **CI/CD:** GitHub Actions → SSH deploy → `docker compose pull && up -d`
- **Cookieless constraint:** the public site sets zero cookies (handoff
  §8.1, §8.9 exempts admin auth cookies behind /admin). No analytics
  cookies, no consent banner, no cookie middleware on `(frontend)` routes.

## Backup commands (will be cron'd in M6)

```bash
# Nightly DB dump
pg_dump -Fc -h localhost -U alm alm > alm-$(date +%Y%m%d).dump

# Restore
pg_restore -h localhost -U alm -d alm --clean --if-exists alm-YYYYMMDD.dump

# Media sync (production → off-site)
rsync -av --delete /opt/alm/media/ user@backup-host:/backups/alm/media/
```
