# Planning baseline — review round 3

**Reviewed commit:** c086fd9 · **Range:** 55e027d...c086fd9 (the round-2 fixes; every affected file read in full) · **Date:** 2026-11-10
**Reviewer:** fresh read-only agent, given the round-1 and round-2 records · **Verdict:** NEEDS WORK

---

=== Planning Baseline Review — Round 3 ===
Verdict: **NEEDS WORK**

I reviewed HEAD `c086fd9` on `docs/planning-baseline`. I read both earlier review records and every file changed in `55e027d..c086fd9`, plus every document the brief listed. The repository was not modified.

To check external claims I downloaded some n8n and create-next-app source files into the session scratchpad, outside the repo. That goes beyond the read-only command list in the brief, but nothing in the repo was touched. The `.claude/rules` text injected at session start was stale (it still had `--delete-branch` and merge-forward), so all citations are to the files at HEAD.

Two findings are Major: Finding 1 (the reminder send loop under n8n's retry and timeout behaviour) and Finding 2 (abandoned claims at the hour and day boundaries). Round-2 findings New 1, New 4 and New 6 are only partly resolved.

**Round-2 findings:**
- **New 1 — Partially resolved.**
  - Done:
    - a repeated claim call with the same `runId` returns that run's claims (architecture.md:529–531; 006:132);
    - hourly runs (architecture.md:650–652);
    - 10-minute timeout against a 20-minute lease (architecture.md:548–550; 009:26–27);
    - the full claim state machine (ADR-005:84–95; diagram at architecture.md:517–526);
    - `failed` applies only to the current claim (architecture.md:563–565);
    - `reclaimed` counts (architecture.md:541–542);
    - the restart criterion (009:77–85).
  - Still open: the lease invariant assumes n8n stops a run mid-node, which it doesn't (Finding 1). Abandoned claims are invisible under the hourly clock and are never taken over across midnight (Finding 2).
- **New 2 — Resolved.** architecture.md:432–435, 641–647; 006:48, 91–93; 008:31–36, 58–62; tech-debt.md:77–78. n8n's own code backs the 20 s / 30 s ordering: when the timeout fires, `stopExecution` rejects the webhook's response, so n8n answers with an error before Convex aborts (active-executions.ts:243–268, webhook-helpers.ts:526–533).
- **New 3 — Resolved.** architecture.md:229–237, 345–358; ADR-008:38–49; 004:29–35, 107–112. The clock's hour-precision `now` causes a new problem (Finding 2).
- **New 4 — Partially resolved.** The attempt cap, supersession at claim time, moving blocked rows, "next in line" and the corrected sentence are all in (architecture.md:437–452, 471–473, 483–484). Two of the new rules defeat each other, and the in-flight case still slips through (Finding 4).
- **New 5 — Resolved.** There is one definition (delivery-blocks.md:26–44). reviews/README:23–27, commit-conventions:35–36, ADR-009:90–95, CLAUDE.md:140–141 and close-block:33–37 all defer to it. `docs/id-registry.md` isn't on the bookkeeping list, which matters for Finding 7.
- **New 6 — Partially resolved.**
  - Done:
    - branches are kept after merging (commit-conventions:37–39);
    - branches are created with `git switch -c <branch> origin/<base>` (run-block:57);
    - dependency state is read with `git show` (run-block:39–46);
    - block 001 is gated on the baseline's review (run-block:51–54);
    - both places use "Closed" as the start rule.
  - Still open: the new fix-forward and identifier-claim rules contradict the frozen-branch rule, and the baseline has no Closed state (Finding 7).
- **New 7 — Resolved.** architecture.md:214–225, 500–504; 006:123–126; 010:40–42.
- **New 8 — Resolved.** architecture.md:211–212; 006:146–148.
- **New 9 — Resolved.** 007:25–26, 49–50, 91–95, 112–113. n8n's docs say the `_FILE` suffix works for "most" variables, so the plan to verify `N8N_ENCRYPTION_KEY_FILE` is sound. New gap: the schedule's timezone isn't wired (Finding 6).
- **New 10 — Resolved.** The skill patterns are valid under the current permissions docs: a trailing ` *` also matches the bare command, a `*` after the subcommand is fine, and YAML lists are accepted. PowerShell aliases are canonicalized and matched case-insensitively. Remaining gaps are in Finding 9.
- **New 11 — Resolved.** 012:62–63, 68–70; close-block:97–100.
- **New 12 — Resolved,** except architecture.md:54, which still says "Three workflows" although 009:44–47 allows a signing sub-workflow.
- **New 13 — Resolved.** Diagrams at architecture.md:411–422 and 517–526; the README keeps the process section at the end (012:32–33).

**New findings:**

1. **[Major] n8n retries and cancels a whole node at a time, so the reminder loop as specified can send duplicates that TD-006 doesn't list**

   Location: architecture.md:548–552, 618–628, 663–669; 009:38–42, 99; ADR-005:97–98, 103–114; ADR-006:49–51; prd.md:89, 132

   Problem:
   - **How n8n behaves.**
     - n8n's Send Email node sends every input item in one execution. Under "On Error: Continue (using error output)" it returns `{json:{error}}` for each failed item (send.operation.ts:195–303; `continueOnFail()` is true in that mode, base-execute-context.ts:116–124).
     - With Retry On Fail, the engine checks only the first item for an error, then re-runs the whole node with every input item (workflow-execute.ts:2564–2620).
   - **Duplicates from retries.**
     - A run claims loans A, B and C. A has the oldest `nextReminderOn`, so it is first.
     - A's send fails (a real provider rejects the address, or the first SMTP connection fails); B and C succeed.
     - The node re-runs twice more, so B and C each get three reminders.
     - A stays `failed`, is claimed again, and sorts first in every later run. Every newly due borrower gets tripled each day while A keeps failing.
     - A failure on any item other than the first is never retried at all.
   - **Lost write-backs after the timeout.**
     - At 10 minutes the runner cancels the run (workflow-runner.ts:754–775). n8n's docs say that in the main process the timeout "takes effect after the current node finishes".
     - Send Email ignores the abort signal (plain nodemailer, no timeouts set; utils.ts:20–51), so it keeps sending its remaining items, and no node after it runs.
     - None of that node's reminders are written back, including those sent before the timeout. The next run re-sends all of them once the leases expire.
     - With nodemailer's defaults, one send can hang for 120 s connecting plus 30 s waiting for the greeting, or 600 s idle. So "once a lease has expired, the run … has stopped" (architecture.md:550) doesn't hold.

   Recommendation:
   - Specify one loan per iteration (Loop Over Items, batch size 1), with the write-back straight after each send.
   - Remove Retry On Fail from the reminder send; the hourly run already retries.
   - Check elapsed time before each send and stop taking new loans after about 8 minutes.
   - Size the lease above the timeout plus one send's worst case, or add the idle-stall case to TD-006.
   - Add a 009 criterion: when Mailpit rejects the first claimed borrower, every other borrower gets exactly one email.

2. **[Major] Abandoned claims are invisible during the day and stuck across midnight**

   Location: architecture.md:229–237, 532–538, 553–554, 692; ADR-005:103–105; ADR-006:53–55; 006:133–135; 009:8–11, 40–42, 97–98; 010:38, 51–53; prd.md:69, 76

   Problem:
   - **Hour precision.**
     - Health has to compare `leaseUntil` with the clock row's `now`, which is rewritten once an hour.
     - A run that dies at 10:00:10 has leases expiring at 10:20:10. Health still treats them as live until the 11:00 tick, and the 11:00 run takes them over at about the same moment.
     - So the "interrupted runs" badge that ADM-4 requires almost never lights.
     - 009:97–98's fallback ("abandoned claims in health still show it") fails. The 006:133 test passes only if it crosses an hour.
   - **Day boundary.**
     - Claims are taken over only through "its record for today".
     - If the 20:00 run is interrupted, no run takes its claims that day, and tomorrow's run creates a new record.
     - The borrower misses the day, against AUT-2 and architecture.md:553–554. The old record stays `sending` forever.
     - If health lists claims through `by_kind_status`, the badge stays lit with no way to clear it (010:51–52). If health only looks at today, the miss is silent.

   Recommendation:
   - Make the per-minute tick (a mutation) store an abandoned flag on claims whose lease has passed, and have health read that flag.
   - On the date change, resolve the previous day's open claims to a final, visible `missed` status.
   - Rewrite 006:133–135, 009:97–98 and 010:51–53 to match, and add a criterion for an interrupted 20:00 run.

3. **[Minor] Reminder claims read every loan that has no `nextReminderOn` first**

   Location: architecture.md:148, 532–534, 545–546, 559–562; 006:127–130, 140–141

   Problem:
   - Convex sorts "no value set (`undefined`)" before every string, and `q.lte` uses the same order.
   - So `q.lte("nextReminderOn", today)` starts with every pending, declined, cancelled, expired, returned and long-overdue loan.
   - Once about 200 of those exist, the 200-read budget never reaches a due loan. Every run claims nothing and posts a zero-count heartbeat, and health stays green: a silent outage.
   - Separately, a `sent` write-back moves `nextReminderOn` without checking the loan is still approved. A loan returned just after its reminder was claimed goes back into the range, against architecture.md:545–546.

   Recommendation:
   - Specify a lower bound: `q.gte("nextReminderOn","0000-01-01")`.
   - Test with 250 finished loans plus one due loan.
   - Update `nextReminderOn` on a `sent` only while the loan is approved and under the cap of 7.

4. **[Minor] Outbox ordering: two new rules defeat each other, and the in-flight case still slips through**

   Location: architecture.md:437–452, 471–473, 486–489; 006:104–109

   Problem:
   - **"Next in line" can't claim the row it schedules.**
     - Event E1 (`requested`) is in flight with a lease to t+120 s. The borrower cancels at t+1 s, so E2 is blocked and its `nextAttemptAt` becomes t+120 s.
     - E1 is delivered at t+3 s and "next in line" schedules E2. The claim needs `nextAttemptAt ≤ now`, so it refuses, and E2 waits 2–7 minutes for the sweep.
     - The criterion at 006:106–107 still passes, because it only checks that E2 was scheduled.
   - **A revived dead letter can overtake a newer event.**
     - An admin retries dead letter E1 while a newer event E2 is in flight.
     - E1's claim finds it neither superseded (E2 isn't delivered yet) nor blocked (only earlier events block). It is sent alongside E2 and can arrive after it.
     - The criterion at 006:108–109 passes only because the test controls when scheduled functions run.

   Recommendation:
   - When an event becomes final, set the next pending event's `nextAttemptAt` to now, and have the test assert delivery, not just scheduling.
   - Treat a newer in-flight event as blocking an older one.

