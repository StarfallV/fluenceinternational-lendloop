# Block 001 — review round 3

**Reviewed commit:** 9b2452a · **Range:** docs/planning-baseline...9b2452a (focus on the round-2 fixes, 39f82a5..9b2452a) · **Date:** 2026-11-11
**Reviewer:** fresh read-only agent (`block-reviewer`), given the round-1 and round-2 records · **Verdict:** PASS WITH NOTES

An earlier attempt at this round ended with a network error before the agent returned anything, so
nothing was recorded from it. This is the report of the rerun.

---

=== Review: 001 ===
Base: origin/docs/planning-baseline (410e0cc) · Head: 9b2452a (9b2452a16c96d1400ea39516640ae5d790e83c2c)
Verdict: **PASS WITH NOTES**

Checks: typecheck ok · lint ok · tests 135 passed / 0 failed. `format:check` passes, and `check:ids` reports "no duplicates (14 TD, 9 ADR, 0 BUG, 12 block)". I didn't run `build`, because it writes `.next/`. The working tree was still clean afterwards.

This is round 3. I re-read every file the block changed and looked hardest at `39f82a5..9b2452a` (`f8778bf`, `aa7644a`, `9b2452a`). To probe the matcher, I built each candidate command inside a Node script, so the guard judged each one on its own.

**Earlier findings (round 2):**
- **1. Docker options before the subcommand, and `sh -c` steps after a separator:** addressed. All 7 examples have blocked rows that pass, and false-positive rows were added. New variants of the same kind are in Issue 2.
- **2. One secret variable read in the container, and TD-013's indirection:** addressed. `SIGNING_SECRET`, `ENCRYPTION_KEY` (including `$N8N_ENCRYPTION_KEY_FILE`), `process.env` and the shell's listings are blocked. TD-013 is narrowed to the literal mount path. Two of the new shapes have no test rows (Issue 4).
- **3. The fix-block flow from any checkout:** addressed. The prescribed `git log --all --format=%H -1 -- "docs/blocks/002-*.md"` returns `fa6f09f`. The `git ls-tree` step in run-block works. One small gap is in Issue 6.
- **4a. TD-009's case count:** addressed.
- **4b. The registration test's deny paths:** addressed. It checks all 8.
- **4c. The matcher crashing the hook:** addressed. The import sits inside the fail-closed section, and the test runs the hook next to a really broken module. A slow matcher is still a fail-open path (Issue 1).

**Acceptance criteria:**
- Clean clone succeeds on Windows and in CI: PASS. The cited evidence is at `e0c9dea`. I re-ran 5 of the 6 commands at HEAD. The evidence is older than the code change in `f8778bf` (Issue 5).
- `/` shows the name and tagline at 360 and 1280 px: PASS. The UI hasn't changed since the screenshots. I checked the 360 px capture: no overflow.
- `check:ids` passes, and tests prove it fails on duplicates: PASS.
- CI is green on the pushed branch: PASS, on the cited runs up to `e0c9dea`. No run is recorded for HEAD (Issue 5).
- `strict` is on, `any` is an error, zero warnings: PASS.
- No CRLF in the index: PASS. At HEAD, 112 files are `i/lf` and 2 PNGs are `-text`.
- `package.json` is at `0.0.0`: PASS.
- Secret guard: PASS. 61 blocked and 32 allowed rows pass, and so do the entry-point tests (deny, fail-open, load failure). The HEAD hook also blocked one of my commands live during this review. Three §5 cases have no test row (Issue 4).
- TD-009 and TD-012 marked resolved: PASS.

**Architecture and rules:**
- The layout matches architecture.md §3.
- No Convex functions exist yet, so the wrapper, `transition()` and clock rules don't apply.
- The three commits since round 2 follow the conventional format, cite the block and carry the attribution line.
- No other violations found, apart from the doc nits in Issue 6.

**Security and privacy:**
- No secret-shaped strings in tracked files. I searched for Clerk key prefixes, PEM headers and 43-character base64url values, outside the lockfile.
- The guard has one fail-open path (Issue 1) and coverage gaps that contradict §5 (Issues 2 and 3).

**Issues:**

