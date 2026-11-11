# Block 001 — review round 4

**Reviewed commit:** d6c0552 · **Range:** docs/planning-baseline...d6c0552 (focus on the round-3 fixes, 0746dce..d6c0552) · **Date:** 2026-11-11
**Reviewer:** fresh read-only agent (`block-reviewer`), given the round-1 to round-3 records · **Verdict:** PASS WITH NOTES

---

=== Review: 001 ===
Base: origin/docs/planning-baseline (410e0cc) · Head: d6c0552 (d6c0552de6cb1b5134caced3b218511f20a066ec)
Verdict: **PASS WITH NOTES**

Checks: typecheck ok · lint ok · tests 168 passed / 0 failed. `format:check` passes, and `check:ids` reports "no duplicates (14 TD, 9 ADR, 0 BUG, 12 block)". I didn't run `npm ci` or `build`. The working tree is still clean.

This is round 4. I looked hardest at `0746dce..d6c0552`, mainly `2d6793d`, which rewrote the matcher. To test it, I imported `secret-names.mjs` at HEAD and at `9b2452a` (the round-3 commit) into inline Node scripts and gave both the same probe commands. I built the probe strings from pieces so my own commands wouldn't trip the guard. I created no files.

**Earlier findings (round 3):**
- **1. A long command makes the hook time out:** partly addressed. The shape round 3 reported (a container heredoc) is now checked word by word, and the 1 MB command is denied quickly. But the same time-out is still possible under the 64 KiB limit through three other patterns, and the docs now say every check is linear (Issue 2).
- **2. Container env reads that §5 calls blocked:** addressed. Every example has a passing test row, the volume case went into TD-013, and §5's uncovered list was updated. The rewrite did lose some earlier coverage, though (Issue 1).
- **3. `findstr -s`:** addressed. It has a test row (`secret-names.test.mjs:83`).
- **4. §5 cases without a test row:** addressed (`secret-names.test.mjs:46-48,60`).
- **5. Evidence older than the last code change:** addressed. The clean-clone and CI evidence is at `fe512fc`, and the only later commit changes just the log. Line endings at HEAD: 113 `i/lf`, plus 2 PNGs as `i/-text`.
- **6. Nits:** addressed. Both skills now use `--name-only`, and ADR-009 and security.md's status line are rewrapped. The log's Notes now say "planning review rounds".

**Acceptance criteria:**
- Clean clone succeeds on Windows and in CI: PASS. The evidence is at `fe512fc`, and I re-ran typecheck, lint, format:check, test and check:ids at HEAD.
- `/` shows the name and tagline at 360 and 1280 px: PASS. The UI hasn't changed since the screenshots.
- `check:ids` passes, and tests prove it fails on duplicates: PASS.
- CI is green on the pushed branch: PASS, on the cited run for `fe512fc`. HEAD (`d6c0552`) is pushed and changes only the log. I couldn't check CI status read-only.
- `strict` is on, `any` is an error, zero warnings: PASS.
- No CRLF in the index: PASS.
- `package.json` is at `0.0.0`: PASS.
- Secret guard: PASS. All 77 blocked and 36 allowed rows pass, and so do the entry-point tests. The HEAD hook also denied my live probe (`echo probe .env.local`) in this subagent. Every example §5 lists holds. Some of §5's broader claims, and its linear-time claim, go further than the code (Issues 1–3).
- TD-009 and TD-012 marked resolved: PASS.

**Architecture and rules:**
- No Convex functions exist yet, so the wrapper, `transition()` and clock rules don't apply. The layout matches architecture.md §3.
- The commits since round 3 follow the conventional format and carry the attribution line.
- No violations found.

**Security and privacy:**
- The round-4 changes add no secret-shaped strings. The new test rows contain only command shapes and variable names.
- The guard has one regression (Issue 1), one remaining way to time out (Issue 2) and one common gap (Issue 3).

**Issues:**

