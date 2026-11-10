# Planning baseline — review round 2

**Reviewed commit:** 55e027d · **Range:** 8e3aba6...55e027d (the round-1 fixes; every affected file read in full) · **Date:** 2026-11-10
**Reviewer:** fresh read-only agent, given the round-1 record · **Verdict:** NEEDS WORK

---

=== Planning Baseline Review — Round 2 ===
Verdict: NEEDS WORK

I reviewed HEAD 55e027d on `docs/planning-baseline`. I read the full diff from 8e3aba6 and every requested file in full; nothing was modified. I checked the Claude Code questions against the current docs:
- `context: fork` with `agent: <custom agent>` is valid in skill frontmatter. The subagent does not see the conversation history.
- `tools:` in an agent file is an allowlist.
- `allowed-tools` in a skill only pre-approves tools, for the turn that invokes the skill. It does not restrict anything.

n8n's docs do not confirm that `N8N_ENCRYPTION_KEY_FILE` is supported.

The verdict rests on one Major (New 1). Everything else is Minor.

**Round-1 items:**

Coverage gaps:
- **PUB-2:** Resolved — prd.md:37, 170; 004:44, 89–90; 003:30–32.
- **LST-5:** Resolved, by narrowing the requirement: My listings now shows availability and the pending count, and the loans live in Incoming. prd.md:48; 004:46, 91–93.
- **BRW-5/6:** Resolved — 004:94–95, 98–99, 104–105.
- **ADM-2:** Resolved — 005:25–26, 48–52.
- **LST-4:** Resolved — 004:45, 91–93.
- **Error workflow after a fresh import:** Resolved — 008:65–69; 007:48, 54, 62–63, 90–91.
- **Duplicate reminders:** Resolved for overlapping runs (architecture.md:459–471; 006:102–110; 009:45–48). The claim design opens the opposite failure, missed reminders (New 1).
- **DEL-4:** Resolved — prd.md:160; 012:33–34, 61–62.
- **§9 omissions:** Resolved — prd.md:182, 185.

Findings 1–20:
- **1:** Resolved — architecture.md:396–399, 543; ADR-005:51–54; ADR-006:46–47; 008:33, 56–64. The invariant depends on §16:679, and there is no fallback (New 2).
- **2:** Resolved — architecture.md:401–432; 006:40–48, 77–92. Smaller gaps remain (New 4).
- **3:** Resolved:
  - (a) publication: 007:48; architecture.md:535–537;
  - (b) ID linkage: 007:54, 62–63;
  - (c) manual runs: architecture.md:549–550; 008:47–48;
  - (d) trigger failures: architecture.md:204, 457;
  - (e) record, then always alert: architecture.md:569–572; 008:68–69;
  - §16:675.
- **4:** Resolved — architecture.md:185, 203, 298, 473–474, 568, 586–587; 006:31, 69–71; 010:42–43; 007:30.
- **5:** Resolved — architecture.md:197–198, 204; ADR-005:62–66; 006:111–113. The only index cannot list errors under unknown slugs (New 8).
- **6:** Resolved — 004:89–90; architecture.md:331–334; 003:57–58, 66–67.
- **7:** Partially resolved:
  - The gate is restated consistently in ADR-009:77–88, delivery-blocks.md:25–31, commit-conventions.md:28–32 and close-block:19–30. docs/reviews/README.md:23–25 still states a different gate (New 5).
  - Fixed: the log commit (commit-conventions.md:58–59; run-block:82–86), verdict storage (run-block:89–98), and the "Review items addressed" section (delivery-blocks.md:74–76).
  - Read-only is now a `tools:` allowlist (block-reviewer.md:4). Bash can still write, and the subagent inherits bypass mode, so read-only is enforced by instruction only. That is acceptable.
  - Step order is only partly fixed. Pre-flight still reads the spec and dependency status before switching branches (run-block:21–27 vs :34), `git switch origin/main` fails, and nothing gates block 001 on the baseline's verdict (New 6).
