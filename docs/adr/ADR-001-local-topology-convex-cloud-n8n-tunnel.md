# ADR-001 — Local topology: Convex cloud dev deployment, n8n in Docker behind a filtered tunnel

**Status:** Accepted
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

The brief requires Convex to call an n8n webhook, and n8n to call Convex HTTP endpoints.
`npx convex dev` deploys functions to a **cloud** dev deployment. n8n runs in Docker on the
developer's machine. A cloud deployment cannot open a connection to `localhost`, so the
Convex → n8n direction needs a route in. The n8n → Convex direction works as is, because
`*.convex.site` is public. The primary developer is on Windows with Docker Desktop; reviewers
may be on macOS or Linux.

## Options Considered

### Option A — Convex cloud plus a tunnel to local n8n

A `cloudflared` quick tunnel (no account needed) gives local n8n a public HTTPS URL. A script
writes that URL into the Convex env.
- **Pros:** the standard Convex workflow; the same topology as production (signed HTTPS calls
  over the internet); nothing to install on the host besides Docker.
- **Cons:** the URL changes on every restart, so it needs a sync script. The tunnel exposes
  whatever it points at.

### Option B — Run Convex locally as well

Run the local backend (`npx convex dev --local` or a self-hosted container), so everything is on
one machine and no tunnel is needed.
- **Pros:** no public exposure; no tunnel URL churn.
- **Cons:** containers reaching host services differs by platform (`host.docker.internal` is
  reliable on Docker Desktop but not on Linux). It is further from production, and the signing
  happens on a path that never leaves the machine.

### Option C — n8n Cloud

- **Pros:** a stable public URL.
- **Cons:** every reviewer needs an n8n Cloud account. The brief asks for a docker-compose setup.

### Option D — ngrok

- **Pros:** a static domain on the free tier.
- **Cons:** it needs an account and an auth token for every reviewer.

## Decision

**Option A.** Compose runs n8n, Mailpit, an **edge proxy** (Caddy) and `cloudflared`. The
tunnel points at the edge proxy, which forwards only `POST /webhook/lendloop/*` to n8n. Two
scripts maintain the tunnel URL: `npm run setup` and `npm run tunnel:sync`. They read the quick
tunnel's hostname and set `N8N_LOAN_EVENTS_URL` in the Convex env.

## Rationale

It keeps the setup reviewers already know (`npx convex dev`), needs no extra accounts, and
exercises the integration the way production would. The edge proxy removes the main downside of
a tunnel: the n8n editor and test webhooks stay on localhost.

## Consequences

- The URL changes per run. `tunnel:sync` is idempotent and cheap to re-run, and the outbox
  retries anything sent during a stale-URL window.
- The helper scripts are Node/TypeScript, so they behave the same on Windows, macOS and Linux.
  `.gitattributes` forces LF line endings for files mounted into Linux containers.
- The README must explain why the tunnel exists, because it is the least obvious part of the
  setup.
