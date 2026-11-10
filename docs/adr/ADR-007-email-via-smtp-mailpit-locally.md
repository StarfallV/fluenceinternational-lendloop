# ADR-007 — Email over SMTP, caught locally by Mailpit

**Status:** Accepted
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

The notification channel can be email, Slack, Discord or a logged mock. Reviewers must be able
to see notifications without signing up for anything, and local runs must never email real
people.

## Options Considered

### Option A — A logged mock notification

- **Pros:** zero setup.
- **Cons:** it proves nothing about the delivery path, and it looks unfinished.

### Option B — A Slack or Discord webhook

- **Pros:** visible in a familiar tool.
- **Cons:** it needs a workspace and a webhook URL (itself a secret) per reviewer. It is also a
  poor fit for "notify the relevant user", because a channel post is not personal.

### Option C — Email through a real provider (Resend, SES, SendGrid)

- **Pros:** realistic.
- **Cons:** an account, domain verification, and the risk of emailing real addresses during
  testing.

### Option D — Email over SMTP to Mailpit

Mailpit catches every message and shows it in an inbox UI and a REST API.
- **Pros:** real SMTP delivery and real per-user emails, with no account and nothing leaving the
  machine. Its API makes end-to-end smoke tests possible.
- **Cons:** another container.

## Decision

**Option D.** n8n sends through an SMTP credential pointing at `mailpit:1025`. The Mailpit inbox
is at `http://localhost:8025`.

## Rationale

It exercises exactly the production path (n8n → SMTP → recipient). Production only swaps the
credential for a provider's SMTP settings; the workflows are unchanged.

## Consequences

- The smoke tests in blocks 008 and 009 assert on Mailpit's API (`/api/v1/messages`).
- Emails are plain text (BR-21), which also removes a class of injection issues.
- In production, SPF, DKIM and DMARC, bounces and unsubscribe handling move to the provider
  (block 012 note).
