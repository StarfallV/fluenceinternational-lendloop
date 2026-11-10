# Block 001 — review round 2

**Reviewed commit:** 39f82a5 · **Range:** docs/planning-baseline...39f82a5 (focus on the round-1 fixes, ceb3300..39f82a5) · **Date:** 2026-11-11
**Reviewer:** fresh read-only agent (`block-reviewer`), given the round-1 record · **Verdict:** PASS WITH NOTES

---

=== Review: 001 ===
Base: origin/docs/planning-baseline (410e0cc) · Head: 39f82a5 (39f82a59164ee6921f9631f8d05b127e320346b3)
Verdict: **PASS WITH NOTES**

Checks: typecheck ok · lint ok · tests 113 passed / 0 failed. `format:check` also passes, and `check:ids` reports "no duplicates (14 TD, 9 ADR, 0 BUG, 12 block)". I didn't run `build`, because it writes `.next/`. The working tree was still clean afterwards. This is round 2. I re-read every changed file in the whole block, and focused on `ceb3300..39f82a5`.

**Earlier findings (round 1):**
- **1. Close variants get through:** addressed. All 10 variants now have blocked test rows, and they pass. New gaps of the same kind are in Issue 1.
- **2. Reading secrets inside a container:** addressed. `~/.n8n/config` reads and copies are blocked, and so is `export:credentials --decrypted`. §5 now lists files read inside a container as uncovered, and TD-013 exists. The env-variable indirection TD-013 misses is Issue 2.
- **3. Monitor coverage was assumed:** addressed. A missing `command` now warns and exits 1, `settings.test.mjs` pins the registration, and a live Monitor probe is recorded.
- **4. Node floor:** addressed. `^22.13.0 || ^24.0.0 || >=26.0.0` matches what every engine range in the lockfile allows. The one `^20.9.0` entry is the optional `@img/sharp-win32-ia32`.
- **5. Commits that fail their own scripts, and the `test:` commit type:** addressed by recording them under Deviations.
- **6. PR template link:** addressed. It is now an absolute `blob/main` URL.
- **7. Where a fix-block spec gets committed:** addressed. One gap remains in resume-block and run-block (Issue 3).
- **8. check:ids failed open:** addressed. It now fails closed, each fixture fails for one reason only, the CLI cases exist, and the edge-runtime test runs.
- **9. Documentation nits:** addressed (ADR-009, the security.md status line, the templates note, dependency reasons, the `next.config.ts` comment).
- **Undocumented deviations:** addressed. Both are now under Deviations.

**Acceptance criteria:**
- Clean clone succeeds on Windows and in CI: PASS. Evidence is cited for `e0c9dea`, and HEAD only adds the log. I re-ran 5 of the 6 commands at HEAD.
- `/` shows the name and tagline at 360 and 1280 px: PASS. I checked both screenshots: 16 px gutters, no overflow.
- `check:ids` passes, and a test proves it fails on duplicates: PASS.
- CI is green on the pushed branch: PASS, on the cited runs. I couldn't re-check them read-only; the merge gate covers that.
- `strict` is on, `any` is an error, zero warnings: PASS.
- No CRLF in the index: PASS. 111 files are `i/lf` and 2 PNGs are `-text`, as I checked at HEAD.
- `package.json` is at `0.0.0`: PASS.
- Secret guard: PASS. Every concrete example in security.md §5 has a matching test row (48 blocked, 27 allowed). The deny and fail-open entry-point tests pass, and the live probes are recorded. Some category claims in §5 go further than the code (Issue 1).
- TD-009 and TD-012 marked resolved: PASS.

**Architecture and rules:**
- The layout matches architecture.md §3.
- No Convex functions exist yet, so the wrapper, `transition()` and clock rules don't apply.
- The commits since round 1 follow the conventional format, are split at sensible boundaries, and carry the attribution line.

**Security and privacy:**
- No secret-shaped strings in tracked files. The `.env.example` values are empty.
- `.gitignore` covers every `.env*` file except the two templates, plus `.secrets/`.
- CI runs with `contents: read`.
- `cn` 0.5.2 comes from the `shadcn-ui/cn` repository, with no dependencies and no install scripts.
- The shadcn move changes only the lockfile's `dev` flags (227 `"dev": true` lines added), with no version drift.
- The guard's gaps are Issues 1, 2 and 4c.

**Issues:**

