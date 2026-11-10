# Completion Log — 001 Project scaffold and tooling

**Date:** 2026-11-11
**Status:** Complete
**Branch:** feature/001-project-scaffold-and-tooling (base: docs/planning-baseline)

## What was built
- **App:** a Next.js 16.4.6 app (App Router, `src/`, `@/*`), React 19.3, created with
  create-next-app and merged into the repository. Two pieces are kept from the template:
  - `AGENTS.md`, which points coding agents to the Next.js docs bundled with the installed
    version;
  - its Cache Components and Partial Prefetching defaults.
- **Landing shell:** the `(public)` route group holds the header wordmark, the LendLoop name and
  tagline, and a footer. Styling is Tailwind CSS 4 and shadcn/ui 4.23 (`base-nova` on Base UI,
  light and dark tokens, the Button primitive).
- **Tooling:**
  - TypeScript pinned to 6.0.3, in strict mode;
  - ESLint flat config (Next.js rules and `typescript-eslint`), with `any` and non-null
    assertions as errors and zero warnings allowed;
  - Prettier, with the Tailwind plugin;
  - Vitest, with a `node` project and an edge-runtime `convex` project. A first test proves the
    `convex` project runs in the edge runtime.
- **`npm run check:ids`:** finds duplicate TD, ADR and BUG identifiers and block numbers, plus
  ADRs titled with another number. It fails closed: a missing `docs/` or `tech-debt.md`, or no
  identifiers at all, exits 1. It has fixtures and tests.
- **CI:** on every pushed branch and pull request (`npm ci`, typecheck, lint, format:check, test,
  build, check:ids), with Node from `.nvmrc` (24). Also a PR template.
- **Project files:** `package.json` at `0.0.0` with `engines` set to
  `^22.13.0 || ^24.0.0 || >=26.0.0`; `.env.example`; the README's Development section.
- **Secret guard, hardened (TD-009, then review rounds 1 and 2):**
  - the matching logic lives in its own module, with 93 command cases and entry-point tests. The
    hook loads it dynamically, so a matcher that fails to load denies;
  - the hook is registered in exec form for Bash, PowerShell and Monitor, and a test checks that
    registration;
  - it blocks the commands that print secrets without naming a file, including the close
    variants the reviews found; in containers, whole-environment dumps, single secrets read by
    variable name, and n8n's `~/.n8n/config`; and decrypted credential exports;
  - names match case-insensitively;
  - the file deny rules are anchored to the project root.
- **Process gaps (TD-012):** fix blocks, the baseline PR's missing CI, and bug reports as
  bookkeeping.

