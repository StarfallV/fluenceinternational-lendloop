# ADR-004 — HMAC request signing in both directions

**Status:** Accepted (revised 2026-11-10 after planning review round 1)
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

The brief requires signing webhook payloads ("e.g. HMAC with a shared secret") and verifying
them on the receiving side, and securing the integration in both directions. Both receivers are
public HTTP endpoints: the n8n webhooks through the tunnel, and the Convex HTTP actions.

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

**Option C, with one secret per direction**:
- `CONVEX_TO_N8N_SIGNING_SECRET` signs every call **to** n8n: loan events, and the scripted
  `run-reminders` trigger.
- `N8N_TO_CONVEX_SIGNING_SECRET` signs every call from n8n to Convex.

```
canonical = timestamp + "\n" + METHOD + "\n" + path + "\n" + rawBody
key       = UTF-8 bytes of the secret string (stored as base64url text; not decoded)
X-LendLoop-Timestamp: <unix seconds>
X-LendLoop-Signature: v1=<hex HMAC-SHA256(key, canonical)>
```

**Receivers:**
- enforce a ±300 s window;
- recompute the signature over the **raw** bytes;
- compare in constant time;
- answer a failure with a bare `401`.

Convex verifies before parsing JSON. n8n's Webhook node has already parsed the body by the time a
Code node runs, so n8n verifies before **using** any field.

**Senders** transmit exactly the bytes they signed. In n8n, that means building the JSON string
once, signing it, and sending it as a raw body.

**Shared test vector:** `convex/lib/hmac.test.ts` holds a fixed vector (secret, timestamp, method,
path, body, expected hex), and the n8n Code node must reproduce it.

## Rationale

- **Newline separators:** no field (timestamp, method, path) can contain a newline, so the
  canonical string can't be ambiguous, even if a path ever contains a dot.
- **The path:** covering it stops a signature captured for one endpoint from being replayed
  against another.
- **The timestamp:** it bounds replays to 5 minutes.
- **The `v1=` prefix:** it leaves room to rotate the scheme or the key.

## Consequences

- n8n needs env access in nodes (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`) and `crypto` in Code
  nodes. Both are set explicitly in `compose.yml` and listed as TD-003. The n8n encryption key is
  passed as a file, so `$env` can't read it.
- n8n 2.x removed in-memory binary mode. How a Code node reads the raw webhook body is checked in
  block 008.
- **Replays are absorbed differently on each side.** Calls to Convex write idempotently, so a
  replay inside the window does nothing. A replay of a loan event to n8n inside the window would
  send the email again. This residual risk is documented in security.md §6 and TD-006.
- Key rotation (accepting a current and a previous secret) is TD-002.
