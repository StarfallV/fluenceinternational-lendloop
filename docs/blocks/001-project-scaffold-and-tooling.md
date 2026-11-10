# 001 — Project scaffold and tooling

**Status:** Planned
**Module:** PLT
**Branch:** feature/001-project-scaffold-and-tooling

## Goal
Stand up the Next.js app and the tooling every later block relies on: strict TypeScript, lint and
format, tests, and CI, plus the LendLoop landing shell. No Convex or Clerk yet.

## Dependencies
- Depends on: None
- Depended on by: 002 (and transitively every block)

## Requirements
PUB-1 (shell), QA-1.

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
- **CI:** `.github/workflows/ci.yml` runs on pull requests and on pushes to `main`:
  `npm ci`, typecheck, lint, format:check, test, build, check:ids. The Node version comes from
  `.nvmrc`.
- **PR template:** `.github/pull_request_template.md` (summary, block, acceptance checklist,
  review verdict, completion log link).
- **Node version:** `.nvmrc` and `package.json` `engines` (Node ≥ 22, which Convex requires).
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
- [ ] CI runs on this block's PR and is green.
- [ ] `strict` is on in `tsconfig.json`; ESLint forbids `any` and passes with zero warnings.
- [ ] `git ls-files --eol` shows no CRLF line endings in the index.

## Known Constraints
- TypeScript 7.0 is the latest release, but `typescript-eslint` 8.72 requires `<6.1.0`. Verify,
  pin, and record the choice in the completion log
  ([architecture.md §16](../architecture.md#16-open-verification-items)).
- Convex and Clerk packages are not added yet. The lint rule for Convex wrappers arrives with
  `convex/` in block 002.