1. **[Minor] A long container command makes the hook time out, so it gives no deny.**
   - **Cause:** the env-dump rule scans the rest of the command lazily (`REST`) and tries `WORD_START(?:\S*\/)?` at every position. On long runs without spaces, that costs time proportional to the square of the length.
   - **Measured** with a `docker compose exec -T n8n sh <<'X'` command carrying minified JSON (all results "allowed"):
     - 72 KB: 0.9–1.2 s;
     - 288 KB: 18.4 s;
     - 1.15 MB: 233 s.
   - **Why it matters:** the hook's timeout is 10 s, so on this machine anything above about 210 KB is killed without a decision. Claude Code treats a killed hook as a non-blocking error, so the command runs, which contradicts §5's fail-closed claim.
   - **`f8778bf` widened it:** with a `;` before the blob, the 72 KB command took 0 ms at `39f82a5` and 881 ms at HEAD.

   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\secret-names.mjs:19,22,35-42`; `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\settings.json:59`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:134-135`

   Recommendation:
   - In the hook, deny commands over a fixed size (for example 64 KiB) with the reason "too long to check; put the data in a file".
   - Or replace the backtracking scan with a linear token check: split the text after the docker match on ``[\s='"(;&|`]`` and test each token against `^(?:.*\/)?(?:printenv|env|environ)$`.
   - Add a test that a 1 MB command gets its decision well within the timeout.

2. **[Minor] Container env reads that §5 calls blocked still get through.** I confirmed each of these returns `null`:
   - **A script piped in before the command:** `echo env | docker compose exec -T n8n sh` (also with `printenv`). The scan only looks after `exec`, and §5's uncovered list names only an interactive shell.
   - **A bare `set` or `export` on its own heredoc line,** as in `… sh <<'X'` then `set`. The lookahead `(?=$|['");&|])` has no newline, and `$` isn't multiline. Also `set >&2`, `set 2>&1 | grep KEY` and `export >/tmp/e`.
   - **Backticks and backslashes:** ``sh -c 'echo `env`'``, `'\env'` and `\printenv`. Neither character is in `WORD_START`.
   - **`~/.n8n/config` by another path:**
     - `sh -c 'cd ~/.n8n && cat config'`;
     - `docker run --rm -v lendloop_n8n_data:/data alpine cat /data/config`;
     - `docker cp lendloop-n8n-1:/home/node/.n8n /tmp/n8n-copy`.

     §5:113 says the file is blocked, but only the literal `.n8n/config` is matched.

   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\secret-names.mjs:16-22,35-56`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:104-113,145-148`

   Recommendation:
   - Check the whole command whenever it contains a docker `exec|run`: put a lookahead at the start, so words before the docker command count too.
   - Add the backtick and the backslash to `WORD_START`.
   - End a bare `set` or `export` with ``[ \t]*(?:-p\b|(?=$|[\n'"<>);&|`]|\d>))``.
   - Block a docker `exec|run|cp` command that mentions `.n8n` and `config` anywhere. Add the n8n data volume's name to TD-013's scope.
   - Add a test row for each.
   - Or, to stop enumerating variants, narrow §5 to the tested shapes and list these classes as uncovered.

3. **[Minor] `findstr -s` gets past the findstr rule.** findstr accepts `-` switches. Inside `src/`, `findstr -s -m LendLoop "*.tsx"` listed files in subdirectories, and the guard allowed it. Run from the root, `findstr -s -i secret *` would read `.env.local`, `.env.n8n` and `.secrets\*`.

   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\secret-names.mjs:97`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:120`

   Recommendation: match `\s[\/-][a-z\/]*s[a-z\/]*\b`, and add a blocked row for `findstr -s -i secret *`.

4. **[Minor] Some §5 cases have no test row.** Probing shows these are blocked today, but no test would fail if they broke:
   - `typeset`;
   - a bare `export`;
   - `docker container exec` (only `docker container inspect` has a row);
   - `n8n export:credentials --decrypted` on the host (§5:115 lists it on its own, but the only row runs it through `docker compose exec`).

   This goes against the criterion's "(Vitest): every … case in security.md §5 holds" and the test file's own "Keep these cases in step with … §5".

   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\secret-names.test.mjs:5-70`

   Recommendation: add blocked rows for `… sh -c typeset`, `… sh -c export`, `docker container exec lendloop-n8n-1 env` and `n8n export:credentials --all --decrypted`.

5. **[Minor] Evidence is older than the last code change.** The clean-clone and CI evidence stops at `e0c9dea`, and the EOL check says "Checked at `e0c9dea`". `f8778bf` then changed the hook and its tests, and `9b2452a` is pushed, but no CI run is recorded for it.

   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\logs\001-completion.md:46,49,51`

   Recommendation: record the CI run for the final reviewed SHA before closing. It's a bookkeeping edit, and close-block's CI check needs it anyway.

6. **[Minor] Nits.**
   - The skills' `git log --all --format=%H -1 -- …` prints only the SHA, but `git show <sha>:<path>` needs the file name. Add `--name-only`. (`D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\skills\resume-block\SKILL.md:37-38`, `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\skills\run-block\SKILL.md:39-40`)
   - Two hand-wrapped docs lines are off. `security.md:4` is about 127 columns. `ADR-009-repository-workflow.md:99-101` leaves a short line: "fields that `npm version` changes. Any".
   - The log's "round-2 and round-3 process changes" is wrong: the process changes came from rounds 1 and 2 (`104c21f`, `aa7644a`). (`D:\Work\Personal\repos\fluenceinternational-lendloop\docs\logs\001-completion.md:197-199`)

**Undocumented deviations:**
- None found. The over-blocking trade-off (a host command chained after a docker command) is stated in §5 and in the commit body.

**Positive observations:**
- Round 2's issue 4c was fixed properly: the dynamic import is inside the fail-closed section, and the test uses a really broken module rather than a mock.
- Every round-2 recommendation was applied as written. False-positive rows cover the shapes the wider scan could over-block: `set -e`, `export X=…`, an `env/` path, and `npm run env:names`.
- The log's counts match the suite: 61 + 32 command rows, and 135 tests in total.
- The HEAD hook works live in a subagent on Windows. It denied my first probe command, because one of its labels contained a container env dump.