- **8:** Resolved — architecture.md:459–471; ADR-005:68–73; 006:107–110; 009:45–48.
- **9:** Partially resolved:
  - Done: the clock (architecture.md:221–232, 336–343), the empty-list branch (architecture.md:557; 009:34, 60), and "no run yet" (006:114–115; 010:34).
  - The catch-up only fires when n8n restarts. A host asleep at 09:00 still loses that day.
  - The clock lags midnight (New 3).
- **10:** Resolved — architecture.md:598–615; security.md:74–85; 007:25–29, 41–45, 77–78. Remaining gaps are in New 9.
- **11:** Resolved, with the rules now called best-effort — settings.json:15–21; security.md:45, 86; security-standards.md:50–52. Remaining gaps are in New 10.
- **12:** Resolved — ADR-002:53–55; 002:45–47, 76–77; coding-standards.md:46–52; architecture.md:202, 216–217, 583; 007:71–72; 006:93–95.
- **13:** Resolved — architecture.md:481–507; ADR-004:50–70, 83–90; §16:678.
- **14:** Resolved — prd.md:100, 123; architecture.md:114; 002:41–44, 65–69, 89–91, 98–99.
- **15:** Resolved — architecture.md:168–169, 405–406, 434–438; 006:84–88, 93–95. Smaller gaps are in New 4.
- **16:** Resolved — 008:51–53; 009:54–56; architecture.md:641–642; 007:35–36, 64–65, 83–85, 88–89; 008:73–75; 009:72.
- **17:** Resolved — 009:49–51, 59; architecture.md:510–514, 652; 003:68–69, 82–83.
- **18:** Resolved — architecture.md:423, 641–646; ADR-001:32–46, 58–68; 007:37–38, 50–51, 86–87.
- **19:** Resolved within the developer's constraints — ADR-009:82–83; commit-conventions.md:80–82.
- **20:** Resolved — prd.md:68, 132, 144; 003:49–54; 005:27, 53; TD-007, TD-008.

Consistency issues:
- **Dependencies:** Resolved. Each spec lists only direct dependents (002:14, 004:13, 006:14, 007:14), matching blocks/README.md:18–29.
- **Smoke scripts in CLAUDE.md:** Resolved — CLAUDE.md:127–129.
- **`config.ts`:** Resolved — architecture.md:87; CLAUDE.md:94; 004:33.
- **`/n8n/runs` fields:** Resolved — architecture.md:198, 201–202, 456.
- **§8 status order:** Resolved — 413, then 401, then 400, and other 4xx are permanent (architecture.md:443–447, 424).
- **Payload roles:** Resolved — `loanRole`, architecture.md:380, 388–389.
- **BR-21 fields:** Resolved — prd.md:133; architecture.md:383, 454.
- **`.gitignore`:** Resolved — .gitignore:15–25.
- **TypeScript wording:** Resolved — session-norms.md:19–21.
- **BR-5 boundaries:** Resolved — 004:61–67. There is a wording nit (New 12).
- **Error codes:** Resolved — architecture.md:262–267; 004:79–81; 010:40–41.
- **003 manual step:** Resolved — 003:85–86.
- **Release commit:** Resolved — commit-conventions.md:73–77.
- **Known Constraints sections:** Resolved — 005:57, 010:52, 011:42, 012:66.

**New findings:**

