# Block 001 — review round 1

**Reviewed commit:** ceb3300 · **Range:** docs/planning-baseline...ceb3300 · **Date:** 2026-11-11
**Reviewer:** fresh read-only agent (`block-reviewer`) · **Verdict:** PASS WITH NOTES

---

=== Review: 001 ===
Base: origin/docs/planning-baseline (410e0cc) · Head: ceb3300 (ceb33008a86bcb0a7514f1cb7008c1776d290c35)
Verdict: **PASS WITH NOTES**

Checks: typecheck ok · lint ok · tests 63 passed / 0 failed. format:check and check:ids also pass ("12 TD, 9 ADR, 0 BUG, 12 block"). I didn't run build because it writes `.next/`. The working tree was still clean afterwards. The secret guard is live in subagents on Windows: it denied a recursive `grep` I ran during this review.

**Earlier findings** (no earlier 001 records; these are the planning round-4 findings sent here through TD-009 and TD-012):
- New 4 (the guard could be switched off): **addressed.** The hook is registered in exec form, the entry guard is gone, Monitor is in the matcher, and an entry-point test exists. Monitor wasn't probed live (Issue 3).
- New 5 (commands that print secrets): **addressed** for every listed shape. Close variants still get through (Issues 1 and 2).
- New 8 (fix blocks, the baseline PR, bug reports): **addressed.** Where a fix-block spec gets committed is still unstated (Issue 7).

**Acceptance criteria:**
- Clean clone succeeds on Windows and in CI: PASS. Evidence is in the log, and I re-ran five of the six commands at HEAD (all except build).
- `/` shows the name and tagline at 360 and 1280 px: PASS. I checked both screenshots: no overflow, 16 px gutters.
- check:ids passes on the repo, and a test fails it on duplicates: PASS (CLI exits 1 for the TD, ADR, BUG and block fixtures).
- CI is green on the pushed branch: PASS, on the cited runs for a858391 and e4621dd. I couldn't re-check them read-only; the merge gate will.
- `strict` is on, `any` is an error, zero warnings: PASS.
- No CRLF in the index: PASS. 102 files are `i/lf` and the 2 PNGs are binary.
- `package.json` is at 0.0.0: PASS.
- Secret guard: PASS. Every example in security.md §5 holds, the entry point returns the deny, and bad input fails open with a warning. This covers the listed examples only.
- TD-009 and TD-012 marked resolved: PASS.

**Architecture and rules:**
- The layout matches architecture.md §3.
- No Convex code yet, so the wrapper, `transition()` and clock rules don't apply.
- Commit-convention violations are in Issue 5.

**Security and privacy:**
- No secrets or secret-shaped strings in tracked files. The `.env.example` values are empty.
- `.gitignore` covers every `.env*` file except the two templates.
- CI runs with `contents: read`.
- The guard's gaps are Issues 1–3.

**Issues:**

1. **[Minor] Close variants of the "blocked" commands get through the guard.** All 10 of these returned `null` from `findSecretAccess`:
   - `docker-compose exec n8n printenv`
   - `docker exec lendloop-n8n-1 /usr/bin/env`
   - `docker compose run --rm --entrypoint printenv n8n`
   - `docker compose convert` (an alias of `config` in Compose v2)
   - `findstr /si secret *`
   - `rg --unrestricted --unrestricted X`
   - `rg -nuu X`
   - `grep --directories=recurse X .`
   - `git grep --no-index X`. Without the index, git doesn't apply `.gitignore` by default, yet security.md:112 says `git grep` respects it.
   - `Get-ChildItem -Recurse | sls X`

   This isn't a criterion failure, because the criterion covers only the listed cases.
   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\secret-names.mjs:14,18,27,31,35-36,40`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:101-113`
   Recommendation:
   - Add `-compose` and `run` to the exec pattern, and allow a path before the command: `(?:\S*\/)?(?:printenv|env)`.
   - Match `config|convert`.
   - Add `-d recurse` and `--directories=recurse` to the grep pattern.
   - Match `--unrestricted` and short-flag clusters containing a lowercase `u` (case-sensitive, because `-U` is multiline).
   - Accept combined findstr switches: `\/[a-z]*s[a-z]*\b`.
   - Add `sls` as an alias of Select-String.
   - Block `git grep` with `--no-index` or `--no-exclude-standard`.
   - Add a test row for each, and update §5.

2. **[Minor] Reading secrets inside a container is neither blocked nor listed as uncovered.** `docker compose exec n8n cat /home/node/.n8n/config` prints the n8n encryption key, which is the exact file block 007's hash check works with. The in-container path of the mounted key file has no `.secrets` in it, so the name match misses it. `n8n export:credentials --decrypted` prints the SMTP credentials. The "doesn't cover" list mentions only "a shell started inside a container".
   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:121-124`
   Recommendation:
   - Now: add "files read inside a container" to the "doesn't cover" list. Also block `docker … (exec|run|cp)` commands that mention `.n8n/config`, since the n8n image fixes that path.
   - Record a TD for block 007 to cover the key-mount path once `compose.yml` defines it.

3. **[Minor] Monitor coverage is assumed, not shown.**
   - If `tool_input.command` isn't a string, the hook allows the command with no warning at all.
   - The Monitor case in the entry-point test proves nothing specific, because the hook ignores `tool_name`.
   - No live Monitor probe is recorded.
   - Nothing tests the registration: the matcher, `command: "node"`, and the `args` path.
   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\guard-secrets.mjs:20`; `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\hooks\guard-secrets.test.mjs:18-29`
   Recommendation:
   - Warn on stderr and exit 1 when the command field is missing.
   - Probe Monitor live and record the result.
   - Add a test that parses `.claude/settings.json` and asserts:
     - the matcher matches Bash, PowerShell and Monitor;
     - the args path, with `${CLAUDE_PROJECT_DIR}` set to the repo root, exists.

