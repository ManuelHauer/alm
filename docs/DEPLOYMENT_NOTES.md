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

## Hetzner server (provisioned 2026-04-14)

**Server:** `alm-prod`
**Type:** CPX31 (4 vCPU, 8 GB RAM, 160 GB SSD, 20 TB traffic, ~€16/mo)
**Location:** Hillsboro virtual DC 1 (us-west — low latency from LA where Andrea works)
**OS:** Ubuntu 24.04 LTS
**IPv4:** `5.78.205.65`
**IPv6:** `2a01:4ff:1f0:51c3::/64`

**Why Hillsboro over Helsinki:** Cloudflare CDN serves all media and static assets
globally from the edge. What goes to the origin is Payload admin traffic (uploads,
editing). Hillsboro → LA is ~10ms; Helsinki → LA is ~140ms. Better admin UX.

**Why CPX31 over CXP32:** "Regular Performance" gives predictable CPU under load
(Sharp image processing during uploads). CXP32 "Cost Optimized" is burstable/shared.

**Networking:**
- Public IPv4: ✅ (required for Cloudflare; ~€0.60/mo)
- Public IPv6: ✅ (free)
- Private Networks: off (single server, no need)

**SSH access:**
```bash
ssh root@5.78.205.65
# key: ~/.ssh/id_ed25519  passphrase: alm
```
Key name in Hetzner: `alm-hetzner`
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHtCYwQPIBca8rgOEqyv7eLUYFQO6OkUKmwK/mf+GF3k alm-hetzner
```

**Cloud-init** (ran on first boot, installs Coolify automatically):
```yaml
#cloud-config
package_update: true
package_upgrade: true
runcmd:
  - curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```
After ~5 min, Coolify is accessible at `http://<server-ip>:8000` for initial setup.

**Volumes:** none — 160 GB local SSD is sufficient for Postgres + media.
**Placement Groups:** none (single server).

---

## Production stack (as built, 2026-04-14)

- **Host:** Hetzner CPX31, Ubuntu 24.04 LTS, `5.78.205.65`
- **Stack:** Coolify managing a single Docker container (Next.js + Payload)
- **Database:** Coolify-managed Postgres resource (`usvppwwx31tzkhjx9inol51d`)
- **Media:** Named Docker volume → `/app/media` (persists across redeploys)
- **CI/CD:** Coolify auto-deploys on push to `main` (webhook on GitHub)
- **Current URL:** `http://utf3x8de87jjp59gi2egibfo.5.78.205.65.sslip.io`
- **Domain:** almproject.com — DNS cutover pending (WordPress still live)
- **TLS:** Coolify will provision Let's Encrypt once domain points to server
- **Cookieless constraint:** public site sets zero cookies; admin auth cookies
  are scoped to `/admin` only (handoff §8.1, §8.9)

## Backup commands (run on server via SSH)

Production Postgres is a Coolify-managed container. Connect via `docker exec`:

```bash
# DB dump (run on server)
docker exec usvppwwx31tzkhjx9inol51d pg_dump -U postgres postgres -Fc \
  > /tmp/alm-$(date +%Y%m%d).dump

# Copy dump off-server
scp -i ~/.ssh/id_ed25519 root@5.78.205.65:/tmp/alm-YYYYMMDD.dump ./

# Restore (wipe existing data first, then restore)
docker exec usvppwwx31tzkhjx9inol51d psql -U postgres -d postgres \
  -c "TRUNCATE entries, media, users, folios, studio_pages, payload_preferences, payload_locked_documents CASCADE;"
docker cp alm-YYYYMMDD.dump usvppwwx31tzkhjx9inol51d:/tmp/
docker exec usvppwwx31tzkhjx9inol51d pg_restore -U postgres -d postgres \
  --data-only --no-owner --no-privileges /tmp/alm-YYYYMMDD.dump

# Media files — copy from volume (find container name first)
docker cp <app-container-id>:/app/media /tmp/media-backup/
```