1. [Major] An interrupted or retried reminder run can silently skip borrowers for the day

   Location: architecture.md:459–465, 471, 551–552, 574–584; ADR-005:68–73, 88–89; 006:105; 009:29, 33, 36, 70–71

   Problem:
   - **The claim isn't safe to retry.** A loan is eligible only if it has no live `sending` claim, regardless of which run holds it, and 006:105 makes this a criterion. 009:33 puts retries on the call that makes the claims. Suppose Convex commits the claims but n8n loses the reply. The retry, with the same `runId`, gets an empty list, takes the empty branch, and posts a zero-count heartbeat. Every claimed borrower misses the day, and health shows green. ADR-005:88–89 says n8n's retries are "always safe".
   - **The lease defeats the catch-up.** Suppose n8n dies during the 09:00 run. Docker restarts it within seconds, and "instance started" runs inside the 15-minute lease. It skips every loan the dead run claimed, then posts a fresh heartbeat, and nothing else runs that day. The catch-up was added for exactly this case, and 009:70–71 checks only that nobody gets two reminders.
   - **The lease isn't tied to run length.** The overdue-reminders workflow has no execution timeout. Fifty loans, each with an SMTP hang and four send attempts (Retry On Fail ×3), can far outlast a fixed 15-minute lease. A scripted run then reclaims the same loans and sends again.
   - **The state model is incomplete.** Claims also move `failed → sending` and an expired `sending → sending`, neither of which ADR-005's "moves forward only" list includes. Write-backs don't check `runId`. A retried `failed` from an old run can therefore flip a newer run's live claim to `failed`, making it claimable while that run is still sending.
   - **Abandoned claims are invisible.** An expired `sending` row is never resolved or shown; §12 has no row for it.

   Recommendation:
   - A repeated claim call with the same `runId` returns that run's live claims. Change 006:105 to "a *different* runId".
   - Give overdue-reminders an execution timeout, set the lease longer than it, and state that invariant next to §7.3's.
   - Run the schedule hourly within a daytime window. The per-day key still allows only one reminder a day, and abandoned claims are retried within the hour. This also closes the asleep-at-09:00 gap and the limit of 50 loans per call (the same oldest 50 are claimed every day).
   - Show expired claims as "abandoned" in health and in the run counts.
   - Write the complete reminder state machine into ADR-005. Write-backs carry `runId`, and a `failed` write-back applies only to the current claim.
   - Add criteria:
     - kill n8n mid-run and restart it: every eligible borrower gets exactly one reminder that day;
     - a repeated claim with the same `runId` returns the same loans.

2. [Minor] "2xx means sent" depends on unverified n8n behaviour, with no fallback

   Location: architecture.md:396–399, 421, 539–545, 679; 008:27–34, 62–64, 77–81; tech-debt.md:73–78

   Problem:
   - Convex marks an event `delivered` on any 2xx. §16 leaves open what n8n 2.47 returns in two cases:
     - the 20 s timeout cancels an execution that answers through a Respond node;
     - a run never reaches the Respond node, for example a `type` with no Switch branch.

     If either returns 2xx, the email is lost with no record anywhere, which REL-2 forbids.
   - A cancelled Send Email can still complete after n8n has answered with an error, for example once Mailpit is unpaused. That duplicate isn't among TD-006's cases.
   - "Convex's `fetch` gives up after 30 s" reads as platform behaviour. It is an abort the action has to set itself (006:43).

   Recommendation:
   - Require a positive acknowledgement: the Respond node returns `{"delivered":"<eventId>"}`, and any other 2xx body is retryable (`BAD_ACK`).
   - Give the Switch a fallback branch that fails the execution, with a criterion for it.
   - Add the late-completion case to TD-006.
   - Write "aborts after 30 s" in §7.3.

3. [Minor] The hourly clock lags midnight, so queries and mutations disagree

   Location: architecture.md:336–343; ADR-008:35–36, 38–42, 53–54; 004:29, 101–103

   Problem:
   - The clock achieves what it claims for invalidation. Every query that reads it re-runs on each tick, so the date change and the 26 h stale flag show up without a reload, within an hour.
   - Mutations, however, compute "today" themselves. For up to an hour after local midnight:
     - `config:get` still offers yesterday as a start date;
     - Incoming still offers Approve on a request whose start date has passed.

     The server rejects both with VALIDATION. That contradicts ADR-008:35–36, which says client and server "cannot disagree".
   - Expiry also runs hourly, so those requests stay pending.
   - Before the first tick, queries fall back to `Date.now()`.

   Recommendation:
   - Tick every minute, but write the row only when the date or hour changes. Invalidation stays hourly, and the date lags by about a minute.
   - Run expiry when the date changes.
   - Seed the clock row during setup or the first deploy.
   - Correct the wording in ADR-008.

