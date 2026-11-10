# Coding Standards

These apply to all LendLoop code. Where a block's spec is more specific, the spec wins for that
block.

## TypeScript

- `strict` is on. No `any`: use `unknown` and narrow it. No `@ts-ignore`. `@ts-expect-error` only
  with a comment explaining why.
- No non-null assertions (`!`) in production code.
- Derive types from their source instead of redefining shapes: `Doc<"tools">`, `Id<"loans">`,
  `Infer<typeof validator>`, `z.infer<typeof schema>`.
- Named exports. Default exports only where Next.js requires them (pages, layouts, route
  handlers, `proxy.ts`).
- File names:
  - UI files are kebab-case (`tool-card.tsx`), matching shadcn/ui.
  - Convex modules are camelCase, because their path becomes the API path (`convex/loans.ts` →
    `api.loans.*`).

## Convex

- **Wrappers:** build every public function with a wrapper from `convex/lib/functions.ts`. ESLint
  enforces this.
- **Validators:** every function declares `args` validators. Public queries also declare
  `returns`.
- **Thin functions:** registered functions validate, call `convex/model/*`, and return. Business
  rules live in `convex/model/`.
- **Reads:** always through an index (`withIndex`), never `.filter()` over a table scan. Bound
  results with `take` or pagination.
- **Loan status:** changes only through `transition()` in `convex/model/loans.ts`. It enforces the
  state machine and enqueues the outbox event.
- **Errors:** `throw new ConvexError({ code, message })`, with a code from `lib/errors.ts` and a
  message safe to show a user.
- **Environment:** read variables only through `lib/env.ts`, which validates them and reports a
  missing one clearly.
- **Internal functions:** anything called by n8n (through `http.ts`), crons or the CLI is
  internal: `internalQuery`, `internalMutation` or `internalAction`.
- **Dates:** "today" and date arithmetic come only from `lib/dates.ts` (ADR-008).
  - Queries read the time with `readClock(ctx)`. Never call `Date.now()` in a query: its result is
    cached and won't change when the day does.
  - Mutations and actions may compute the time directly.
- **Generated code:** `convex/_generated` is committed and never edited by hand.

## Scripts (`scripts/`)

- Write scripts in TypeScript, run with `tsx`, so they work the same in PowerShell 5.1, Git Bash,
  macOS and Linux.
- Start CLIs through their Node entry point (`process.execPath` plus the package's JS entry),
  never `spawn("npx")` without a shell, which fails on Windows.
- Build JSON arguments inside the script rather than asking users to quote JSON on the command
  line, because PowerShell 5.1 strips the quotes. Expose such operations as npm scripts (for
  example `npm run admin:grant -- <email>`).
- Never print secret values; use the shared redaction helper for anything that might contain one.

## Next.js

- Server Components by default. Add `"use client"` only where hooks or interactivity need it, and
  Convex hooks do.
- The UI never makes a security decision. It may hide a control; Convex enforces the rule.
- Route groups: `(public)` for the landing page, `(app)` for signed-in pages.
- Server data comes from Convex hooks (`useQuery`, `useMutation`, `usePaginatedQuery`), never from
  ad hoc `fetch`.
- Forms use react-hook-form and zod. Their limits come from `convex/lib/domain.ts`, so client and
  server cannot drift.
- Feature UI lives in `src/features/<domain>/`. Shared primitives live in `src/components/ui/`,
  kept as close to shadcn's output as possible.

## Styling

- Tailwind utilities and shadcn tokens. No inline `style` except for computed values.
- Mobile-first. Every view must work at 360 px.

## Errors and logging

- Never swallow an error. Catch one only to add context, to turn it into a typed result, or to
  show a message.
- Log IDs and error codes, never emails, names or payloads.

## Dependencies

- Add a dependency only when it removes real work, and give the reason in the completion log.
- The lockfile pins npm versions. Docker images are pinned by version in `compose.yml`.

## Comments and dead code

- Comments explain why, not what.
- No commented-out code; git keeps history.
- No `TODO` without a tech-debt entry: `// TODO(TD-012): …`.
- `eslint-disable` only for a single line, with the reason on the same line.