1. **[Minor] Docker forms that §5 says are blocked still get through.**
   - **Options before the subcommand.** The `exec`/`run`/`cp` patterns need the subcommand straight after `docker`, `docker compose`, `docker-compose` or `docker container`. So none of these are blocked:
     - `docker compose -f compose.yml exec n8n printenv`
     - `docker compose -p lendloop exec n8n env`
     - `docker --context default exec lendloop-n8n-1 env`
     - `docker compose -f compose.yml exec n8n cat /home/node/.n8n/config`
     - `docker --context default inspect …`

     The `config` pattern does allow options before the subcommand, and the test list expects that: `docker-compose -f compose.yml config` is a blocked row. So the patterns disagree with each other.
   - **`sh -c` scripts.** Inside an `sh -c` script, `[^|;&]*` stops at the script's own separators. So `docker compose exec n8n sh -c 'cd /tmp && env'` and `… sh -c 'true; printenv'` get through, although §5 lists "a quoted `sh -c` script" as covered.

   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\secret-names.mjs:12,26,35,41`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:104-109`

   Recommendation:
   - Match the subcommand the way the `config` rule does: `\bdocker(?:-compose)?\b[^|;&]*?\s(?:exec|run|cp|inspect)\b`.
   - After `exec`/`run`, scan to the end of the command, not to the next separator, for `[\s='"(;&|](?:\S*\/)?(?:printenv|env|environ)\b`. Over-blocking a host `env` that comes after a docker command is acceptable.
   - Add a blocked test row for each example above.
   - Block 007 will add a rule for TD-013. Build it on the same corrected prefix.

2. **[Minor] Reading one secret variable in the n8n container isn't blocked, and TD-013's plan misses the key-file indirection.**
   - TD-003 puts both signing secrets in the n8n container's environment, and `.env.n8n` sets `N8N_ENCRYPTION_KEY_FILE` there. All of these pass the guard:
     - `docker compose exec n8n sh -c 'echo $CONVEX_TO_N8N_SIGNING_SECRET'`
     - `docker compose exec n8n node -e "console.log(process.env)"`
     - `docker compose exec n8n sh -c set`
     - `docker compose exec n8n sh -c 'cat "$N8N_ENCRYPTION_KEY_FILE"'`
   - The last one prints the encryption key without naming its path. TD-013's planned path rule ("blocks `docker … exec|run|cp` commands that name it") would still miss it.
   - §5's uncovered list says only "a shell started inside a container". Yet §5 also claims some `sh -c` scripts as covered, so a reader can't tell where the line is.

   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\tech-debt.md:239-250`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\blocks\007-local-automation-stack.md:80-82`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:138-140`

   Recommendation: block `docker … exec|run` commands that mention `SIGNING_SECRET`, `ENCRYPTION_KEY` (which also matches `_FILE`) or `process.env`, or that run `set`, `export -p` or `declare -x`, with a test row each. If that is deferred, record a new TD item for block 007 (a new item is bookkeeping) covering the variable-name rule and the `$N8N_ENCRYPTION_KEY_FILE` indirection. Then list "reading one variable" explicitly in §5.

3. **[Minor] The fix-block flow only works from a checkout of the base branch, and no skill says so.**
   - **resume-block** now takes the branch name from `docs/blocks/$ARGUMENTS-*.md` in the current checkout. A fix block's spec is committed only on its own branch (create-blocks and run-block step 8 now say so). So in the "it exists but you are elsewhere" case (for example on `main`, or on block 012's branch), the spec isn't there to read.
   - **run-block, pre-flight 2,** has the same problem for a block that follows a fix block: it reads block N−1's spec for the base.
   - **run-block, pre-flight 4:** `git switch -c` carries the uncommitted changes to `docs/blocks/README.md` and `docs/prd.md` only if those files are the same in HEAD and the base. From any other checkout, the switch aborts.

   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\skills\resume-block\SKILL.md:33-38`; `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\skills\run-block\SKILL.md:35-37,50-52,59-62`; `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\skills\create-blocks\SKILL.md:39-42`

   Recommendation:
   - In resume-block and run-block: if the spec isn't in the checkout, find it with `git log --all --format=%H -1 -- "docs/blocks/NNN-*.md"`, then read its Branch line with `git show <sha>:<path>`. Both commands are already in their allowed tools.
   - In create-blocks and report-bug: write a fix block's spec, index rows and bug report while on the base branch.

4. **[Minor] Small accuracy and test gaps.**
   - a. TD-009's resolution line still says "45 command cases". There are now 75 (48 blocked, 27 allowed), and the line doesn't mention the registration test (`D:\Work\Personal\repos\fluenceinternational-lendloop\docs\tech-debt.md:151`). This edit is bookkeeping.
   - b. `settings.test.mjs` checks only 5 of the 8 Read/Edit deny paths. Deleting `/.env.development`, `/.env.production` or `/.env.test` (`D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\settings.json:8-10,16-18`) fails no test, although §5 claims every env file Next.js loads is covered. Add them to the `it.each` at `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\settings.test.mjs:41`.
   - c. §5 says "If its own matching fails, it denies" (`D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:128`). But `secret-names.mjs` builds its regexes when the module loads, and the hook imports it statically (`D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\guard-secrets.mjs:8`). If a pattern is broken, for example by a typo during block 007's TD-013 edit, the hook crashes with exit 1, and every command then runs unchecked until the edit is fixed. Load the module with `await import()` inside a try, and deny on failure.

**Undocumented deviations:**
- None found.

**Positive observations:**
- Each round-1 recommendation was applied as written, with a test row per variant and false-positive rows (`rg -U`, `ConvertFrom-Json -Depth`, `git diff --no-index`, n8n's own CLI).
- The completion log's numbers match the test run: 48 + 27 command cases, and 113 tests in total.
