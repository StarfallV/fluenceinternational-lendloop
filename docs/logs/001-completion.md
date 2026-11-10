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
  - Vitest, with a `node` project and an edge-runtime `convex` project.
- **`npm run check:ids`:** finds duplicate TD, ADR and BUG identifiers and block numbers, plus
  ADRs titled with another number. It has fixtures and tests.
- **CI:** on every pushed branch and pull request (`npm ci`, typecheck, lint, format:check, test,
  build, check:ids), with Node from `.nvmrc` (24). Also a PR template.
- **Project files:** `package.json` at `0.0.0` with `engines` set to node ≥ 22; `.env.example`;
  the README's Development section.
- **Secret guard, hardened (TD-009):**
  - the matching logic lives in its own module, with 45 command cases and entry-point tests;
  - the hook is registered in exec form for Bash, PowerShell and Monitor;
  - it blocks the commands that print secrets without naming a file;
  - names match case-insensitively;
  - the file deny rules are anchored to the project root.
- **Process gaps (TD-012):** fix blocks, the baseline PR's missing CI, and bug reports as
  bookkeeping.

## Acceptance criteria
| Criterion | Result | Evidence |
| --- | --- | --- |
| On a clean clone, `npm ci`, typecheck, lint, format:check, test and build succeed on Windows and in CI | PASS | Manual (Windows): `e4621dd` cloned into a scratch directory, Windows 10, Node 24.20.0. All seven CI steps succeeded. CI (Ubuntu): [run 42889364207](https://github.com/StarfallV/fluenceinternational-lendloop/actions/runs/42889364207) on `e4621dd`, success. |
| `/` shows the name and tagline, and lays out correctly at 360 px and 1280 px | PASS | Manual: the production build served locally, captured with headless Chrome at 1280 × 800 and in a 360 px-wide iframe. A direct 360 px capture is cropped, because the headless window has a minimum width. The name, tagline and description fit, with 16 px gutters and no horizontal overflow. Screenshots: [360 px](assets/001-landing-360.png), [1280 px](assets/001-landing-1280.png). |
| `check:ids` passes on the repository; a test proves it fails on duplicated TD, ADR or block numbers | PASS | `npm run check:ids` reports "no duplicates (12 TD, 9 ADR, 0 BUG, 12 block)". Tests: `npm run check:ids › exits 1 and names the duplicate for duplicate-td / duplicate-adr / duplicate-bug / duplicate-block`; `checkIds › reports … with every location`; `checkIds › passes on this repository's docs`; `checkIds › reports an ADR file whose title names another number`. |
| CI runs on this block's pushed branch and is green | PASS | Runs on `a858391` and `e4621dd` both succeeded (latest: run 42889364207). |
| `strict` is on; ESLint forbids `any` and passes with zero warnings | PASS | `tsconfig.json` has `"strict": true`. `eslint.config.mjs` sets `@typescript-eslint/no-explicit-any` to error, and lint runs with `--max-warnings=0`. Manual: a probe file using `any` and `!` failed with 2 errors (the probe was then removed). |
| `git ls-files --eol` shows no CRLF in the index | PASS | All 101 tracked files are `i/lf` (checked at `e4621dd`). |
| `package.json` is at version `0.0.0` | PASS | `package.json` |
| Secret guard (Vitest): every case in security.md §5 holds; the entry-point test gets the deny; malformed input fails open with a warning; a live probe is blocked | PASS | Tests: `findSecretAccess › blocks %s` (26 cases), `findSecretAccess › allows %s` (18), `secretNamesIn › lists each secret file a command names, but not the templates`, `guard-secrets hook › denies a %s command that names a secret file` (Bash, PowerShell, Monitor), `… › denies a command that prints secrets without naming a file`, `… › allows a harmless command with no output`, `… › fails open with a warning when its input is unreadable`. Manual: live probes from Claude Code were blocked: a `diff` naming `.env.local`, `docker compose config`, and a recursive PowerShell `Select-String`. A Read of `.env.local` was denied by the root-anchored rule. |
| TD-009 and TD-012 are marked resolved | PASS | `docs/tech-debt.md`, resolution lines on both items |

## Deviations from spec
- **Scope:** TD-009 and TD-012 were added at the start of the block, because both were planned
  for it when the planning baseline closed. The spec was updated first, in `5335d46`.
- **Vitest config:** it is `vitest.config.mts`, not `.ts`, because Vite 8 warns about ESM syntax
  in a config loaded as CommonJS.

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

## ADRs created
None.

## Tech debt recorded
None. TD-009 and TD-012 were resolved.

## Verification items resolved
- **TypeScript** (architecture.md §16, block 001): `typescript-eslint` 8.72.2 requires
  `typescript >=4.8.4 <6.1.0`, and create-next-app 16.4.6 installs `^5`, so TypeScript is pinned
  to 6.0.3.
- **Not in §16, needed for TD-009:** hook exec form, root-anchored permission paths, and Monitor
  coverage, as listed under "Decisions made".

## Review items addressed
Pending review.

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
  with `git commit -F <file>`. The static deny rules also match whole compound commands, so split
  a command that pipes into `tail` and then stages `.env.example` (session norms).
- **Skill text:** this session loaded the run-block skill text cached at session start, which
  predated the round-2 and round-3 process changes. I followed the repository's current
  `SKILL.md`. In a new session the cached copy is current.
