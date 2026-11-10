# Planning baseline — review round 1

**Reviewed commit:** 8e3aba6 · **Range:** main...8e3aba6 · **Date:** 2026-11-10
**Reviewer:** fresh read-only agent, given the original assignment text · **Verdict:** NEEDS WORK

---

=== Planning Baseline Review ===
Verdict: NEEDS WORK

I read all 46 files in `git diff main...HEAD` in full (branch `docs/planning-baseline`, 8e3aba6). I
checked the n8n 2.x, Convex and Claude Code behaviours I rely on against current docs and n8n
support statements; sources are at the end. Nothing was modified.

Coverage gaps:
- **PUB-2:** the PRD defines "available" as listed and not on loan (prd.md:36). Nothing
  demonstrates it:
  - 003's AC returns "active tools" (003:49–50), and availability is stubbed in 003 (003:36).
  - 004's availability ACs (004:72–76) never touch `listPublic`.
  - §9 maps PUB-2 to 003 only (prd.md:168). See Finding 6.
- **LST-5** "with their status and loans" (prd.md:47): no block delivers the loans part (003 has no
  loans; 004 never extends `/listings`). No AC checks the My listings view at all.
- **BRW-5 and BRW-6** (prd.md:57–58): "pending first" ordering and the navigation pending count
  have no AC. `pendingCount` is never tested.
- **ADM-2** "filtered by status" (prd.md:66): 005's `listLoans` AC checks shape only, not the
  filter.
- **LST-4** availability on browse cards: only model tests exist. Nothing checks that cards show
  "On loan" or "Booked from".
- **Brief, "error workflow … never fail silently":** no AC proves the error handler is published
  and linked after a fresh import. 012's fresh-clone AC (012:47–53) covers the happy path only.
  See Finding 3.
- **Brief, "retries do not create duplicate … reminders":** overlapping runs and a lost `sent`
  write-back can still email twice. See Finding 8.
- **DEL-4** "a short note": only `docs/production.md` is required (012:55). The README, where
  evaluators look, should carry the note or a summary with a link.
- **§9 omissions:** REL-2 is not mapped to 007, although 007 lists it. SEC-5 misses 005 (admin
  screens without emails) and 010 (activity without emails).

Findings:

1. [Major] n8n's retry budget is longer than Convex's delivery timeout, so SMTP trouble causes
   duplicate emails
   Location: architecture.md:345, 423, 409–412; 008:32, 54–59; ADR-005:25, 42; ADR-006:45
   Problem: n8n replies only after Send Email finishes. "Retry On Fail 3×, 5 s apart" adds at
   least 10 s of waiting, plus SMTP time; a hung SMTP connection can take much longer. Convex
   aborts at 10 s, records a retryable timeout and retries while n8n may still send the first
   email.
   - Duplicates become a normal result of an SMTP blip, not only of "a reply lost after a send".
   - It contradicts ADR-005's "the outbox is the single retry authority".
   - 008's AC "the webhook returns 5xx" is not what Convex will observe; it will see a timeout.
   - "Exactly one email after restart" becomes flaky.
   Recommendation: Remove Retry On Fail from the loan-event send path. State the invariant in §7.3
   that n8n's worst-case reply time is less than the Convex timeout (for example, Convex 30 s and
   n8n workflow `executionTimeout` 20 s). Test 008 with Mailpit paused (hanging) as well as
   stopped. Align ADR-005, ADR-006 and TD-006.

2. [Major] Events whose `deliver` crashes are never counted or dead-lettered
   Location: architecture.md:341–354; 006:39, 47–48, 57–63, 85–86
   Problem: attempts only advance in "record the outcome". If `deliver` throws first, the row
   stays `pending`, the lease expires, and the sweep reschedules it every 5 minutes forever. It
   never reaches `failed`, so it never shows as a dead letter. Causes include:
   - a missing URL or secret, which 006:85–86 explicitly expects before block 007;
   - a bug in building or signing the payload;
   - an action timeout.

   The claim's preconditions are also undefined. A claim that checks only the lease lets a
   sweep-scheduled duplicate send right after a recorded failure, bypassing backoff. A late
   `recordOutcome` can overwrite a newer attempt.
   Recommendation: Make the claim one mutation that requires `status=pending`,
   `nextAttemptAt ≤ now` and an expired lease, then increments `attempts` and returns a lease
   token. `deliver` catches everything and always calls `recordOutcome`; a config error counts as
   permanent with a `CONFIG` code. `recordOutcome` ignores stale tokens. The sweep dead-letters
   rows at the attempt cap. Add ACs for each of these cases.