1. **[Minor] The `2d6793d` rewrite no longer recognises docker run by path or as `.exe`, so shapes blocked at round 3 now get through.**
   - **Blocked at `9b2452a`, allowed at HEAD:**
     - `/usr/bin/docker exec lendloop-n8n-1 env`
     - `docker.exe exec lendloop-n8n-1 env`
     - `"/c/Program Files/Docker/Docker/resources/bin/docker.exe" exec lendloop-n8n-1 env` (Git Bash, when Docker isn't on PATH)
     - `docker-compose.exe exec n8n printenv` and `/usr/local/bin/docker-compose exec n8n printenv`
     - `docker.exe inspect lendloop-n8n-1` and `/usr/bin/docker inspect lendloop-n8n-1`
     - `docker.exe compose exec n8n sh -c 'echo $CONVEX_TO_N8N_SIGNING_SECRET'`
     - `/usr/bin/docker compose exec n8n cat /home/node/.n8n/config`
     - `docker.exe cp lendloop-n8n-1:/home/node/.n8n/config -`
   - **Cause:** `dockerSubcommands` compares the whole word: `if (word === "docker" || word === "docker-compose")`. The old `\bdocker(?:-compose)?\b` also matched inside a path or before `.exe`. `dumpsEnvironment` strips the path from `env` names, but the docker check doesn't.
   - **Why no test caught it:** no test row uses a path-prefixed or `.exe` docker.

   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\secret-names.mjs:50`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:108-110,123`

   Recommendation:
   - Compare the word's basename without `.exe`: `const name = word.slice(word.lastIndexOf("/") + 1).replace(/\.exe$/i, "")`.
   - Add a blocked row for each shape above.
   - `docker.exe compose config` has never been blocked, because the config rule's `\bdocker(?:-compose|\s+compose)\b` fails at the `.`. Allow an optional `.exe` there too.

2. **[Minor] Round 3's time-out is still possible under the 64 KiB limit, and the docs say every check is linear.**
   - **Cause:** three flag patterns put a required letter between two unbounded letter runs, followed by an assertion that fails at the end of the cluster. That makes them quadratic:
     - grep: `-[a-z]*r[a-z]*(?=\s|$)`
     - rg: `-[A-Za-z]*u[A-Za-z]*(?=\s|$)`
     - findstr: `[/-][a-z/]*s[a-z/]*\b`
   - **Measured at 65,536 characters on this machine:**
     - `grep -` plus about 65,500 `r`s and `1`: 13.1 s;
     - the same shape for `rg -…u1`: 10.1 s;
     - for `findstr /…s_`: 5.1 s;
     - `grep -rrr…r1 -r SIGNING_SECRET .`: the matcher returns deny after 9.6 s, and the whole hook takes 9.8 s, against its 10 s timeout. GNU grep reads `-rrr…r1` as `-r` plus one line of context, so if the hook times out, a real recursive search for the secret runs.
   - **Docs:** §5 says "every check is linear (about 15 ms at worst for 64 KiB)". The completion log says "Every check is linear", "The worst 64 KiB input now takes about 15 ms" and calls the timing inputs "worst-case".
   - **Tests:** the timing test "one long flag after grep" uses `-a-a-a…`, which never backtracks, so no test covers these patterns.

   No agent would type such a command by accident. The problem is that the docs claim the hook always answers in time, which was round 3's point, and it doesn't.

   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\secret-names.mjs:172,182,214`; `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\secret-names.test.mjs:142-145,161`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:99-101`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\logs\001-completion.md:31-33,54,132-136,189`

   Recommendation:
   - Split `rest` at whitespace and test each token with an anchored pattern: `/^-[a-z]*r/i` for grep, `/^-[A-Za-z]*u/` for rg, `/^[/-][a-z/]*s/i` for findstr. These are linear per token. Keep the existing long-option alternatives as they are.
   - Or, in addition, lower the limit: time grows with the square of the length, so 16 KiB would take about 0.8 s at worst.
   - Add timing rows for the three cluster shapes at the limit.
   - Correct §5, the log and the test comment.

3. **[Minor] A recursive grep with an argument attached to the flags gets through.**
   - **Allowed at both `9b2452a` and HEAD:**
     - `grep -rnA2 SIGNING_SECRET .`
     - `grep -rnC3 token .`
     - `grep -rn5 token .`
     - `grep -rm1 token .`
     - `rg -uuA2 token`
   - **Cause:** the same patterns as Issue 2 need the cluster to be all letters up to the next space.
   - **Why it matters:** `grep -rnC3` is a common way to search with context, and run from the repository root it prints lines from `.env.n8n`. §5 says `grep -r`, and `rg -u` "in any short-flag cluster", are blocked.

   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\secret-names.mjs:172,182`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:125-127`

   Recommendation: the token check from Issue 2 fixes this too (`/^-[a-z]*r/i` matches `-rnA2`). Add a blocked row for each example. It keeps the existing allowed rows passing (`grep -c error build.log`, `rg -U …`, `findstr /i …`).

**Undocumented deviations:**
- None found. Issue 1 is a regression, not a recorded design change.

**Positive observations:**
- The word-by-word container check fixes the shape round 3 reported. Every round-3 example has a passing row, and the 1 MB command is denied quickly through the real hook.
- The counts in the log and in TD-009 match the suite exactly: 77 blocked and 36 allowed rows, 168 tests.
