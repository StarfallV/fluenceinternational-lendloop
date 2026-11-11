# ADR-005 — At-least-once delivery, idempotent write-backs, claimed reminders

**Status:** Accepted (revised 2026-11-10 after planning review rounds 1, 2 and 3; amended 2026-11-11)
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

Networks fail between Convex and n8n in both directions, so both sides retry. The brief requires
write-backs to be idempotent, "so retries do not create duplicate records or reminders". Four
choices follow:
1. When does n8n acknowledge a loan event, and who owns its retries?
2. How does Convex keep write-backs unique when it has no unique indexes?
3. How do we stop two reminder runs from emailing the same borrower twice?
4. How do we make sure an interrupted or retried reminder run doesn't skip anyone, or skips them
   visibly?

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
be released when its run dies, without letting a run that is still working be overtaken. Running
hourly in the daytime, with a per-day key, keeps "at most once a day" while retrying failed and
abandoned claims within the hour. A lease that outlasts anything its run can still do ties each
claim to its run.

### Sending reminders: one batch vs. one loan at a time

n8n's Send Email node sends every item it receives in one go. Retry On Fail re-runs the whole node
when the first item fails, and the execution timeout only takes effect after the current node
finishes. A batch can therefore email some borrowers several times, or send many reminders that
are never written back. One loan per iteration, with the write-back straight after the send,
confines a failure to its own loan and bounds what a stopped run can leave behind.

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
20:00 and handles one loan at a time
([architecture.md §8, §11](../architecture.md#8-n8n--convex-http-endpoints)). The complete state
machine of a day's record:

| From | Event | To |
| --- | --- | --- |
| — | claimed by run R | `sending` (R) |
| `sending` (R), lease live | claim call repeated by R | unchanged, and returned again |
| `sending` (R), lease live | claim by another run | unchanged, and not returned |
| `sending`, lease expired | sweep | `abandoned`, or `missed` if its day has ended |
| `abandoned`, or `sending` with an expired lease | claimed by run S the same day | `sending` (S), `reclaimedBy` S |
| `abandoned` | sweep, after its day has ended | `missed`: never claimed again |
| `failed` | claimed by run S the same day | `sending` (S) |
| any state except `sent` | write-back `sent`, from any run | `sent` (final, counted once) |
| `sending` (R) | write-back `failed` from R | `failed` |
| any other state | write-back `failed` | unchanged (`stale` or `duplicate`) |
| `sent` | anything | unchanged (`duplicate`) |

- **Leases outlast runs.** A run stops taking new loans after 8 minutes. One stalled send can take
  about 13 more minutes with nodemailer's default timeouts, and its write-back up to 2. The lease
  is 30 minutes. The workflow's 10-minute execution timeout is only a backstop.
- **No retry on the reminder send.** A failure is written back, and a later run tries again.
  Write-backs do retry, because they are idempotent.
- Write-backs carry the `runId`, and must refer to an existing record.

## Rationale

Duplicate *records* are a correctness bug, and the design rules them out. A reminder can't go
missing silently either:
- a retried claim call gets its own claims back;
- an interrupted run's claims are taken over by a later run that day;
- a claim still open when the day ends becomes a visible `missed`, and the loan is reminded the
  next day.

Duplicate *emails* remain possible only in narrow cases:
- an acknowledgement lost after a send;
- a notification send cancelled by the execution timeout that completes anyway, after n8n
  answered with an error;
- a reminder sent whose write-back never lands: n8n crashes, the write-back fails after its
  retries, or the run stops while a stalled send is still in progress;
- a replay of a signed event inside the window.

That is the standard trade-off of webhook systems, and far better than losing notifications. All
four cases are documented.

## Consequences

- Every call n8n makes to Convex is safe to retry: write-backs return `200` with `updated`,
  `duplicate`, `stale` or `created`, and a repeated claim call returns the same claims.
- Health shows abandoned and missed claims, and each run summary counts the claims that run took
  over (`reclaimed`).
- `convex-test` cannot prove concurrent uniqueness, so a smoke test sends concurrent claim calls
  and write-backs to the dev deployment.
- The residual duplicate-email cases are listed in security.md §6 and TD-006.

## Amendment — 2026-11-11: daily reminders without claims, simpler retries

The developer judged the reminder claims (hourly runs, leases, takeover, `abandoned` and `missed`)
and the outbox's per-loan ordering more machinery than the brief needs (TD-010 and TD-011 were
already queued to patch them further). Decided at the start of block 002:
- **Reminders run once a day.** `/n8n/reminders/due` is read-only: approved loans past their end
  date, under the 7-reminder cap, with no `sent` record for today. Each result is written back by
  key, `reminder:<loanId>:<date>`: `sent` is final and counted once, and `failed` never overwrites
  it. A failed or unsent reminder stays due, so the next run tries again. This reverses the
  "daily vs. hourly" choice above: an interrupted daily run now delays a reminder by a day
  instead of being made up within the hour, which is acceptable for a nudge about an overdue
  tool.
- **The outbox keeps an attempt number instead of leases.** Each scheduled delivery carries the
  attempt it was scheduled for, and only that attempt's outcome is recorded. A 10-minute sweep
  recovers deliveries whose scheduled action was lost. There is no per-loan ordering or
  supersession: each email states the loan's status in full.
- **What stays:** the transactional outbox, at-least-once delivery, the positive acknowledgement,
  n8n answering before Convex gives up, idempotent write-backs, and duplicate records being
  impossible.

New duplicate-email cases: overlapping reminder runs, and an unsent write-back resent the next
run instead of being taken over the same day. Both are in TD-006 and security.md §6.
