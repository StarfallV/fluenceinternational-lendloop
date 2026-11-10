# ADR-004 — HMAC request signing in both directions

**Status:** Accepted
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

The brief requires signing webhook payloads ("e.g. HMAC with a shared secret") and verifying
them on the receiving side, and securing the integration in both directions. Both receivers are
public HTTP endpoints: the n8n webhook through the tunnel, and the Convex HTTP actions.

## Options Considered

### Option A — Static bearer token

A shared token in a header, for example through n8n's Header Auth credential.
- **Pros:** native to n8n; trivial.
- **Cons:** it doesn't protect the body (no integrity), and a captured request can be replayed
  forever.

### Option B — HS256 JWT through n8n's Webhook "JWT Auth"

- **Pros:** n8n verifies the signature and expiry natively, and the secret lives in an n8n
  credential.
- **Cons:** the signature doesn't cover the body unless a body-hash claim is added and checked by
  hand. It is an unusual scheme for webhooks, and the n8n → Convex direction would still need its
  own design.

### Option C — HMAC-SHA256 over the timestamp, method, path and raw body

The scheme Stripe and GitHub popularized, extended to cover the method and path.
- **Pros:** integrity, authenticity and freshness in one well-known scheme. The same code works
  in both directions.
- **Cons:** n8n has no HMAC credential type, so verification is a Code node that reads the secret
  from `$env`.

### Single shared secret vs. one secret per direction

One secret is simpler. Two secrets mean a leak on either side can't be used to forge the other
side's calls.

## Decision

**Option C, with one secret per direction** (`CONVEX_TO_N8N_SIGNING_SECRET`,
`N8N_TO_CONVEX_SIGNING_SECRET`):

```
canonical = `${timestamp}.${METHOD}.${path}.${rawBody}`
X-LendLoop-Timestamp: <unix seconds>
X-LendLoop-Signature: v1=<hex HMAC-SHA256(secret, canonical)>
```

Receivers enforce a ±300 s window, recompute the signature over the **raw** bytes, compare in
constant time, and reject with a bare `401` **before** parsing JSON.

## Rationale

Covering the path stops a signature captured for one endpoint from being replayed against
another. The timestamp bounds replays to 5 minutes, and idempotency keys (ADR-005) make replays
inside the window harmless. The `v1=` prefix leaves room to rotate the scheme or the key.

## Consequences

- n8n needs env access in nodes (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`) and `crypto` in Code
  nodes. This is set explicitly in `compose.yml`, documented as a trade-off in security.md §5,
  and to be verified on n8n 2.x in block 007.
- The receivers must read the raw body. On n8n that means the Webhook node's raw-body option.
- Key rotation (accepting a current and a previous secret) is noted for production.