3. [Major] The n8n error workflow can be silently inactive on n8n 2.x, especially after a fresh
   import
   Location: architecture.md:436–442, 531; 007:42, 46–48; 008:35–41; 009:25, 32, 56–58; 012:47–53
   Problem:
   - **(a) Publication:** on 2.x an error workflow runs only if it is published. n8n support
     confirmed this on 2.43.x, contrary to the node docs. `import:workflow` deactivates every
     workflow, and `publish:workflow` works one ID at a time.
   - **(b) ID linkage:** `settings.errorWorkflow` stores the handler's ID. If the sanitizer strips
     IDs as "instance metadata", or someone imports through the UI, the link breaks without
     warning.
   - **(c) Manual runs:** error workflows don't fire for manual executions. The Manual Trigger,
     and an evaluator clicking "Execute workflow", bypass failure reporting. The smoke-test
     trigger is still undecided.
   - **(d) Trigger failures:** these carry `trigger`, not `execution`, so there is no execution
     ID.
   - **(e) Record first, then email:** if the POST to `/n8n/errors` stops the workflow (Convex
     down or 401), the alert email is never sent. That is exactly the case the alert exists for.
   Recommendation:
   - Commit stable workflow IDs, and keep `id` and `settings.errorWorkflow` in the sanitizer.
   - Have `check:workflows` assert that every workflow links to the handler, and have setup
     publish all three by ID and verify.
   - Set the POST to "On Error: Continue", then always send the alert.
   - Accept a missing `executionId`.
   - Run scripted reminder runs through a signed production webhook. Everything under
     `/webhook/lendloop/` is public, so it must verify a signature.
   - Add these items to §16, and add a fresh-import failure-path AC to 008 or 012.

4. [Major] Personal data reaches error records, admin screens and alert emails that the docs call
   PII-free
   Location: architecture.md:175, 191, 369, 371; security.md:62, 64; ADR-006:57–58; prd.md:122;
   009:28–29
   Problem: the reminder `error` and the handler's `message` are raw n8n and SMTP strings, which
   routinely contain the recipient address (for example
   "550 5.1.1 &lt;sam@example.com&gt; … rejected"). They land in:
   - `automationEvents.detail`, which the counterparty sees in loan activity;
   - `workflowRuns.message`, shown in admin health;
   - the admin alert email.

   Nothing enforces the "no personal data" claim, and this contradicts BR-16. Separately, n8n
   saves manual executions by default, so manual reminder runs store every borrower's email
   (contradicts security.md:64).
   Recommendation: n8n sends an error code plus a redacted, truncated message. Convex redacts
   email-shaped strings again before storing, with a test that uses an SMTP-style message. Set
   `EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=false`.