4. [Minor] Outbox ordering: later events wait for the sweep, and a few claim gaps

   Location: architecture.md:401–409, 428–438; 006:41–48, 84–92; coding-standards.md:28–29

   Problem: Ordering cannot block a loan forever. An earlier event ends delivered or failed within 6 attempts, about 7.2 h, and crashed final attempts are dead-lettered. Each "Retry all" restarts that wait. The gaps:
   - **Later events wait for the sweep.** Nothing schedules a loan's next event when the earlier one finishes. A second email, such as a request followed quickly by a cancel, can be up to 5 minutes late.
   - **Blocked rows can starve the sweep.** A row waiting behind an earlier event keeps its original `nextAttemptAt`. Those rows therefore sit at the front of the `by_status_next` index, and a sweep bounded by `take(n)` can fill every batch with rows it cannot claim.
   - **The claim doesn't require `attempts < 6`.** If the sweep re-schedules before it dead-letters, a crashed sixth attempt is sent a seventh time.
   - **`skipped` is decided too early.** It is checked only when an admin clicks Retry. A revived dead letter can still be sent after a newer event that was in flight at that moment.
   - **One sentence is backwards.** At :432, "at most once, so no event can be stranded" states the opposite of the reasoning.

   Recommendation:
   - When an event is recorded, retried or skipped, schedule the loan's next pending event.
   - When ordering blocks a claim, move the blocked row's `nextAttemptAt` to that of the event ahead of it.
   - The claim requires `attempts < 6` and re-checks "a newer event was delivered → `skipped`".
   - Fix the sentence at :432.
   - Add criteria for the follow-on delay and the attempt cap.

5. [Minor] The merge gate is stated two ways and exempts every docs change

   Location: docs/reviews/README.md:23–25 vs delivery-blocks.md:25–31, commit-conventions.md:28–32, ADR-009:87–88, close-block:21–27; close-block:45–55

   Problem: The rules, ADR-009, CLAUDE.md, run-block and close-block now agree with each other. Two problems remain:
   - docs/reviews/README.md allows only `docs/` and `CHANGELOG.md`. A milestone's `chore: release` commit, which changes `package.json` and the lockfile, fails that version of the gate.
   - "Bookkeeping" covers all of `docs/`. After a pass, edits to the architecture, security, ADRs or a spec's acceptance criteria merge unreviewed, and close-block's checklist invites such edits. On this branch, the whole deliverable is under `docs/`.

   Recommendation:
   - Use one definition everywhere.
   - Limit bookkeeping to:
     - `docs/reviews/**` and `docs/logs/**`;
     - status lines and the §9 evidence column;
     - additions to `docs/tech-debt.md`;
     - `CHANGELOG.md`;
     - the fields `npm version` changes.

     Any other docs change needs a new review round, or at least a note in the review record.