4. **[Minor] The Node floor is understated.** `engines.node` is `">=22"`, but the toolchain needs 22.12:
   - vitest 5.1.0 requires `^22.12.0 || ^24.0.0 || >=26.0.0`;
   - vite 8.3.7 and rolldown 1.2.18 require `>=22.12.0`.

   So Node 22.0–22.11 and Node 25 are accepted but unsupported.
   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\package.json:7`; `D:\Work\Personal\repos\fluenceinternational-lendloop\README.md:18`; `D:\Work\Personal\repos\fluenceinternational-lendloop\CLAUDE.md:44`; `D:\Work\Personal\repos\fluenceinternational-lendloop\docs\blocks\001-project-scaffold-and-tooling.md:47`
   Recommendation: set `"^22.12.0 || ^24.0.0 || >=26.0.0"`. Update the README, `CLAUDE.md` and the spec first, under "When the spec is wrong", and record it as a deviation.

5. **[Minor] Three commits fail their own scripts, and one has the wrong type.**
   - **Failing scripts:** `test` and `check:ids` were declared in 658ceec, but vitest, tsx and `scripts/check-ids.ts` only arrive in ab2f9fe. Prettier arrives in bcdb8c5.
   - **Effect:** `npm test` and `check:ids` fail at 658ceec, bcdb8c5 and a8e16a1, and `format:check` fails at 658ceec. That breaks "every commit … passes its tests" and QA-1.
   - **Commit type:** ab2f9fe is typed `test:`, but it adds the check:ids tool and dependencies. `test` means "Tests only".
   Location: commits 658ceec, bcdb8c5, a8e16a1, ab2f9fe
   Recommendation: don't rebase. Record this under Deviations in the completion log. In later blocks, add each script in the same commit as its tool.

6. **[Minor] The PR template's merge-gate link breaks in a PR.** `../.claude/rules/delivery-blocks.md#merge-gate` is relative, and GitHub doesn't rewrite relative links in PR bodies, so it resolves to `/<owner>/<repo>/.claude/...` and 404s.
   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.github\pull_request_template.md:13`
   Recommendation: use an absolute `blob/main/...` URL, or a plain path in backticks.

7. **[Minor] The skills don't say where a fix-block spec gets committed.**
   - `main` changes only through PRs, and block 012's branch will be Closed, so neither can take the spec.
   - run-block reads the spec's Branch line before the branch exists, then reads the spec on the new branch. That works only if the spec is carried over uncommitted, and nothing says so.
   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\skills\create-blocks\SKILL.md:37-39`; `D:\Work\Personal\repos\fluenceinternational-lendloop\.claude\skills\run-block\SKILL.md:50-60`
   Recommendation: state it. Leave the fix-block spec and its index rows uncommitted, run `/run-block NNN`, and its `docs: start block NNN` commit adds them on the fix branch.

8. **[Minor] check:ids fails open, and some paths are untested.**
   - If `docs/` is missing or the command runs from the wrong directory, it prints "no duplicates (0 TD, 0 ADR, 0 BUG, 0 block)" and exits 0.
   - The CLI test doesn't cover a mistitled ADR causing exit 1.
   - The `convex` Vitest project has never run a test, so "ready for convex-test" is unverified.
   Location: `D:\Work\Personal\repos\fluenceinternational-lendloop\scripts\check-ids.ts:7,16-23`; `D:\Work\Personal\repos\fluenceinternational-lendloop\scripts\check-ids.test.ts:23-31`; `D:\Work\Personal\repos\fluenceinternational-lendloop\vitest.config.mts:13-20`
   Recommendation:
   - Exit 1 when `docs/` or `tech-debt.md` is missing, or when no definitions are found.
   - Add a CLI case for the mistitled-ADR fixture.

9. **[Minor] Documentation and convention nits.**
   - **ADR-009:** its paraphrase of the bookkeeping list now leaves out bug reports (`D:\Work\Personal\repos\fluenceinternational-lendloop\docs\adr\ADR-009-repository-workflow.md:96-100`).
   - **security.md status line:** it still says Baseline v1.3, although §5 was rewritten (`D:\Work\Personal\repos\fluenceinternational-lendloop\docs\security.md:3`).
   - **Templates:** §5 says the hook allows the templates, but the static `Bash(cat *.env*)` rule denies `cat .env.example` anyway. Say to read templates with the Read tool.
   - **Dependency reasons:** the completion log gives none for `lucide-react` (unused), `tw-animate-css`, `class-variance-authority`, `@base-ui/react`, `shadcn` as a runtime dependency, `vite` (a required peer of vitest), `@edge-runtime/vm` or `tsx`.
   - **Template comment:** `/* config options here */` is still in `D:\Work\Personal\repos\fluenceinternational-lendloop\next.config.ts:4`.

**Undocumented deviations:**
- TD-009's planned names-only helper script wasn't built. It moved into block 007's spec in f6e2369. The spec and the TD resolution line say so, but the completion log's Deviations and Decisions sections don't.
- e8b95e5 added a rule to `session-norms.md` that isn't in the spec's Outputs. The log mentions it only under Notes.

**Positive observations:**
- The hook refactor removes the entry guard entirely. The entry-point tests spawn the real script, and the registration was proven live during this review.
- I confirmed the toolchain claims against the installed packages: TypeScript 6.0.3 is inside typescript-eslint 8.72.2's `<6.1.0` range; `allowScripts` is documented by npm 11.19; only esbuild and fsevents have install scripts.
- The completion log's evidence is precise: test names, run IDs, screenshots, and the count of 45 command cases.