## Acceptance criteria
| Criterion | Result | Evidence |
| --- | --- | --- |
| On a clean clone, `npm ci`, typecheck, lint, format:check, test and build succeed on Windows and in CI | PASS | Manual (Windows): `e4621dd` cloned into a scratch directory, Windows 10, Node 24.20.0. All seven CI steps succeeded. CI (Ubuntu): [run 42889364207](https://github.com/StarfallV/fluenceinternational-lendloop/actions/runs/42889364207) on `e4621dd`, success. After the review round 1 fixes: `e0c9dea` cloned the same way, all seven steps succeeded; CI [run 42896760027](https://github.com/StarfallV/fluenceinternational-lendloop/actions/runs/42896760027) on `e0c9dea`, success. |
| `/` shows the name and tagline, and lays out correctly at 360 px and 1280 px | PASS | Manual: the production build served locally, captured with headless Chrome at 1280 × 800 and in a 360 px-wide iframe. A direct 360 px capture is cropped, because the headless window has a minimum width. The name, tagline and description fit, with 16 px gutters and no horizontal overflow. Screenshots: [360 px](assets/001-landing-360.png), [1280 px](assets/001-landing-1280.png). |
| `check:ids` passes on the repository; a test proves it fails on duplicated TD, ADR or block numbers | PASS | `npm run check:ids` reports "no duplicates (14 TD, 9 ADR, 0 BUG, 12 block)". Tests: `npm run check:ids › exits 1 and names the duplicate for duplicate-td / duplicate-adr / duplicate-bug / duplicate-block`; `… › exits 1 and names an ADR file titled with another number`; `… › exits 1 when the docs define no identifiers`; `… › exits 1 when run from a directory without docs/`; `checkIds › reports … with every location`; `checkIds › passes on this repository's docs`; `checkIds › reports an ADR file whose title names another number`; `checkIds › reports a docs directory that doesn't exist / without tech-debt.md / that defines no identifiers`. |
| CI runs on this block's pushed branch and is green | PASS | Runs on `a858391`, `e4621dd` and `e0c9dea` all succeeded (latest: run 42896760027). |
| `strict` is on; ESLint forbids `any` and passes with zero warnings | PASS | `tsconfig.json` has `"strict": true`. `eslint.config.mjs` sets `@typescript-eslint/no-explicit-any` to error, and lint runs with `--max-warnings=0`. Manual: a probe file using `any` and `!` failed with 2 errors (the probe was then removed). |
| `git ls-files --eol` shows no CRLF in the index | PASS | All 111 text files are `i/lf`; the other 2 are the PNG screenshots (`i/-text`). Checked at `e0c9dea`. |
| `package.json` is at version `0.0.0` | PASS | `package.json` |
| Secret guard (Vitest): every case in security.md §5 holds; the entry-point test gets the deny; malformed input fails open with a warning; a live probe is blocked | PASS | Tests: `findSecretAccess › blocks %s` (61 cases), `findSecretAccess › allows %s` (32), `secretNamesIn › lists each secret file a command names, but not the templates`, `guard-secrets hook › denies a %s command that names a secret file` (Bash, PowerShell, Monitor), `… › denies a command that prints secrets without naming a file`, `… › allows a harmless command with no output`, `… › fails open with a warning when its input is unreadable`, `… › fails open with a warning when the tool call has no command`, `… › denies every command when its matcher fails to load`, `… › allows a Monitor WebSocket watch, which runs no command, without a warning`; `.claude/settings.json › registers the secret guard once, in exec form`, `… › runs the guard before every %s call` (Bash, PowerShell, Monitor), `… › points the guard at the hook file once CLAUDE_PROJECT_DIR is substituted`, `… › denies reading and editing %s` (all 8 paths). Manual: live probes from Claude Code were blocked: a `diff` naming `.env.local`, `docker compose config`, and a recursive PowerShell `Select-String`. A Read of `.env.local` was denied by the root-anchored rule. After review round 1, a live **Monitor** probe (`echo probe .env.local`, harmless if it had run) was denied: "PreToolUse:Monitor hook error: Blocked: the command names a secret file (.env.local)". |
| TD-009 and TD-012 are marked resolved | PASS | `docs/tech-debt.md`, resolution lines on both items |

## Deviations from spec
- **Scope:** TD-009 and TD-012 were added at the start of the block, because both were planned
  for it when the planning baseline closed. The spec was updated first, in `5335d46`.
- **Vitest config:** it is `vitest.config.mts`, not `.ts`, because Vite 8 warns about ESM syntax
  in a config loaded as CommonJS.
- **TD-009's names-only helper wasn't built here.** TD-009 planned "a names-only helper script for
  block 007's container-environment check". It moved into block 007's spec as
  `scripts/env-names.ts` (`f6e2369`), because the container and its environment arrive there. The
  TD-009 resolution line says so.
- **A session-norms rule outside the spec's Outputs:** `e8b95e5` added the rule about compound
  commands and the static deny rules to `.claude/rules/session-norms.md`, after a deny during this
  block showed the gap.
- **Commits that don't pass their own scripts** (review round 1, issue 5): `658ceec` declared the
  `test` and `check:ids` scripts before Vitest, tsx and `scripts/check-ids.ts` arrived in
  `ab2f9fe`, and `format:check` before Prettier arrived in `bcdb8c5`. So `npm test` and
  `check:ids` fail at `658ceec`, `bcdb8c5` and `a8e16a1`, and `format:check` fails at `658ceec`,
  against "every commit … passes its tests". Also, `ab2f9fe` is typed `test:` although it adds
  the check:ids tool and its dependencies. Pushed history isn't rebased (commit-conventions
  rule), so this stays on record. From block 002 on, each script lands in the commit that adds
  its tool.
- **Node floor** (review round 1, issue 4): the spec said Node ≥ 22. The installed toolchain
  needs `^22.13.0 || ^24.0.0 || >=26.0.0`, so the spec was corrected first, then `engines`, the
  README and `CLAUDE.md` (`6dd276b`).

## Decisions made
- **TypeScript 6.0.3**, pinned exactly. create-next-app 16.4.6 installs `typescript ^5`, but the
  newest version `typescript-eslint` 8.72.2 supports is `<6.1.0`.
- **`@types/node ^22`** matches the `engines` floor (Convex needs Node 22), so Node 24-only APIs
  aren't used by accident. CI and `.nvmrc` use Node 24.
- **ESLint stays on the template's `^9`.** Version 10 would risk peer conflicts in the plugins
  that `eslint-config-next` bundles.
- **Template defaults:** Cache Components and Partial Prefetching stay on. Block 002 checks the
  Clerk and Convex providers under them (Notes).