5. [Major] Idempotency keys built on n8n execution IDs collide and silently drop heartbeats and
   errors
   Location: architecture.md:187–188, 370–371, 406–407; ADR-005:47–48; 006:78
   Problem: n8n execution IDs are per-instance counters that restart at 1 when the volume is
   recreated (iterating on 007's setup, or an evaluator running `down -v`). The cloud Convex
   deployment keeps the old rows, so `run:overdue-reminders:1` becomes a "duplicate" no-op:
   - new heartbeats are dropped, so health shows stale;
   - new errors are dropped silently.

   In addition, trigger errors have no execution ID (3d), and the `workflow` enum rejects n8n
   display names, so a rename means 400 and a lost record.
   Recommendation: Key on something unique across instances: either `N8N_INSTANCE_ID` (generated
   by setup) plus the execution ID, or a UUID minted in the workflow's first node and reused on
   retries. Send a fixed workflow slug. Store unknown workflow values instead of rejecting them.

6. [Major] PUB-2's "not on loan" rule is untested, and the specs contradict each other
   Location: prd.md:36, 168; 003:28–29 vs 003:49–50; 004:37–38, 72–76
   Problem: 003's outputs say "available tools" but its AC says "active tools". 004 never
   revisits `listPublic`, so every AC can pass while on-loan tools appear on the public page, the
   first screen an evaluator sees. `listPublic` and `tools:list` are also unbounded, against
   coding-standards' "bound results".
   Recommendation: Add a 004 AC: a tool leaves `listPublic` from the start of an approved loan
   until it is returned, comes back afterwards, and the key set stays exactly
   `{_id, name, category}`. Map PUB-2 to 003 and 004. Specify a limit or pagination for both list
   queries.

7. [Major] The merge gate in the process docs contradicts itself and has nowhere to keep the
   verdict
   Location: commit-conventions.md:18–19, 45–46; delivery-blocks.md:29, 31–63;
   run-block/SKILL.md:20–29, 78–86; close-block/SKILL.md:17–27, 45–59;
   review-block/SKILL.md:1–12, 20–21
   Problem:
   - **"PASS on the latest commit" can't hold.** close-block adds code fixes (Step 1) and docs
     commits (Step 3) after the review, then merges with no re-review, so unreviewed code can
     reach `main`.
   - **The log isn't the last commit.** run-block Step 8.1 commits after the completion log,
     contradicting "the completion log is the block's last commit before review".
   - **The verdict is never stored.** The review runs in a forked, read-only agent, nothing fills
     the PR template's verdict field, and close-block pre-flight 1 has nothing to read in a new
     session.
   - **Missing log section.** close-block writes "Review items addressed", which the log template
     doesn't have.
   - **Read-only isn't enforced.** `allowed-tools` only pre-approves tools (and here pre-approves
     all of Bash); a `general-purpose` agent keeps Edit and Write.
   - **Step order.** run-block reads the spec and checks `origin/main` before fetching or
     switching to main.
   Recommendation:
   - After each review, the main agent posts the report, with the reviewed commit SHA, as a PR
     comment (`gh pr comment`); close-block reads it with `gh`.
   - Only docs commits after that SHA are exempt; anything else needs a re-review.
   - Allow the "In review" status commit (or fold it into the log commit), and add "Review items
     addressed" to the log template.
   - Add `disallowed-tools: Edit, Write, NotebookEdit` to review-block, or use a custom read-only
     agent.
   - Reorder run-block pre-flight: fetch, switch to main, pull, read the spec, check
     dependencies.
   - Require the planning baseline to be merged before block 001.

8. [Minor] Duplicate reminder emails are still possible; ADR-005 overstates the guarantee
   Location: ADR-005:51–53; architecture.md:368–369, 405; 009:27–29, 35–39
   Problem: two overlapping runs both fetch before either writes back. This happens with the
   schedule plus a manual run, or a smoke script that re-triggers too early. A `sent` write-back
   that fails after the send means a same-day re-run sends again. `/n8n/reminders` also trusts any
   `reminderKey` and `loanId` pair.
   Recommendation: Either make the fetch claim each loan for the day (insert
   `reminder:&lt;loanId&gt;:&lt;date&gt;` as `sending` with a lease), or document the residual
   risk alongside TD-006. The smoke script should wait for the first run's record before
   re-triggering. Validate that the key matches the body and is not dated after today.

9. [Minor] Heartbeat and time-based health signals are wrong in common cases
   Location: 006:40–41, 79–80; 009:27–30, 53; 010:31–32, 40–41; ADR-006:56; TD-005
   Problem:
   - Convex caches queries until the data they read changes, so `Date.now()` in `health` never
     flips to "stale after 26 h" or clears "errors in the last 24 h" on an open page.
   - With no overdue loans, n8n's zero-item behaviour means nothing runs after the fetch, so no
     summary is posted on the most common day.
   - A fresh setup shows "stale" immediately.
   - A laptop asleep at 09:00 skips that day with no catch-up.
   Recommendation: Have the hourly cron write a singleton `clock` document (today, staleness, last
   error time) that queries read; this also fixes TD-005. Add an explicit empty-list branch with
   an AC. Show "no run yet" as its own state. Optionally add a catch-up run on n8n's "instance
   started" event.

10. [Minor] Secrets leak outside their intended scope
    Location: architecture.md:466–477; security.md:69–75; 007:36–43
    Problem:
    - Next.js automatically loads `.env`, so `N8N_ENCRYPTION_KEY` and both signing secrets enter
      the Next.js server process.
    - `$env` also exposes the encryption key to every Code node.
    - If `.env` is lost while the n8n volume survives, setup generates a new key and n8n won't
      start.
    - `convex env set NAME value` puts secrets on the command line.
    Recommendation: Move compose files under `infra/` (or use `--env-file .env.n8n`, plus a
    `.gitignore` entry). Use `N8N_ENCRYPTION_KEY_FILE`. Have setup detect a volume with no key.
    Use stdin for `convex env set` if supported; otherwise document the command-line exposure.

