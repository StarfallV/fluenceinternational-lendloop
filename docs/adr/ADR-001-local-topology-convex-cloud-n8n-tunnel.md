# ADR-001 — Local topology: Convex cloud dev deployment, n8n in Docker behind a filtered tunnel

**Status:** Accepted (revised 2026-11-10 after planning review round 1)
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
- **Pros:**
  - the standard Convex workflow, with no admin keys and no self-hosting;
  - Convex's cloud dashboard and logs for debugging;
  - integration traffic takes the same path as production: signed HTTPS over the internet;
  - nothing to install on the host besides Docker.
- **Cons:**
  - the URL changes on every restart, so it has to be re-synced;
  - the tunnel exposes whatever it points at;
  - there is one more moving part that can go stale.

### Option B — Run Convex locally as well

Run the open-source backend (`npx convex dev --local`, or a self-hosted container in compose), so
nothing leaves the machine.
- **Pros:**
  - no tunnel and no URL churn;
  - nothing is publicly exposed.
- **Cons:**
  - Containers can reach host services through `host.docker.internal` on every platform: Linux
    needs `extra_hosts: host-gateway`. A backend bound only to `127.0.0.1` is still unreachable
    from containers on Linux, though. Avoiding that means running the backend inside compose.
  - Running the backend in compose means self-hosted admin keys and a separate dashboard.
  - It moves reviewers away from the Convex workflow they are most likely to know.

  Signing behaves the same either way. This option is viable; it was not chosen.

### Option C — n8n Cloud

- **Pros:** a stable public URL.
- **Cons:** every reviewer needs an n8n Cloud account. The brief asks for a docker-compose setup.

### Option D — ngrok

- **Pros:** a static domain on the free tier.
- **Cons:** it needs an account and an auth token for every reviewer.

## Decision

**Option A, with its downsides engineered away:**
- **Exposure:** the tunnel points at an **edge proxy** (Caddy), not at n8n. The proxy forwards only
  `POST /webhook/lendloop/*` and answers everything else with a distinguishable `404`.
- **URL churn:** `npm run setup` and `npm run tunnel:sync` read the tunnel's hostname and set
  `N8N_LOAN_EVENTS_URL` in Convex. `npm run dev` runs the sync automatically when the stack is up.
- **Staleness:** a stale URL (Cloudflare `530`) is labelled `TUNNEL_STALE` in delivery records, and
  admin health tells the developer how to fix it.
- **Network compatibility:** cloudflared uses `--protocol http2`, because QUIC is blocked on some
  networks.

## Rationale

Option A keeps the setup reviewers most likely know (`npx convex dev`, the cloud dashboard), and
needs no extra accounts. With the edge proxy, the automatic re-sync and the stale-tunnel label, its
costs are small. Option B stays a reasonable alternative and is mentioned in the README for
anyone who prefers it.

## Consequences

- The URL changes per run. `tunnel:sync` is idempotent and runs on `npm run dev`, and the outbox
  retries anything sent while the URL was stale.
- The helper scripts are Node/TypeScript, and they start Node entry points directly rather than
  `npx`, so they behave the same on Windows, macOS and Linux. `.gitattributes` forces LF line
  endings for files mounted into Linux containers.
- The README must explain why the tunnel exists, because it is the least obvious part of the
  setup.