6. [Minor] Gaps in how stacked branches work

   Location: commit-conventions.md:15–18, 33; close-block:80; blocks/README.md:14; ADR-009:84–86; run-block:21–35; 001:12; delivery-blocks.md:18; tech-debt-and-bugs.md:36; id-registry.md:13–15

   Problem:
   - **Merged branches disappear.** `gh pr merge --delete-branch` removes the branch, so "its branch is an ancestor of origin/main" can no longer be checked, and run-block's base rule then names a branch that doesn't exist.
   - **The `origin/main` base fails.** `git switch origin/main` fails without `--detach`.
   - **Pre-flight reads the wrong checkout.** It reads dependency status and review records before switching to the base branch. On `main`, where nothing has merged yet, every dependency looks Planned.
   - **Nothing gates block 001.** It has no dependencies, so nothing checks that the planning baseline passed review, and the baseline is NEEDS WORK today.
   - **Two start rules.** commit-conventions.md:15 says "latest review passed"; delivery-blocks.md:18 says "Closed".
   - **Fixes cascade.** A fix on a lower branch has to be merged forward, which puts non-bookkeeping commits on every branch above it and forces each one to be reviewed again. `fix/BUG-nnn` branches have no defined base.
   - **ID claims are invisible.** They are committed to `main`, which no stacked branch contains.

   Recommendation:
   - Drop `--delete-branch`, or define "merged" as "has a merge commit on origin/main".
   - Use `main` rather than `origin/main` as the branch to switch to.
   - Read pre-flight state from the base branch (`git show <base>:…`).
   - Gate block 001 on the latest planning-baseline review.
   - Use "Closed" as the start rule in both places.
   - Fix bugs forward, on top of the stack.
   - Commit ID claims to the branch that the parallel branches will be cut from.

7. [Minor] `integrationStats` turns unauthenticated requests into writes on one heavily contended row

   Location: architecture.md:208–219, 449–450; 006:57, 101; 010:36–37

   Problem:
   - The `/n8n/*` endpoints are public. Every 413, 401 or 400 updates one per-day document, so anyone can cause unlimited writes and write conflicts on it.
   - Under contention, that counter write can turn the bare 401 into a 500.
   - A single stray request lights the admin badge for the rest of the day.

   Recommendation: rate-limit or sample the counter, for example with the rate-limiter keyed by reason, and make sure the 401 response never depends on the counter write.

8. [Minor] `workflowRuns` can't list errors from unknown workflow slugs

   Location: architecture.md:198, 206; 006:50–51, 111–113; 010:32, 36

   Problem: the only index is `(workflow, kind, receivedAt)`. "Recent errors" and "errors in the last 24 h" need the slug in advance. An error stored under an unknown slug, which is the case "stored, never rejected" was added for, never reaches the health panel without a table scan.

   Recommendation: add an index `by_kind_received (kind, receivedAt)`, and test that an unknown-slug error appears in `health`.

9. [Minor] n8n stack: secrets reach containers that don't need them, and one assumption is unverified

   Location: 007:25–33, 50–51, 86–87; architecture.md:603, 613–615, 674–677; security.md:76

   Problem:
   - "All services reading `.env.n8n`" hands both signing secrets to the Caddy, cloudflared and Mailpit containers.
   - `N8N_ENCRYPTION_KEY_FILE` isn't a §16 verification item, and n8n's docs don't confirm it is supported. If n8n 2.47 ignores it, n8n silently generates its own key inside the volume. Setup's refusal to replace a lost key, and security.md §5, would then no longer describe what happens.
   - No criterion says `npm run dev` still starts when the stack is down, even though `predev` now runs the tunnel sync.

   Recommendation:
   - Give `env_file` to the n8n service only.
   - Add the key-file question to §16 for block 007, with a check that the key n8n uses matches the file.
   - Add a criterion that `predev` does nothing when the stack is down.