11. [Minor] The Claude Code deny rules are weaker than the docs claim
    Location: .claude/settings.json:4–10; security.md:43; security-standards.md:41–42;
    CLAUDE.md:124–125
    Problem: `Read()` denies are best-effort and only cover the built-in file tools, so
    `cat .env` or `Get-Content .env` still works. The PowerShell tool has separate
    `PowerShell(...)` rules, so `npx convex env list` run through PowerShell isn't denied on this
    Windows setup.
    Recommendation: Add the PowerShell equivalents and shell-read denies (or enable sandboxing),
    and reword the docs to say "best-effort".

12. [Minor] Windows and Docker Desktop failure modes
    Location: ADR-002:53; 007:76; architecture.md:347–349, 385
    Problem:
    - Windows PowerShell 5.1 strips embedded double quotes from native arguments, so
      `npx convex run users:grantRole '{"email":…}'` breaks.
    - `spawn('npx')` without a shell fails on Windows (EINVAL).
    - After the host sleeps, the WSL2 clock can drift past ±300 s. Every signed call then gets
      401, which is classified permanent, so all events dead-letter at once and the error
      handler's own POST fails too. The bare 401 hides the cause.
    Recommendation: Add `npm run admin:grant -- you@example.com`, which builds the JSON itself.
    Spawn node with the Convex CLI's JS entry point instead of npx. Log the 401 reason in Convex
    logs only and count rejections in health. Compute heartbeat age from Convex receive time. Add
    a runbook entry and a bulk "Retry all".

13. [Minor] The HMAC specification has gaps
    Location: architecture.md:377–394; ADR-004:48–55; security-standards.md:43
    Problem:
    - The key bytes are undefined: the UTF-8 of the base64url string, or the decoded bytes.
    - The `.` separator is ambiguous if a path ever contains a dot.
    - "Reject before parsing" is impossible in n8n, which parses the body before the Code node
      runs.
    - "Replays absorbed by idempotency" is false for Convex → n8n, so a replay inside the window
      re-sends the email.
    - n8n must send exactly the bytes it signed: a raw body, including the `{}`.
    - n8n 2.0 removed in-memory binary mode, which changes how a Code node reads the raw webhook
      body.
    Recommendation: Use newline separators. Define the key bytes inside the test vector. Require
    raw-body sending. Add the binary-mode change to §16. Document the replay residual risk.

14. [Minor] User-controlled text in identities and emails
    Location: 002:54–56, 81–86; architecture.md:109; prd.md:99; security.md:45
    Problem:
    - The display-name fallback is unspecified; deriving it from the email local part leaks part
      of the address.
    - Tool and display names go into email subjects without rejecting CR/LF, and display names
      have no length cap.
    - Clerk collects names only if configured to.
    - If the token lacks name or email claims, the only fallback that keeps `CLERK_SECRET_KEY` out
      of Convex is customising Clerk's session claims.
    Recommendation: Use a neutral fallback ("Neighbor 4821"). Reject control characters in
    single-line fields and cap their length. Add "require first and last name" and the claims
    fallback to block 002.

15. [Minor] Events for one loan can arrive out of order, and retries send stale content
    Location: architecture.md:147–160, 350–358
    Problem: independent backoff with jitter can deliver `cancelled` before `approved` after an
    outage. An admin retrying an old dead letter sends content built from the current state.
    Recommendation: Deliver only the oldest undelivered event per loan (the `by_loan` index
    already exists), or mark superseded events as skipped. Add an AC.

16. [Minor] Some ACs depend on later blocks or can't distinguish outcomes
    Location: 008:49–51; 009:42–43; 007:60–61, 64
    Problem: 008 and 009 require the loan to "show" activity, but that UI only arrives in 010. In
    007, n8n's 404 and the edge proxy's 404 look the same until a workflow exists. The export →
    import → export round-trip runs with no real workflows.
    Recommendation: Verify 008 and 009 through `automation:activityForLoan`, or move 010 earlier
    (it only needs 006). Add a ping workflow or a distinguishing header on the edge's 404. Repeat
    the round-trip AC in 008 and 009.