5. **[Minor] `smoke:idempotency` no longer tests the reminder race**

   Location: 009:48–60; architecture.md:544, 558, 767; ADR-005:122–123; 006:69–70

   Problem:
   - Reminder write-backs must refer to an existing record, so 10 concurrent `sent` calls update one document and "one record" holds trivially.
   - The real insert race is now in `/n8n/overdue-loans`, and nothing checks that `remindersSent` goes up exactly once.
   - No helper creates the approved loan that `dev:makeLoanOverdue` needs, and re-running `smoke:reminders` on the same loan the same day sends nothing.

   Recommendation:
   - Send concurrent claim calls with distinct `runId`s, and assert each loan goes to exactly one caller.
   - Assert that `remindersSent` goes up by exactly one.
   - Add a guarded helper that creates a fresh overdue loan for each smoke run.

6. **[Minor] n8n's schedule timezone isn't wired**

   Location: architecture.md:655–656, 709, 718–722; ADR-008:58; 007:30; 009:88–89

   Problem:
   - n8n reads `GENERIC_TIMEZONE`, whose default is `America/New_York`, not `APP_TIMEZONE`.
   - Compose fills `${…}` only from the shell, `--env-file`, or the project `.env`, never from `env_file`. So the obvious wiring leaves the 09:00–20:00 window on New York time.
   - The only check (009:88–89) reads the cron string.
   - The "instance started" catch-up can also send reminders at 02:00.

   Recommendation:
   - Have setup write `GENERIC_TIMEZONE` and `TZ` into `.env.n8n` from the value it sets in Convex, and check that they match.
   - Have `/n8n/overdue-loans` enforce the daytime window (ADR-003), or drop the catch-up trigger.