- **`AGENTS.md` is committed.** `next dev` creates or updates it whenever it detects a coding
  agent, so committing it keeps the tree clean. It only points to the Next.js docs bundled in
  `node_modules/next/dist/docs/`, and `CLAUDE.md` now links it.
- **shadcn/ui defaults.** I took them (`base-nova`, Base UI) rather than the older Radix style.
  Its `cn` helper comes from the `cn` npm package, which shadcn publishes: maintainer shadcn,
  repository `shadcn-ui/cn`. No new package runs install scripts.
- **npm 11 install-script gating:** esbuild's `postinstall`, a binary optimization that `tsx` and
  Vitest don't need, is explicitly denied in `package.json` `allowScripts`.
- **Prettier:** 100 columns and the Tailwind class-order plugin. Markdown is excluded, because the
  docs are hand-wrapped and Prettier would pad every table.
- **`.gitignore`:** every `.env*` file is ignored except the two templates, because Next.js also
  loads `.env.development`, `.env.production` and `.env.test`.
- **`check:ids` definitions:** a TD is defined by its heading in `tech-debt.md`, and ADRs, bugs
  and blocks by their file names. An ADR whose title names another number is also reported.
  Logic and CLI are separate modules, so tests import the logic and spawn the CLI.
- **Guard failure modes:** unreadable hook input fails open, with a visible warning, so a
  protocol problem doesn't lock the session. An error in the matching itself denies.
- **Hook facts, checked against the Claude Code docs before building:**
  - exec form (`command` plus `args`, no shell);
  - `/` anchors permission paths to the project root, while `./` follows the current directory;
  - a `Bash` matcher also covers Monitor;
  - the deny JSON format.

  The exec form's `${CLAUDE_PROJECT_DIR}` substitution was then confirmed live.
- **Dependencies** (review round 1, issue 9, which found reasons missing):
  - `@base-ui/react`, `class-variance-authority`, `cn` and `tw-animate-css`: what shadcn/ui's
    `base-nova` style needs. Base UI provides the primitives, cva the component variants, `cn`
    the class merging, and `tw-animate-css` the animation utilities its components use.
  - `lucide-react`: the icon library set in `components.json`. Nothing uses it yet; the
    components added from block 003 on do, and shadcn's generated code imports it.
  - `shadcn`: the app needs only its build-time `shadcn/tailwind.css`, so it moved to
    devDependencies after review round 1 (`826782d`). That also takes its CLI's advisories out of
    the production tree (TD-014).
  - `vite`: a required peer dependency of Vitest 5.
  - `@edge-runtime/vm`: Vitest's `edge-runtime` environment, which the `convex` project uses.
  - `tsx`: runs the TypeScript scripts in `scripts/` on every OS (coding standards).
- **Missing `command` field:** the hook fails open with a warning, like unreadable input, because
  it means Claude Code's protocol changed. Monitor's WebSocket form (`ws`, no `command`) is allowed
  without a warning, since it runs no shell command.
- **check:ids fails closed:** a missing `docs/` or `tech-debt.md`, or no identifiers at all, is a
  problem, so a run from the wrong directory can't pass. Each duplicate fixture got a
  `tech-debt.md`, so it fails for one reason only.

## ADRs created
None.

## Tech debt recorded
- TD-013 — The secret guard doesn't know the n8n key file's path inside the container (block 007)
- TD-014 — The shadcn CLI's dependencies have open advisories

TD-009 and TD-012 were resolved.

## Verification items resolved
- **TypeScript** (architecture.md §16, block 001): `typescript-eslint` 8.72.2 requires
  `typescript >=4.8.4 <6.1.0`, and create-next-app 16.4.6 installs `^5`, so TypeScript is pinned
  to 6.0.3.
- **Not in §16, needed for TD-009:** hook exec form, root-anchored permission paths, and Monitor
  coverage, as listed under "Decisions made".

## Review items addressed
[Round 1](../reviews/001-review-1.md): PASS WITH NOTES. Every note was fixed in this block, so
round 2 reviews the fixes.

