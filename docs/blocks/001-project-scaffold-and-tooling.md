# 001 — Project scaffold and tooling

**Status:** In progress
**Module:** PLT
**Branch:** feature/001-project-scaffold-and-tooling

## Goal
Stand up the Next.js app and the tooling every later block relies on: strict TypeScript, lint and
format, tests, and CI, plus the LendLoop landing shell. No Convex or Clerk yet.

## Dependencies
- Depends on: the planning baseline, which must be **Closed** (its row in `docs/blocks/README.md`).
  Branches from `docs/planning-baseline` while PRs are deferred.
- Depended on by: 002

## Requirements
PUB-1 (shell), QA-1. Also resolves TD-009 and TD-012.

## Inputs
- [architecture.md §3](../architecture.md#3-modules-and-code-layout): code layout.
- [coding-standards](../../.claude/rules/coding-standards.md),
  [testing-standards](../../.claude/rules/testing-standards.md),
  [commit-conventions](../../.claude/rules/commit-conventions.md).
- [ADR-009](../adr/ADR-009-repository-workflow.md): workflow and CI expectations.

## Outputs
- **Next.js 16 app** (App Router, `src/` directory, `@/*` import alias), created with
  `create-next-app`. It is merged with the existing README and `.gitignore`, not written over them.
- **Styling:** Tailwind CSS 4 and shadcn/ui (`components.json`, `src/components/ui/`, light and
  dark tokens).
- **Lint and format:** ESLint flat config (Next.js rules plus `typescript-eslint`) and Prettier.
  Scripts `lint`, `format` and `format:check`. Zero warnings allowed.
- **TypeScript** pinned to the newest version that `typescript-eslint` supports, plus a
  `typecheck` script.
- **Vitest** with two projects:
  - `node`: libraries and scripts;
  - `convex`: edge-runtime environment, ready for `convex-test` in block 002.

  Plus a `test` script.
- **`scripts/check-ids.ts`** (`npm run check:ids`): fails when a TD, BUG or ADR identifier, or a
  block number, is defined twice across `docs/`.
- **CI:** `.github/workflows/ci.yml` runs on **every pushed branch** and on pull requests:
  `npm ci`, typecheck, lint, format:check, test, build, check:ids. The Node version comes from
  `.nvmrc`.
- **PR template:** `.github/pull_request_template.md` (summary, block, acceptance checklist, link
  to the review record, completion log link).
- **Node version:** `.nvmrc` and `package.json` `engines` (Node ≥ 22, which Convex requires).
- **Version:** `package.json` starts at `"version": "0.0.0"`. create-next-app writes `0.1.0`, which
  would make the first release (`npm version 0.1.0` in block 002) fail with "Version not changed".
- **Secret guard hardening** (TD-009, added at the start of this block):
  - the matching logic moves to `.claude/hooks/secret-names.mjs`, which the hook's entry point
    imports, so tests import the logic and the entry point always runs;
  - the hook is registered in a form that doesn't depend on the shell expanding
    `$CLAUDE_PROJECT_DIR`, and its matcher covers every tool that runs shell commands;
  - it also blocks commands that print secrets without naming a secret file:
    - `docker compose config` without `--no-env-resolution`;
    - environment dumps from containers (`printenv` or `env` through `docker exec` or
      `docker compose exec`, and `docker inspect`);
    - recursive text searches that don't respect `.gitignore`;
    - `convex env list` and `convex env get`;
  - names are matched case-insensitively, and the file deny rules are anchored to the project
    root;
  - security.md §5 lists what is covered and what isn't, and block 007's spec gets a names-only
    helper for its container-environment check.
- **Secret guard tests:** Vitest tests for the matching logic (the allowed and blocked cases in
  security.md §5), plus an entry-point test that spawns the hook with JSON on stdin.
- **Process gaps** (TD-012, added at the start of this block):
  - resume-block finds the branch from the spec's Branch line, so `fix/BUG-nnn-*` branches work;
  - create-blocks can write a fix block's spec;
  - close-block's merge step states the planning baseline's CI exemption;
  - bug reports and their status lines join the bookkeeping list.
- **Landing page shell:** the LendLoop name and tagline in a minimal header/footer layout.
- **`.env.example`:** skeleton listing the Next.js variables (filled in during 002).
- **README:** "Development" section with prerequisites and the npm scripts.

## Acceptance Criteria
- [ ] On a clean clone, these all succeed locally (Windows) and in CI (Ubuntu): `npm ci`,
      `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`.
- [ ] `/` shows "LendLoop" and "Borrow what you need. Lend what you don't.", and lays out
      correctly at 360 px and 1280 px wide (manual check, recorded).
- [ ] `npm run check:ids` passes on the repo. A Vitest test proves it fails on fixtures with a
      duplicated TD, ADR or block number.
- [ ] CI runs on this block's pushed branch and is green.
- [ ] `strict` is on in `tsconfig.json`; ESLint forbids `any` and passes with zero warnings.
- [ ] `git ls-files --eol` shows no CRLF line endings in the index.
- [ ] `package.json` is at version `0.0.0`.
- [ ] **Secret guard** (Vitest):
  - every blocked and allowed case in security.md §5 holds;
  - the entry-point test gets the deny decision for a blocked command, and malformed input fails
    open with a warning.

  A live probe from Claude Code is blocked (recorded).
- [ ] TD-009 and TD-012 are marked resolved in `docs/tech-debt.md`.

## Known Constraints
- TypeScript 7.0 is the latest release, but `typescript-eslint` 8.72 requires `<6.1.0`. Verify,
  pin, and record the choice in the completion log
  ([architecture.md §16](../architecture.md#16-open-verification-items)).
- Convex and Clerk packages are not added yet. The lint rule for Convex wrappers arrives with
  `convex/` in block 002.