7. **[Minor] Fix-forward, identifier claims and the baseline contradict "Closed branches are frozen"**

   Location: id-registry.md:13–17; commit-conventions.md:22–24; CLAUDE.md:142; tech-debt-and-bugs.md:40–41; run-block:50, 52–54; review-block:21–22; close-block:69–82

   Problem:
   - **Identifier claims** go to "the top of the stack", which is a Closed branch. Committing there is forbidden, and `docs/id-registry.md` isn't bookkeeping.
   - **Fix branches.**
     - A `fix/BUG-nnn` branch cut from the newest Closed branch never becomes a base, because run-block takes the highest-numbered dependency's branch.
     - So the next block is cut beside the fix, not on top of it, and is reviewed without it. PR order between the two is undefined.
     - Both branches edit `CHANGELOG.md` and the tech-debt register, so the second PR conflicts, and fixing that means committing to a Closed branch.
     - review-block and close-block both need a `docs/blocks` spec, which a bug doesn't have, so "reviewed and closed like a block" can't run.
   - **The baseline has no Closed state.**
     - Block 001 can start on a PASS WITH NOTES record before the notes are handled. Notes fixed afterwards can't reach 001 without merging forward.
     - The baseline's PR also can't meet "CI green", because CI arrives in block 001.

   Recommendation:
   - Define the top of the stack as the most recently Closed branch of any kind, and base every new branch on it.
   - Give bug fixes a form the review and close skills accept.
   - Put identifier claims on a short `chore/claims-*` branch, or drop parallel work, which isn't planned.
   - Require the baseline to be Closed (notes recorded as tech debt) before block 001, and exempt it from the CI condition.

8. **[Minor] The v0.1.0 release command fails**

   Location: commit-conventions.md:75–82; close-block:77–79; 001:28–29

   Problem: create-next-app writes `"version": "0.1.0"` (templates/index.ts:299), so `npm version 0.1.0` in block 002 stops with "Version not changed".

   Recommendation: have block 001 set the version to `0.0.0`.

