# Planning baseline — review round 4

**Reviewed commit:** a468166 · **Range:** 4b675ed...a468166 (the round-3 fixes; every affected file read in full) · **Date:** 2026-11-10
**Reviewer:** fresh read-only agent, given the round-1 to round-3 records · **Verdict:** PASS WITH NOTES

---

=== Planning Baseline Review — Round 4 ===
Verdict: **PASS WITH NOTES**

I reviewed HEAD `a468166` on `docs/planning-baseline`. I read:
- the three earlier records, author responses included;
- every file changed in `4b675ed..a468166`, in full;
- every document the brief lists.

Paths below are relative to `D:\Work\Personal\repos\fluenceinternational-lendloop`, and all citations are to HEAD. The `CLAUDE.md` injected at session start predates round 3.

Nothing in the repository was modified. Beyond `git`, `cat` and `grep`, I used:
- `awk` and `wc`, for line numbers;
- two `echo` probes naming `.env.n8n`, one through Bash and one through PowerShell. The hook blocked both.
- node scripts in the session scratchpad (`C:\Users\user\AppData\Local\Temp\claude\65b1df8e07794386\3beb3d09-5e8c-483d-844f-43d1f7053199\scratchpad\hooktest\`):
  - `cases.mjs`, which imports the hook's `secretNamesIn` and runs 28 commands through it;
  - a copy of the hook, `real\`, reached through a junction, `linked\`.

All 11 round-3 findings are resolved. Every new finding is Minor. None of them justifies another round (see New 9).

**Round-3 findings:**
- **1: Resolved.**
  - One loan per iteration, with the write-back straight after the send (architecture.md:691–699; 009:38–43).
  - No Retry On Fail on the send (architecture.md:694–695; ADR-005:112–113; ADR-006:50–53).
  - An 8-minute budget (architecture.md:692–693; 009:39).
  - A 30-minute lease (architecture.md:574–581; ADR-005:109–111).
  - The stalled-send case is in TD-006 (tech-debt.md:79–81).
  - The containment criterion (009:72–75).
  - n8n's docs confirm a soft timeout in the main process.
  - Remaining: the 13-minute bound covers one stall only (New 7), and the containment check can't be set up with the specified helper (New 6).
- **2: Resolved.**
  - The 5-minute sweep marks `abandoned` and `missed` (architecture.md:565–572; 006:53–54).
  - Health reads those states, not the hour-precision clock (ADR-006:55–58).
  - Interrupted-20:00 criterion (006:139–140); 009:100–102 and 010:55–59 were rewritten.
  - Remaining: `failed` claims never become `missed` (New 1), and claims of returned loans can't clear (New 2).
- **3: Resolved.**
  - `q.gt("nextReminderOn","").lte(...)` (architecture.md:546–548) is valid range grammar. Convex orders "no value set (`undefined`)" before strings, so unset loans are excluded.
  - The 250-loan test (006:134).
  - `nextReminderOn` moves only while the loan is approved (architecture.md:586–589; 006:147).
  - A backfill nit is in New 8.
- **4: Resolved.**
  - Next in line sets `nextAttemptAt` to now, and the test asserts delivery (architecture.md:477–480; 006:51–52, 109–110).
  - Any in-flight event blocks, older or newer (architecture.md:445–458; 006:111–112).
  - I traced revived-dead-letter, crash and retryable-outcome interleavings and found no deadlock, livelock, starvation or reordering. "In flight" means pending with a live lease (architecture.md:427), so a just-finalized row never blocks its successor.
- **5: Resolved.**
  - Concurrent claims with distinct `runId`s, and the `remindersSent` assertion (009:57–62).
  - `dev:createOverdueLoan` (006:70–72; 009:48, 56).
  - New side effect: claims left open (New 2).
- **6: Resolved.**
  - Setup writes `GENERIC_TIMEZONE` and `TZ` (architecture.md:679–680, 745, 764–766; 007:30–31, 46–47).
  - A criterion (007:99–100) and a §16 item (architecture.md:833).
  - The catch-up trigger is dropped (architecture.md:677–684; 009:28–31).
  - n8n's docs confirm the `America/New_York` default.
  - "compose's `env_file` doesn't interpolate" is unverified, but harmless, because literal values are written.
- **7: Resolved.**
  - One base rule (delivery-blocks.md:16–18; commit-conventions.md:11–15; ADR-009:71–74; run-block:35–39; review-block:25–28; resume-block:43–46).
  - Fixes go into the block in progress, and a fix becomes its own block after 012 (tech-debt-and-bugs.md:36–44).
  - Identifier claims only on `main`, later (id-registry.md:9–18; ADR-009:106–107; CLAUDE.md:140–141).
  - The baseline has a row and must be Closed before 001 (blocks/README.md:18–23; 001:12–13; run-block:40–47).
  - The CI exemption (delivery-blocks.md:37; ADR-009:102–103; close-block:38–40).
  - Nits are in New 8.
- **8: Resolved** (001:48–49, 66).
- **9: Resolved.**
  - The hook blocked my Bash and PowerShell probes from a subagent in bypass mode. That matches the docs: "PreToolUse hooks run before every tool call, whether or not it needs permission", and they "also run inside subagents".
  - The grep denies are removed and write denies added (settings.json:10–14).
  - Coverage is documented (security.md:88–103), and the one-turn grant is noted (session-norms.md:51–54).
  - New gaps are in New 4 and New 5.
- **10: Resolved.**
  - "Three workflows" is accurate again (architecture.md:55; 009:45–46).
  - The TD-005 citation is fixed (tech-debt.md:59).
  - `dev:backdateLastRun` replaces the test clock (010:44–46), but it doesn't work with hourly runs (New 6).
  - `reclaimedBy` (architecture.md:191, 553–559; 006:136–138).
  - The backfill (006:42–44, 89–90).
- **11: Resolved.** One base rule, and the catch-up trigger is gone.

**New findings:**

1. **[Minor] A reminder that fails all day is never shown as missed and never raises the badge, contrary to AUT-2**

   Location: prd.md:77, 70; architecture.md:540, 565–568, 726, 728; ADR-006:36–40; 006:141–142; 010:41–43; 009:76–78

   Problem:
   - AUT-2 says "A reminder that still hasn't gone out when the day ends is shown to admins as missed". The design only turns *open* claims into `missed`. architecture.md:540 keeps a `failed` record `failed` after its day, and `failed` isn't a badge condition anywhere.
   - **Scenario:** the provider rejects one borrower's address.
     - Every hourly run writes `failed` for that loan, and it stays `failed` at midnight.
     - The loan never reaches 7 sent, so this repeats every day until the tool is returned.
     - Health shows no missed reminder, and the badge stays dark. The only traces are the failed count in the last run summary and "Reminder failed" in the loan's activity.
   - The same happens to every borrower during an all-day SMTP outage on a day with no loan events.
     - Each run completes (009:76–78), so the heartbeat stays green.
     - Per-item errors go to the error output, so the error workflow never fires.
   - Due loans that no run claims before 20:00 also end the day with no record at all. That takes more than 50 due loans, or more than the 200-read window.

   Recommendation: have the end-of-day sweep move `failed` to `missed` too, keeping `errorCode` and `errorMessage`. The 24 h badge then covers it, and AUT-2 holds. Add a 006 test: a claim `failed` at 20:00 becomes `missed` after midnight and is listed in health. Otherwise, narrow AUT-2 and ADM-4 to "claims still open", and add "reminders failed today" to the badge.

2. **[Minor] Open claims of a loan that leaves `approved` can't be cleared, and `smoke:idempotency` leaves claims open**

   Location: architecture.md:150, 549, 565–572; ADR-005:100–102; 010:38–39, 55–57; 009:57–62

   Problem:
   - The sweep turns expired claims into `abandoned`, then `missed`, without looking at the loan. A takeover needs the loan to be approved and in the `nextReminderOn` range.
   - **Scenario:**
     - The 10:00 run is interrupted after claiming loan L.
     - At 10:20 the lender marks L returned, which clears `nextReminderOn`.
     - At 10:30 the claim becomes `abandoned`. No run can take it over, so the badge stays lit until midnight.
     - It then shows as `missed`, with the note "the borrower is reminded the next day" (010:38–39), for another 24 h.
     - That is about 38 h of an alert that nothing can clear, for a loan that needs nothing. 010:55–57 promises that a claim taken over clears it.
   - `smoke:idempotency` claims 5 fresh loans under 10 fake `runId`s, plus any other loan due on the dev deployment. It writes back `sent` for one of them only.
     - The rest become `abandoned` 30 minutes later and light the badge.
     - A scheduled run then emails them for real.
     - Tidying up by returning the loans would hit the stuck case above.

   Recommendation:
   - Have health count `abandoned` and `missed` records only while their loan is still approved. The alternative is to resolve open reminder records inside `transition()`.
   - Have `smoke:idempotency` write back `failed` (code `SMOKE`) for every claim it doesn't use.

3. **[Minor] The §8 claim diagram no longer matches the text and the ADR-005 table**

   Location: architecture.md:525–537 vs 539–540, 553–554; ADR-005:101, 104; 006:148–149

   Problem:
   - The text and ADR-005 accept a `sent` write-back "in any state except `sent`", and 006 tests it on `abandoned` and `missed` records. The diagram has only `sending → sent`. It has no `failed`, `abandoned` or `missed` → `sent`, and it draws `missed` as terminal.
   - The direct takeover of an expired `sending` claim that the sweep hasn't marked yet is also gone.
   - The round-2 diagram had both, and round 3 praised that agreement.
   - An implementation built from the diagram rejects a late `sent`, so the reminder isn't counted and the loan is emailed again.

   Recommendation: add the three `→ sent` edges and `sending → sending: lease expired, taken over`.

4. **[Minor] The secret guard can be switched off without anyone noticing**

   Location: .claude/settings.json:47, 51; .claude/hooks/guard-secrets.mjs:52–53; security.md:92–98; 001:50–51, 66

   Problem:
   - **PowerShell hosts.** Claude Code runs a shell-form hook in Git Bash on Windows, or in PowerShell when Git Bash isn't installed.
     - The hooks docs say: "Don't write the bare `$CLAUDE_PROJECT_DIR` spelling in a PowerShell hook… resolves it to `$null`… Claude Code doesn't rewrite that form."
     - The command then becomes `node "/.claude/hooks/guard-secrets.mjs"`. It fails to load and exits 1, which is a non-blocking error.
     - Every command then runs, with only a transcript notice.
   - **Linked checkouts.** `main()` runs only when `resolve(argv[1])` equals the path in `import.meta.url`, which Node resolves to the real path.
     - Through a junction or symlink the two differ, so the hook exits 0 with no output and no stderr: a silent allow.
     - I reproduced it. The real path printed the deny JSON; the junction path printed nothing and exited 0.
   - **Monitor.** The Monitor tool runs shell commands under Bash's permission rules (tools reference), but the matcher `Bash|PowerShell` is an exact list. `diff .env.n8n.example .env.n8n` run through Monitor is caught by neither the hook nor a static deny.
   - Block 001's test covers only `secretNamesIn`, so none of these would be caught.

   Recommendation (in block 001, which already adds the hook test):
   - Use exec form: `"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard-secrets.mjs"]`.
   - Compare real paths in the entry guard, or move `secretNamesIn` into an imported module.
   - Add `Monitor` to the matcher.
   - Add an entry-point test that spawns the hook with JSON on stdin and asserts the deny.

5. **[Minor] Even when it runs, the guard misses this project's likeliest leaks, and security.md §5 doesn't name them**

   Location: security.md:88–103; .claude/settings.json:5–14; guard-secrets.mjs:12; 007:92–93

   Problem: the commands below pass the hook, and each one prints secrets.
   - `docker compose config` resolves service env files unless `--no-env-resolution` is passed, so it prints `.env.n8n`.
   - `docker compose exec n8n printenv` and `docker inspect` show the n8n container's environment, which holds both signing secrets.
   - `grep -rn SIGNING_SECRET .` and `Get-ChildItem -Recurse | Select-String` walk into `.env*` and `.secrets/`.
   - `cat .ENV` reads `.env` on NTFS. The regex has no `i` flag, and only PowerShell rules are documented as case-insensitive.

   The first two are the natural commands for block 007's own criterion, a names-only check of container env (007:92–93), and the spec doesn't say how to run it.

   The `Read(./…)` and `Edit(./…)` denies are relative to the current directory (permissions docs). A `cd` in the main session moves that directory, after which the rules no longer cover the root files.

   Recommendation:
   - Extend the hook (it can allow `--no-env-resolution`), or add deny rules for these shapes.
   - Add the `i` flag to the regex.
   - Anchor the file rules with `/` (for example `Read(/.env)`).
   - Name these commands in security.md §5.
   - Give block 007 a names-only helper script.

6. **[Minor] Two new manual checks can't be run as written**

   Location: 010:44–46, 60–62; architecture.md:210, 214; 006:70–72; 009:72–75, 83–90

   Problem:
   - **`dev:backdateLastRun`** moves only the last summary's `receivedAt`. Health takes the newest `receivedAt`, so the previous hourly summary becomes "last", and the stale flag never appears on a correct implementation.
   - **`dev:createOverdueLoan`** always pairs the same two demo users.
     - Mailpit's option is a regex allowlist of recipients, so with one shared borrower it rejects all three loans or none. The containment check can't isolate the first loan.
     - The old `dev:makeLoanOverdue` is gone, so there is no other way to get overdue loans with distinct borrowers.
   - **Interrupted run.** A send to a paused Mailpit fails at nodemailer's 30 s greeting timeout and is written back `failed`. Unless n8n is restarted within about 30 s, health shows 2 abandoned claims and `reclaimed` = 2, not 3.

   Recommendation:
   - Backdate every `overdue-reminders` summary from the last 27 h.
   - Add an optional demo-borrower argument to `dev:createOverdueLoan`.
   - Write "restart within 20 s" in 009:83–84.

7. **[Minor] TD-006's "only" list misses the classic SMTP duplicate, and the lease bound holds for one stall only**

   Location: tech-debt.md:74–86; ADR-005:125–134; security.md:112; architecture.md:574–581, 645–653

   Problem:
   - **Accepted, then an error.** The server can accept DATA and the connection can drop before its 250 reply (RFC 1047). nodemailer then reports an error.
     - A reminder is written back `failed`, and the next run re-sends it.
     - A notification fails its execution, and Convex retries it.
     - That is a duplicate outside the four cases ADR-005:125 calls the only ones.
   - **One stall, not every stall.** `socketTimeout` is an idle timer (nodemailer docs), so a server that trickles can hold a send past "about 13 minutes".
     - With one 10-minute idle stall, the 10-minute "backstop" is how the run normally ends: the stalled loan gets no write-back and no summary is posted.
     - If the server accepts each message before stalling, the first loan is re-sent every hour while the fault lasts.

   Recommendation: add this case to TD-006, ADR-005 and security.md §6. Phrase the lease bound as "one stall", and note the hourly repeat.

8. **[Minor] Small items**
   - **Heartbeat threshold** (architecture.md:729; ADR-006:47; 006:156–157).
     - 26 h was sized for one daily run. With runs every hour from 09:00 to 20:00, the longest healthy gap is 13 h.
     - An outage that starts at 10:30 shows as stale only around midday the next day, after that morning's runs were lost. Those losses leave no claims, so nothing shows as missed either.
     - About 15 h would flag it overnight.
   - **Backfill** (006:42–44, 89–90).
     - It should set `nextReminderOn` only for approved loans with fewer than 7 reminders. Block 005 seeds loans with 7 sent, and a backfilled one would sit in the claim range forever, using up reads.
     - Running it is neither a criterion nor a Manual Step.
   - **Fix blocks.** resume-block searches `*feature/$ARGUMENTS-*` (resume-block:33), which misses `fix/BUG-nnn-*` branches (tech-debt-and-bugs.md:39–40). No skill writes a fix-block spec, and create-blocks always writes `feature/` Branch lines (create-blocks:37).
   - **Baseline PR.** close-block Step 4 says "Once CI is green" (close-block:94), with no baseline exemption there. Required status checks on `main` would also block that PR.
   - **Bug reports.** A bug report's status line (tech-debt-and-bugs.md:43–44) and new files in `docs/bugs/` aren't bookkeeping (delivery-blocks.md:39–47). Filing or closing a bug after a review therefore forces another round.

9. **[Minor] Proportion**
   - Another round isn't justified. Fixing the baseline docs now would itself need another round under the merge gate. Record New 1–8 as tech debt aimed at:
     - block 001: New 4 and 5;
     - block 006: New 1–3, and the backfill;
     - block 009: New 6 and 7;
     - block 010: New 6.

     Then close the baseline.
   - The reminder subsystem is at the limit for a take-home:
     - five claim states;
     - a sweep, leases and a time budget;
     - `reclaimedBy` and `reclaimed`;
     - three smoke scripts;
     - four manual checks that each wait 30–60 minutes.

     Add nothing more. `reclaimed`/`reclaimedBy` could go, because abandoned claims in health already show an interrupted run.
   - Nothing is under-specified enough to block implementation once New 6's helpers are fixed.

**Coverage:** AUT-2's sentence "shown to admins as missed" is only partly covered. Open claims become `missed` (006:139–140), but failed and never-claimed reminders don't (New 1). Every other requirement has a delivering block and a testable criterion.

**Positive observations:**
- **No stale references.** None remain to the catch-up trigger, the 20-minute lease, the abandoned counter, `dev:makeLoanOverdue`, sub-workflow signing, fix branches cut from Closed branches, or top-of-stack claims.
- **Reminder sending.** Sending one loan at a time, with an immediate write-back and no send retry, is the right answer to n8n's node-level retries and soft timeout. nodemailer's `connectionTimeout` already includes the greeting, so the bound for a single stall is conservative.
- **Outbox.** The claim rules now close both round-3 gaps without creating new ordering hazards.
- **Process.** One base rule, stated the same way in ADR-009, the rules, CLAUDE.md and all four skills.
- **Hook output.** The hook's deny JSON matches the documented format, and it works for subagents and auto-approved commands.

**Sources:**
- Claude Code: [hooks](https://code.claude.com/docs/en/hooks), [permissions](https://code.claude.com/docs/en/permissions), [tools reference](https://code.claude.com/docs/en/tools-reference)
- [Nodemailer SMTP](https://nodemailer.com/smtp); [n8n EmailSend utils.ts](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/EmailSend/v2/utils.ts) (no timeouts are set)
- n8n: [execution timeout](https://docs.n8n.io/hosting/configuration/configuration-examples/execution-timeout/), [timezone](https://docs.n8n.io/hosting/configuration/environment-variables/timezone-localization/)
- Convex: [reading data and ordering](https://docs.convex.dev/database/reading-data/), [indexes](https://docs.convex.dev/database/reading-data/indexes/)
- [Mailpit runtime options](https://mailpit.axllent.org/docs/configuration/runtime-options/)
- Docker: [compose config](https://docs.docker.com/reference/cli/docker/compose/config/), [set environment variables](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/)
- [RFC 1047](https://www.rfc-editor.org/rfc/rfc1047.txt)
- Searches that didn't settle whether `env_file` interpolates: [variable interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/), [compose config (legacy page)](https://docs.docker.com/compose/reference/config/)

---

## Author response (2026-11-10)

The verdict is PASS WITH NOTES. Following the reviewer's advice (New 9), every note is recorded
as tech debt aimed at the block that will implement it, not fixed in another planning round.
Recording them is bookkeeping, so the planning baseline is now **Closed**.

| Finding | Outcome | Resolved in |
| --- | --- | --- |
| New 1: a reminder failing all day is never "missed" | Recorded as TD-010 | Block 006 |
| New 2: claims of loans that leave `approved`; open claims left by `smoke:idempotency` | Recorded as TD-010 (health) and TD-011 (smoke cleanup) | Blocks 006, 009 |
| New 3: the §8 diagram lags the text | Recorded as TD-010 | Block 006 |
| New 4: the secret guard can be switched off | Recorded as TD-009, High. No secret files exist until block 002, so fixing it in block 001 leaves no window. | Block 001 |
| New 5: commands that print secrets without naming a file | Recorded as TD-009 | Block 001 |
| New 6: manual checks that can't run as written | Recorded as TD-011 | Blocks 009, 010 |
| New 7: the RFC 1047 duplicate; the lease bound covers one stall | Recorded as TD-011 | Block 009 |
| New 8: heartbeat threshold, backfill | Recorded as TD-010 | Block 006 |
| New 8: fix blocks, the baseline PR, bug reports | Recorded as TD-012 | Block 001 |
| New 9: proportion | Accepted: nothing more is added to the reminder design, and TD-010 offers dropping `reclaimed` | Block 006 |