17. [Minor] Concurrency ACs prove less than they claim
    Location: 006:62, 76; ADR-005:65; 003:57; 004:81
    Problem: convex-test doesn't document conflict simulation and says it is not a real backend,
    so "concurrent duplicates give one record" can pass trivially. Its `defineTestApp` doesn't
    load `convex.config.ts`, so the rate limiter must be registered explicitly.
    Recommendation: Add a smoke test that sends N concurrent signed write-backs to the dev
    deployment. Note the component registration in 003.

18. [Minor] The tunnel doesn't heal itself, and ADR-001's analysis is inaccurate
    Location: ADR-001:27–34, 61–62
    Problem: every Docker or PC restart gives a new hostname. Outbox retries only help after
    someone runs `tunnel:sync`; otherwise events dead-letter after about 7 h. Option B's rejection
    is also wrong: `host.docker.internal:host-gateway` works on Linux, and signing behaves the same
    locally.
    Recommendation: Run `tunnel:sync` from `predev` or a combined dev script. Surface Cloudflare
    530 errors as "tunnel stale". Document `--protocol http2`. Restate the real reasons for
    choosing Option A.

19. [Minor] Ceremony out of proportion to the project
    Location: id-registry.md; 001:39–40, 56–57; ADR-009:49–50; commit-conventions.md:54–68
    Problem: the ID registry and `check:ids` (fixtures plus CI) solve parallel-branch collisions
    the plan says won't happen. Four GitHub Releases add reading without value.
    Recommendation: Drop or defer both, keep `v1.0.0`, and keep the README self-sufficient.

20. [Minor] Practical questions evaluators will likely probe
    Location: 003:45–46; prd.md:112, 131; 005:26
    Problem:
    - Seeded owners can't sign in, so testing approve and return needs a second account, which
      isn't documented.
    - Only the lender can mark a loan returned, so a forgetful lender means daily reminders
      forever.
    - Open Clerk sign-up exposes all display names and listings to anyone, and this isn't listed
      as a residual risk.
    - Admins can't tell apart two users both shown as "Alex P.".
    Recommendation: Document a two-profile test path. Define when reminders stop. Add open sign-up
    to security.md §6. Show a non-PII disambiguator, such as join date or listing count.

Consistency issues:
- **Dependencies:** "Depended on by" lists transitive blocks that don't list it back: 002:14,
  004:13, 006:14, 007:14. This disagrees with the README table.
- **CLAUDE.md:112–120** lists the smoke scripts under block 007; they arrive in 008 and 009.
- **`config:get`** implies `convex/config.ts`, which is missing from architecture.md:83 and
  CLAUDE.md:84.
- **`/n8n/runs`:** it sends `startedAt` and `finishedAt` (architecture.md:370), but
  `workflowRuns` has only `occurredAt` (:193). The `error-handler` enum value (:188) is never
  reported.
- **§8** omits the 413 that 006:68 requires, and the order of 413 vs 401 is undefined. §7.3 has no
  default class for other 4xx codes.
- **Payload roles:** "no … roles" (architecture.md:334) contradicts `recipient.role` (:326).
- **BR-21 fields:** BR-21 (prd.md:132) omits the reason that the payload (:329) and 008:31 use.
  The reminder response (:368) lacks the lender name and start date that BR-21 requires.
  `loan.id` isn't needed by n8n.
- **`.gitignore`** has `.data/` for container data, while 007:31 uses a named volume.
- **TypeScript version:** session-norms.md:20 says "TypeScript 7", but the plan pins 6.0.x.
- **BR-5 boundary:** today+90 is ambiguous (prd.md:106). 004 lacks tests for start=today, start at
  +90/+91 days, and end=start.
- **Error codes:** 004:69 and 010:35–36 accept "FORBIDDEN or NOT_FOUND"; pin one per resource.
- **003** needs `ALLOW_DEV_FUNCTIONS` but has no Manual Steps.
- **Release commit:** it bumps `package.json` under `docs:` and doesn't mention the lockfile (use
  `npm version --no-git-tag-version`).
- **Template:** "Known Constraints" is missing in 005 and 010–012.

Positive observations:
- **Outbox design:** inserting the outbox row and scheduling delivery in the same mutation is
  correct Convex reasoning, as are the at-most-once action caveat and the sweep.
- **Data minimization:** Convex resolves the recipient, outbox rows hold IDs only, and the
  data-minimization table is explicit.
- **Signing and exposure:** separate secrets per direction, signatures bound to method and path
  over the raw body, a shared test vector, and an edge proxy that limits the tunnel to
  `POST /webhook/lendloop/*`.