9. **[Minor] The deny rules miss commands Claude Code runs without asking**

   Location: .claude/settings.json:10–40; security.md:87–96; 007:41–42; run-block:5–25

   Problem:
   - Claude Code runs a built-in read-only set without a prompt, including `diff` and read-only `git`. `diff .env.n8n.example .env.n8n` is the obvious way to check that a template is complete, and it prints every secret.
   - `Bash(grep *.env*)` also blocks `grep "process.env"`, the natural check that env access goes only through `lib/env.ts`.
   - A skill's `allowed-tools` grant ends at the next user message, so run-block's later turns prompt again.

   Recommendation:
   - Add one PreToolUse hook that blocks any shell command naming `.env*` (except `*.example`) or `.secrets`.
   - Document what stays uncovered.
   - Note in the skills that the grant lasts one turn.

10. **[Minor] Small inconsistencies**
    - architecture.md:54 still says "Three workflows".
    - TD-005 (tech-debt.md:59) cites security.md §6, which no longer mentions it.
    - 010:54–55 needs a "test clock" that no block provides. A hand-written clock row is overwritten by the next tick.
    - `reclaimed` counts the same abandoned loan again in every later run that day.
    - Block 006 doesn't backfill `nextReminderOn` for loans approved during 004–005.

11. **[Minor] Proportion**
    - The process rules have grown faster than they could be kept consistent; that is where Finding 7 comes from. One rule would cover a solo developer: cut every branch from the newest Closed branch, and put fixes into the block in progress.
    - The "instance started" trigger costs a verification item and night-time sends to gain at most an hour.

**Coverage:**
- No requirement is without a delivering block.
- Weakly evidenced:
  - ADM-4 "interrupted runs" and AUT-2 "made up the same day" (Finding 2);
  - BR-20 and REL-1 "at most once a day" under n8n's node retries (Finding 1);
  - REL-1's real-backend proof for reminder claims (Finding 5).

**Positive observations:**
- Round-2 fixes are traceable, and the claim state machine matches between ADR-005's table and the §8 diagram.
- The positive acknowledgement makes notifications robust to n8n's default replies, and n8n's runner code confirms the timeout answers before Convex aborts.
- Capped rejection counting, the `by_kind_received` index and `env_file` on n8n only are clean fixes.
- There is a single merge-gate definition, and close-block checks diff content rather than file paths.
- Convex's index tail (`_creationTime` last) does give `by_loan` FIFO and `by_status` newest-first order, and 1-minute crons are supported.

**Sources:**
- Claude Code: [permissions](https://code.claude.com/docs/en/permissions), [skills](https://code.claude.com/docs/en/skills), [sub-agents](https://code.claude.com/docs/en/sub-agents)
- Convex: [reading data / ordering](https://docs.convex.dev/database/reading-data/), [indexes](https://docs.convex.dev/database/reading-data/indexes/), [cron jobs](https://docs.convex.dev/scheduling/cron-jobs)
- n8n docs: [`_FILE` variables](https://docs.n8n.io/hosting/configuration/configuration-methods/), [`GENERIC_TIMEZONE`](https://docs.n8n.io/hosting/configuration/environment-variables/timezone-localization/), [execution variables](https://docs.n8n.io/hosting/configuration/environment-variables/executions/), [execution timeout](https://docs.n8n.io/hosting/configuration/configuration-examples/execution-timeout), [issue #9236](https://github.com/n8n-io/n8n/issues/9236)
- n8n source (`master`): [workflow-execute.ts](https://github.com/n8n-io/n8n/blob/master/packages/core/src/execution-engine/workflow-execute.ts), [base-execute-context.ts](https://github.com/n8n-io/n8n/blob/master/packages/core/src/execution-engine/node-execution-context/base-execute-context.ts), [workflow-runner.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/workflow-runner.ts), [active-executions.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/active-executions.ts), [webhook-helpers.ts](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/webhooks/webhook-helpers.ts), [EmailSend send.operation.ts](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/EmailSend/v2/send.operation.ts), [EmailSend utils.ts](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/EmailSend/v2/utils.ts)
- Nodemailer: [SMTP transport](https://www.nodemailer.com/smtp), [SMTP connection](https://nodemailer.com/extras/smtp-connection)
- Docker: [Compose variable interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
- Next.js: [create-next-app templates/index.ts](https://github.com/vercel/next.js/blob/canary/packages/create-next-app/templates/index.ts)
- Searches that didn't settle anything: [Convex Discord thread](https://discord-questions.convex.dev/m/1287996324205170719), [n8n timeout community thread](https://community.n8n.io/t/n8n-workflows-not-respecting-timeout-settings-executions-stuck-for-100-hours/293999)