10. [Minor] Skills pre-approve all of Bash, and the deny rules miss the common Windows forms

    Location: run-block:5–11, resume-block:5–11, close-block:5–11, report-bug:4–9; .claude/settings.json:10–21; coding-standards.md:48–49

    Problem:
    - `allowed-tools: Bash` pre-approves every shell command in the invoking turn, including `docker compose down -v` and `gh pr merge`.
    - The PowerShell deny rules don't match `Get-Content .\.env`, `-Path .env`, or absolute paths, which are the forms an agent on Windows usually writes.
    - The repo's own rule to start the Convex CLI through its Node entry point bypasses the `npx convex env` denies.

    Recommendation:
    - Narrow the pre-approval, for example to `Bash(git *)`, `Bash(npm run *)` and `Bash(npm test)`.
    - Add the `.\` and absolute-path forms, plus the Node-entry-point form, to the deny rules.
    - Alternatively, say plainly which forms the rules cover.

11. [Minor] Block 012 has criteria that can only be met after its own review

    Location: 012:60, 63–64

    Problem: "Every requirement has evidence in §9" can't hold at review time, because 012's own evidence links are added when it closes. "The tag points at main after the merge" needs the deferred merge. The reviewer must either fail block 012 or quietly waive both.

    Recommendation: limit the §9 criterion to blocks 001–011, and move the tag and the GitHub Release into close-block's merge step.

12. [Minor] Small inconsistencies

    - **ADR status lines:** ADR-006:3 and ADR-008:3 say "Accepted", while adr/README.md:15 and :17 say "Accepted (revised)". ADR-008's title also differs from its index entry.
    - **BR-5 wording (prd.md:107):** "end ≥ start, so a loan lasts 1 to 30 days". The 30-day cap is a separate rule, not a consequence.
    - **`listPublic` ordering and limit:**
      - Returning "newest first" needs a `by_status` index; `by_status_category` orders by category first (architecture.md:132).
      - Taking 60 tools and then dropping those on loan returns fewer than 60.
    - **TD-006 / ADR-005:79–81:** they list "crash between send and write-back". A write-back that fails after its retries is the same case, and more likely.
    - **Edge-proxy 404s:** a 404 carrying `X-LendLoop-Edge: denied` means the webhook URL is misconfigured. It should be classified as `CONFIG`, not retried for 7 h (architecture.md:422 vs :641–642).
    - **Smoke-test path check (008:45–46):** "wrong path → 401" only holds if the wrong path is another live webhook; an unknown path gets n8n's own 404.
    - **Sub-workflow option (009:40–41):** a signing sub-workflow would also need publishing, the error-workflow link and coverage by `check:workflows`. "All three" (architecture.md:535; ADR-006:53) doesn't cover it.

13. [Minor] Proportion

    - §7.3 and §8 now contain two state machines in prose only: outbox delivery, and reminder claims. A state diagram for each would make them reviewable, and would have exposed New 1's `failed → sending` gap.
    - The process layer is now heavier than some of the product docs: the ADR-009 amendment, stacked branches, review records, the bookkeeping gate, six skills and eight rules. Keep it out of the README's main path (012 already only links it).
    - A navigation badge for "any rejection today" invites alert fatigue (New 7).

**Coverage:**
- No functional gaps against the assignment.
- Weakly evidenced:
  - AUT-2 and REL-2 when a run is interrupted: no criterion shows that a crashed or retried reminder run still reminds everyone that day (New 1).
  - The rule that a 2xx means the email was sent stays unproven until §16:679 is settled (New 2).

**Positive observations:**
- **Outbox delivery** is now precisely specified: one claim rule, lease tokens, an outcome always recorded, crashed final attempts dead-lettered, and a criterion for each path (006:77–95).
- **The 20 s / 30 s timeout invariant** is stated once and carried consistently through ADR-005, ADR-006, §7.3, §11 and 008. The paused-SMTP test is the right test.
- **Error-workflow liveness on n8n 2.x** is handled end to end:
  - stable workflow IDs, which the sanitizer keeps;
  - a link check in `check:workflows`;
  - publish-and-verify in setup;
  - a fresh-import criterion;
  - the handler records, continues on error, and always sends the alert.
- **Redaction** happens in both n8n and Convex, is tested against a realistic SMTP message, and loan parties see only a status.
- **Review records** tied to the reviewed SHA are a durable substitute for PR comments. The `block-reviewer` setup is valid Claude Code configuration: a fresh context without Edit or Write.
- **The dependency graph** is now linear and consistent across the specs and the blocks table.