- **Heartbeat:** it is the right answer to "n8n is down entirely".
- **Verification items and ADRs:** checks for fast-moving versions are explicit and assigned to
  blocks, and the ADRs record real alternatives.

Sources:
- [n8n 2.0 breaking changes](https://docs.n8n.io/2-0-breaking-changes/)
- [n8n CLI commands](https://docs.n8n.io/hosting/cli-commands/)
- [n8n support: error workflow must be published (2.43.7)](https://community.n8n.io/t/error-workflow-on-n8n-2-43-7-it-only-runs-if-it-is-published-the-node-docs-say-otherwise/324466)
- [Three ways an error workflow doesn't run](https://community.n8n.io/t/three-ways-your-error-workflow-is-not-running-and-the-only-trace-is-one-line-in-the-server-log/316844)
- [n8n: access raw request body](https://community.n8n.io/t/access-raw-request-body/7866)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Claude Code permissions](https://code.claude.com/docs/en/permissions)
- [Convex environment variables](https://docs.convex.dev/production/environment-variables)
- [convex-test](https://docs.convex.dev/testing/convex-test)
- [Convex + Clerk](https://docs.convex.dev/auth/clerk)
- [Date.now() in Convex queries (community rule)](https://cursor.com/marketplace/rules/no-date-now-in-queries)

---

## Author response (2026-11-10)

Every finding was accepted, except where noted. The fixes are in the commits that follow this
record on `docs/planning-baseline`.

| Finding | Resolution | Where |
| --- | --- | --- |
| Coverage: PUB-2 | `listPublic` leaves out tools on loan. A 004 criterion covers it, and §9 maps PUB-2 to 003 and 004. | prd §9, blocks 003, 004 |
| Coverage: LST-5 | My listings shows each tool's availability and its pending-request count. The loans themselves live in Incoming. Covered by a 004 criterion. | prd LST-5, block 004 |
| Coverage: BRW-5/6 | Criteria for pending-first ordering and for `pendingCount` | block 004 |
| Coverage: ADM-2 | Criterion for the status filter, plus a "long overdue" flag | prd ADM-2, block 005 |
| Coverage: LST-4 | `tools:list` returns availability (test), and the card badges are checked by hand | block 004 |
| Coverage: error workflow | A failure-path criterion after a fresh import | block 008 |
| Coverage: duplicate reminders | Reminder claims (finding 8) | architecture §8, ADR-005, block 009 |
| Coverage: DEL-4 | The README carries the production summary and links `docs/production.md` | block 012 |
| Coverage: §9 | REL-2 also maps to 007; SEC-5 also maps to 005 and 010 | prd §9 |
| 1 | The loan-event send no longer retries inside n8n. The notification workflow times out at 20 s, before Convex's 30 s fetch timeout; this is stated as an invariant. The paused-SMTP case is covered in block 008. | architecture §7.3, §11; ADR-005; blocks 006, 008 |
| 2 | **Claim:** one mutation that requires `pending`, due, no live lease, and the oldest open event for its loan. It increments `attempts` and returns a lease token. **Deliver:** always records an outcome. **Record outcome:** ignores stale tokens. A configuration error counts as permanent (`CONFIG`). The sweep dead-letters final attempts that crashed. Each case has a criterion. | architecture §7.3; block 006 |
| 3 | **Workflow IDs:** stable and committed; the sanitizer keeps `id` and `settings.errorWorkflow`. **Checks:** `check:workflows` asserts the error-workflow link; setup publishes all three workflows by ID and verifies them. **Error handler:** records with "continue on error" and always sends the alert. **Other:** `executionId` is optional; scripted runs use a signed `run-reminders` webhook; a fresh-import criterion was added. | architecture §11, §16; blocks 007, 008, 009 |
| 4 | **Sending:** n8n sends an error code and a redacted, truncated message. **Storing:** Convex redacts again before storing. **Visibility:** the loan's parties see status only; admins see the redacted detail. **Manual runs:** not saved. **Test:** uses an SMTP-style message. | architecture §4, §8, §12; security §4; blocks 006, 007 |
| 5 | Keys use a `runId` or `errorId` minted per execution. `workflow` is a slug string, and unknown values are stored, not rejected. | architecture §4, §8, §10; ADR-005; block 006 |
| 6 | As for the PUB-2 coverage gap. `listPublic` returns at most 60 tools, `tools:list` is paginated, and `mine` returns at most 100. | architecture §6; blocks 003, 004 |
| 7 | **Changed from the recommendation, because the developer wants PRs opened later:** branches stack, and each review report is committed under `docs/reviews/` with the commit it reviewed, instead of a PR comment. **Gate:** only docs commits may follow a passing review. **Process docs:** the "In review" status is folded into the completion log commit; the log template gains "Review items addressed"; a dedicated read-only `block-reviewer` agent does the review; the run-block pre-flight is reordered. | rules, skills, `.claude/agents/`, ADR-009 amendment |
| 8 | **Claims:** fetching overdue loans claims each loan for the day (`sending`, with a 15-minute lease). **Validation:** the key must match the body, and its date may not be after today. **Smoke test:** waits for the first run's record before triggering again. | architecture §8; ADR-005; block 009 |
| 9 | **Clock:** an hourly `clock` document that queries read for "today" and "now" (this also resolves TD-005). **Empty days:** an empty-list branch posts a summary, with a criterion. **Fresh setup:** a "no run yet" state. **Downtime:** a catch-up run when n8n starts. | architecture §6, §11, §12; TD-005; blocks 004, 006, 009 |
| 10 | **Env file:** compose reads `.env.n8n`, which Next.js never loads. **Encryption key:** passed in a file (`N8N_ENCRYPTION_KEY_FILE`); setup refuses to replace the key of an existing volume. **Convex env:** set through stdin if supported, otherwise the exposure is documented. | architecture §13; security §5; block 007 |
| 11 | PowerShell and shell-read deny rules were added, and the docs now call the deny rules best-effort | `.claude/settings.json`, security docs and rules |
| 12 | **Admin grant:** `npm run admin:grant`. **Scripts:** spawn Node entry points directly, not `npx`. **Health:** counts rejections with the last reason, and measures heartbeat age from Convex's receive time. **Recovery:** "Retry all", plus a runbook entry for clock drift. | architecture §8, §12; blocks 002, 006, 007, 010 |
| 13 | **Canonical string:** newline-separated. **Key:** the UTF-8 bytes of the secret string, fixed in the test vector. **Body:** sent raw. **Other:** the n8n binary-mode change is in §16, and the replay residual is documented. | architecture §9; ADR-004; security §6 |
| 14 | **Display names:** the fallback is "Neighbor ####"; control characters are rejected; 40-character cap. **Clerk:** must require first and last name; a fallback for missing claims is documented. | prd BR-3, BR-16; block 002 |
| 15 | Events of one loan are delivered strictly in order. A dead letter superseded by a newer delivered event becomes `skipped` when retried. Covered by a criterion. | architecture §7.3; block 006 |
| 16 | **Later blocks:** 008 and 009 verify through the `automationEvents` data instead of the UI. **404s:** the edge proxy's 404 carries a distinguishing header. **Round trip:** uses a fixture in 007 and is repeated in 008 and 009. | blocks 007, 008, 009 |
| 17 | `smoke:idempotency` sends concurrent signed write-backs to the dev deployment. The rate limiter's registration in convex-test is noted. | architecture §15; blocks 003, 009 |
| 18 | **Self-healing:** `predev` runs `tunnel:sync` when the stack is up. **Diagnosis:** a 530 is labelled `TUNNEL_STALE`. **Transport:** cloudflared uses HTTP/2. **ADR-001:** Option B is now described accurately. | ADR-001; architecture §7.3, §14; block 007 |
| 19 | **Partly accepted:** GitHub Releases only for `v1.0.0`. The identifier registry and `check:ids` stay, because they are the developer's chosen standard and cost little. | ADR-009; commit-conventions |
| 20 | **Testing:** the two-account test path and owner-targeted seeding are documented. **Reminders:** stop after 7, and the loan is flagged. **Sign-up:** open sign-up is recorded as TD-007. **Admin users list:** shows join date and listing count. | prd BR-20; blocks 003, 005, 012; TD-007 |
| Consistency | All fixed: dependency lists, smoke-script timing, `config.ts` and `clock.ts`, `workflowRuns` fields, 413 ordering and the class for other 4xx codes, `loanRole` naming, BR-21 fields, `.gitignore`, TypeScript wording, BR-5 boundaries, one error code per resource, 003's manual step, the release command, and Known Constraints sections | various |