| Finding | Outcome |
| --- | --- |
| 1. Close variants of the blocked commands get through | Fixed (`453a24d`): all 10 variants, plus siblings (`rgrep`, `/proc/<pid>/environ`, quoted `sh -c`, `--entrypoint=`, abbreviated grep options, `gci -r`, `-Depth`), each with a test row; false-positive rows for `rg -U`, `ConvertFrom-Json -Depth`, `git diff --no-index` and n8n's own commands. security.md §5 updated. |
| 2. Reading secrets inside a container | Fixed (`453a24d`): reads or copies of `~/.n8n/config` and `export:credentials --decrypted` are blocked; §5 lists files read inside a container as uncovered. The mounted key file's path is recorded as TD-013, which block 007's spec now carries. |
| 3. Monitor coverage assumed | Fixed (`453a24d`): a missing `command` warns and exits 1 (except Monitor's `ws` form); `settings.test.mjs` checks the registration; a live Monitor probe was denied (Acceptance criteria). |
| 4. The Node floor is understated | Fixed (`6dd276b`): `^22.13.0 \|\| ^24.0.0 \|\| >=26.0.0`. The reviewer's 22.12 was raised to 22.13, because `eslint-visitor-keys` 5 needs it. Spec, README and `CLAUDE.md` updated. |
| 5. Commits that fail their own scripts; a `test:` commit that adds a tool | Recorded under Deviations; history isn't rebased. |
| 6. The PR template's relative link | Fixed (`104c21f`): absolute `blob/main` URL. |
| 7. Where a fix-block spec gets committed | Fixed (`104c21f`): create-blocks, run-block and report-bug say the spec, bug report and index rows stay uncommitted until run-block's start commit. |
| 8. check:ids fails open; untested paths | Fixed (`63f4bf2`): it fails closed, with CLI cases for a mistitled ADR, no identifiers and a run outside the repository; a first `convex`-project test proves the edge runtime. |
| 9. Documentation and convention nits | Fixed: ADR-009's bookkeeping summary (`104c21f`); security.md status line and the templates note (`453a24d`); dependency reasons (Decisions); the template comment in `next.config.ts` (`826782d`). |
| Undocumented deviations: the names-only helper; the session-norms rule | Recorded under Deviations. |

[Round 2](../reviews/001-review-2.md): PASS WITH NOTES. It confirmed every round-1 item
addressed. Its notes were fixed in this block too, so round 3 reviews them.

| Finding | Outcome |
| --- | --- |
| 1. Docker forms with options before the subcommand, and `sh -c` steps after a separator, get through | Fixed (`f8778bf`): the container and `inspect` rules accept options before the subcommand, like the `config` rule, and check the rest of the whole command. A test row for each example; false-positive rows for `set -e`, `export X=…`, an `env/` path and `npm run env:names`. |
| 2. One secret variable read in the container; TD-013 misses the key-file indirection | Fixed (`f8778bf`): `SIGNING_SECRET` and `ENCRYPTION_KEY` variables (which covers `$N8N_ENCRYPTION_KEY_FILE`), `process.env`, and the shell's listings (`set`, `export`, `export -p`, `declare`, `typeset`) are blocked. TD-013 now covers only the literal mount path, and §5 states the line. |
| 3. The fix-block flow only works from the base checkout | Fixed (`aa7644a`): resume-block and run-block find a spec outside the checkout with `git log --all` and `git show` (tried on block 002's spec); create-blocks and report-bug write a fix block's files on its base, and run-block switches from there. |
| 4a. TD-009's resolution line says 45 cases | Fixed (`f8778bf`): it gives both counts and the registration test. |
| 4b. The registration test checks 5 of 8 deny paths | Fixed (`f8778bf`): all 8. |
| 4c. A matcher that fails to load crashes the hook, so commands run | Fixed (`f8778bf`): the hook imports the matcher dynamically and denies when it fails to load; `guard-secrets hook › denies every command when its matcher fails to load` runs a copy of the hook next to a broken matcher. |

## Notes for the next block
- **Before block 002, the developer:**
  - creates a Clerk application with the Convex integration on and first and last names
    required;
  - puts its keys in `.env.local`;
  - logs in when `npx convex dev` first runs.
- **Cache Components is on.** Check that `ClerkProvider` and the Convex client provider work under
  it; Clerk may need a Suspense boundary or its dynamic mode. Otherwise turn it off in
  `next.config.ts` and record why.
- **The landing page lives in `src/app/(public)/`.** The "Sign in to lend or borrow" button
  (PUB-3) belongs in that page or its header.
- **Commit messages:** when one names a secret file or a command shape the guard blocks, commit
  with `git commit -F <file>`, and write that file with the Write tool: a heredoc puts the text
  back into the command, and the guard blocks it. The static deny rules also match whole compound
  commands, so split a command that pipes into `tail` and then stages `.env.example` (session
  norms).
- **Scripts land with their tools:** add each npm script in the commit that adds its tool, so
  every commit passes its own scripts (review round 1, issue 5).
- **TD-013 is block 007's:** add the key file's in-container path to the guard once
  `compose.yml` fixes it.
- **Skill text:** this session loaded the run-block skill text cached at session start, which
  predated the round-2 and round-3 process changes. I followed the repository's current
  `SKILL.md`. In a new session the cached copy is current.
