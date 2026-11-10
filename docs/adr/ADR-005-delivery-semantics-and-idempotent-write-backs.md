# ADR-005 — At-least-once delivery, idempotent write-backs, claimed reminders

**Status:** Accepted (revised 2026-11-10 after planning review rounds 1 and 2)
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

Networks fail between Convex and n8n in both directions, so both sides retry. The brief requires
write-backs to be idempotent, "so retries do not create duplicate records or reminders". Four
choices follow:
1. When does n8n acknowledge a loan event, and who owns its retries?
2. How does Convex keep write-backs unique when it has no unique indexes?
3. How do we stop two reminder runs from emailing the same borrower twice?
4. How do we make sure an interrupted or retried reminder run doesn't skip anyone?

## Options Considered

### Acknowledge on receipt (202), then process asynchronously

- **Pros:** a fast reply; the classic webhook-consumer pattern.
- **Cons:** if n8n fails after replying, the event is gone. n8n's own retries are the only safety
  net, and n8n does not resume crashed executions.

### Acknowledge after sending (200 only once the email is out)

- **Pros:** the Convex outbox is the single retry authority; an event is done only when the email
  has actually gone.
- **Cons:** if the reply is lost after a successful send, the retry sends a second email. If n8n
  also retried internally, its retry budget could outlast Convex's timeout and turn every SMTP
  blip into a duplicate. A bare 2xx is also ambiguous: a default reply from n8n could look like
  success when no email was sent.

### Deduplicate inside n8n (for example the Remove Duplicates node across executions)

- **Pros:** it could suppress the rare duplicate.
- **Cons:** it marks an item as seen before the send succeeds, so a failed send could be dropped
  for good. It also adds state to n8n that is hard to see and test.

### Uniqueness in Convex: an index lookup plus insert inside one mutation

Convex mutations are serializable. Two concurrent duplicates conflict, Convex retries the loser,
and the retry finds the row.

### Reminders: fetch-then-write vs. claim at fetch

If the overdue list is simply read, two overlapping runs both see the same loans before either
writes back. Claiming each loan for the day inside the fetch mutation makes overlapping runs
disjoint.

### Reminder runs: one daily run vs. hourly runs with leases

A single daily run loses the day for every loan it had claimed when it is interrupted, and for
every loan when the host is asleep at the scheduled time. A claim that blocks other runs must also
be released when its run dies, without letting a still-running run be overtaken. Running hourly in
the daytime, with a per-day key, keeps "at most once a day" while retrying failed and abandoned
claims within the hour. A lease that is longer than a run can last ties each claim to its run.

## Decision

**Loan events: at-least-once, with Convex as the only retry authority.**
- n8n replies `200` with `{"delivered":"<eventId>"}` only after the email is sent. Nothing else
  counts as a delivery, including any other 2xx.
- The loan-event workflow does **not** retry the send, and its execution timeout (20 s) is shorter
  than the deliver action's fetch abort (30 s). Invariant: n8n always answers or gives up before
  Convex does.

**Write-backs are upserts keyed by a natural idempotency key**, unique inside one mutation:

| Key | Notes |
| --- | --- |
| `notification:<eventId>` | |
| `reminder:<loanId>:<YYYY-MM-DD>` | The claim and the result, one per loan per day |
| `run:<runId>` | `runId` is a UUID minted per execution in the workflow |
| `error:<errorId>` | `errorId` is a UUID minted per execution in the workflow |

UUIDs are used instead of n8n execution IDs, which restart at 1 whenever the n8n data volume is
recreated.

**Reminders are claimed when they are fetched**, by a workflow that runs every hour from 09:00 to
20:00 ([architecture.md §8, §11](../architecture.md#8-n8n--convex-http-endpoints)). The complete
state machine of a day's record:

| From | Event | To |
| --- | --- | --- |
| — | claimed by run R | `sending` (R) |
| `sending` (R), lease live | claim call repeated by R | unchanged, and returned again |
| `sending` (R), lease live | claim by another run | unchanged, and not returned |
| `sending`, lease expired | claimed by run S | `sending` (S); counted as abandoned |
| `failed` | claimed by run S | `sending` (S) |
| `sending` or `failed` | write-back `sent`, from any run | `sent`: final, counted once |
| `sending` (R) | write-back `failed` from R | `failed` |
| `sending` (S) | write-back `failed` from R ≠ S | unchanged (`stale`) |
| `failed` | write-back `failed` | unchanged (`duplicate`) |
| `sent` | anything | unchanged (`duplicate`); never claimed again |

- **Leases outlast runs.** The reminder workflow's execution timeout is 10 minutes, and a lease is
  20. While a run can still write back, its claims stay its own.
- Write-backs carry the `runId`, and must refer to an existing record.

## Rationale

Duplicate *records* are a correctness bug, and the design rules them out. Missed reminders are
ruled out too: a retried claim call gets its own claims back, and an interrupted run's claims are
taken over within the hour. Duplicate *emails* remain possible only in narrow cases:
- an acknowledgement lost after a send;
- a send cancelled by the execution timeout that completes anyway, after n8n answered with an
  error;
- a reminder sent whose write-back never lands: n8n crashes, or the write-back fails after its
  retries;
- a replay of a signed event inside the window.

That is the standard trade-off of webhook systems, and far better than losing notifications. All
four cases are documented.

## Consequences

- Every call n8n makes to Convex is safe to retry: write-backs return `200` with `updated`,
  `duplicate`, `stale` or `created`, and a repeated claim call returns the same claims.
- Health shows abandoned claims, and each run summary counts its loans whose claim had been
  abandoned earlier that day (`reclaimed`).
- `convex-test` cannot prove concurrent uniqueness, so a smoke test sends concurrent write-backs
  to the dev deployment.
- The residual duplicate-email cases are listed in security.md §6 and TD-006.
