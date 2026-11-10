# LendLoop

A neighborhood tool-lending board. Neighbors list tools, request to borrow each other's tools
for a date range, and get email notifications and overdue reminders from n8n workflows. The
engineering focus is correct access control, a secure and reliable Convex ↔ n8n integration, and
a practical, minimal UX.

## Canonical references

Read these first, in this order:

| Document | Purpose |
| --- | --- |
| [docs/prd.md](docs/prd.md) | Requirements (with IDs), business rules, traceability. The source of truth for scope. |
| [docs/architecture.md](docs/architecture.md) | Components, data model, authorization, loan lifecycle and clock, the integration contract, open verification items (§16) |
| [docs/security.md](docs/security.md) | Threat model, controls, data minimization, secrets, residual risks |
| [docs/adr/](docs/adr/) | Decisions, with the options considered |
| [docs/blocks/](docs/blocks/) | Delivery block specs and their status |
| [docs/reviews/](docs/reviews/) | Independent review records, which gate every merge |
| [docs/logs/](docs/logs/) | Completion logs |
| [docs/tech-debt.md](docs/tech-debt.md) | Deferred work. Scan it before starting a block. |
| [docs/id-registry.md](docs/id-registry.md) | Identifier claims, needed only for parallel branches |

## Stack at a glance

Versions current on 2026-11-10. The lockfile is authoritative.

- **Next.js 16** (App Router, `src/`), **React 19**. UI only. `proxy.ts` (Clerk) gates routes for
  UX, not for security.
- **Clerk** (`@clerk/nextjs` 7): identity only. Roles do not live in Clerk.
- **Convex** 1.49: data, business rules, authorization, the outbox, the clock, crons, and the HTTP
  endpoints for n8n. It also uses `convex-helpers` (custom functions) and
  `@convex-dev/rate-limiter`.
- **n8n** 2.47 in Docker, with **Mailpit** (SMTP catcher), a **Caddy** edge proxy, and a
  **cloudflared** quick tunnel.
- **Tailwind CSS 4** and **shadcn/ui**; **react-hook-form** and **zod 4**; **sonner** toasts;
  **date-fns**.
- **TypeScript** in strict mode, on 6.0.x until `typescript-eslint` supports 7. Scripts run with
  **tsx**.
- **Vitest** and **convex-test**.
- **GitHub Actions** CI, on every pushed branch; **npm**, with `package-lock.json` committed;
  Node ≥ 22 (`.nvmrc`).

## Module codes

Used in block titles, tech-debt entries and ADR context.

| Code | Module | Owns |
| --- | --- | --- |
| `PLT` | Platform | Function wrappers, errors, validators, dates and the clock, signing, redaction, HTTP router, crons, tooling, CI |
| `AUTH` | Identity and roles | `users`, role and trust changes, `auditLog` |
| `TOOL` | Listings | `tools`, availability, the public list |
| `LOAN` | Borrowing | `loans`, the loan state machine, expiry |
| `AUTO` | Automation | `outbox`, `automationEvents`, `workflowRuns`, `integrationStats`, `/n8n/*` endpoints, the n8n workflows |
| `WEB` | Web shell and UX | Layout, navigation, shared components, UX states |

## Working conventions

The rules in [.claude/rules/](.claude/rules/) override this file:

- [coding-standards.md](.claude/rules/coding-standards.md)
- [security-standards.md](.claude/rules/security-standards.md)
- [testing-standards.md](.claude/rules/testing-standards.md)
- [commit-conventions.md](.claude/rules/commit-conventions.md)
- [delivery-blocks.md](.claude/rules/delivery-blocks.md)
- [tech-debt-and-bugs.md](.claude/rules/tech-debt-and-bugs.md)
- [session-norms.md](.claude/rules/session-norms.md)
- [reasoning-guidelines.md](.claude/rules/reasoning-guidelines.md)

Workflow skills:
- `/create-blocks`
- `/run-block NNN`
- `/review-block NNN` (runs in the read-only [block-reviewer](.claude/agents/block-reviewer.md)
  agent)
- `/close-block NNN`
- `/resume-block NNN`
- `/report-bug`

**PRs are deferred by the developer's choice** ([ADR-009 amendment](docs/adr/ADR-009-repository-workflow.md)).
Branches stack, starting from `docs/planning-baseline`. Each block is reviewed and closed on its
branch, and the PRs are opened and merged in order later. Don't ask for `gh` or PRs until the
developer wants to merge.

## Repo layout (target)

```
CLAUDE.md  README.md  CHANGELOG.md  compose.yml  .env.example  .env.n8n.example
.claude/            rules/, skills/, agents/block-reviewer.md, settings.json (best-effort deny rules)
.github/            workflows/ci.yml, pull_request_template.md
convex/             schema, auth config, http router, crons
  lib/              function wrappers, errors, validators, domain constants, dates and clock,
                    hmac, redact, env
  model/            business logic (plain TypeScript)
  *.ts              thin registered functions: users, tools, loans, admin, automation, config, clock, dev
  *.test.ts         convex-test suites; helpers in convex/test/
src/
  app/              (public) landing · (app) tools, listings, requests, incoming, admin
  features/         UI by domain: tools/, loans/, admin/, automation/
  components/ui/    shadcn/ui primitives
  lib/              client helpers
infra/Caddyfile     edge proxy allowlist
n8n/workflows/      exported, sanitized workflow JSON (stable IDs)
scripts/            setup, tunnel sync, admin grant, seed, n8n import/export/check, ID check, smoke tests
docs/               prd, architecture, security, production (block 012), tech-debt, id-registry,
                    adr/, blocks/, reviews/, logs/, runbooks/, bugs/
(gitignored)        .env, .env.local, .env.n8n, .secrets/
```

## Commands

| From block | Command | What it does |
| --- | --- | --- |
| 001 | `npm run dev` | Next.js dev server. From 007 it also runs `tunnel:sync` first, through `predev`. |
| 001 | `npm run typecheck` | TypeScript |
| 001 | `npm run lint` | ESLint (zero warnings) |
| 001 | `npm run format:check` | Prettier |
| 001 | `npm test` | Vitest |
| 001 | `npm run build` | Production build |
| 001 | `npm run check:ids` | Duplicate identifier check |
| 002 | `npx convex dev` | Convex dev deployment: codegen and push |
| 002 | `npm run admin:grant -- <email>` | Make a signed-in user an admin |
| 003 | `npm run seed [-- --owner <email>]` | Demo data (needs `ALLOW_DEV_FUNCTIONS=true`) |
| 007 | `npm run setup` | n8n stack, secrets, Convex env, workflow publish, tunnel (idempotent) |
| 007 | `npm run tunnel:sync` | Point Convex at the current tunnel URL |
| 007 | `npm run n8n:export` | Export and sanitize workflows into `n8n/workflows/` |
| 007 | `npm run check:workflows` | Secrets, pinned data and error-workflow link checks on workflow JSON |
| 008 | `npm run smoke:notifications` | Signed event in, email in Mailpit; bad signatures rejected |
| 009 | `npm run smoke:reminders` | Two runs on the same day: one email, one record |
| 009 | `npm run smoke:idempotency` | Concurrent signed write-backs against the dev deployment: one record |

## Never

- Read `.env`, `.env.local`, `.env.n8n` or `.secrets/`, or print Convex env values.
  `.claude/settings.json` denies the common ways, but the rule applies everywhere.
- Import the raw `query`, `mutation` or `action` builders outside `convex/lib/functions.ts`.
- Call `Date.now()` in a Convex query. Read the clock.
- Commit to `main` directly, except identifier claims
  ([ADR-009](docs/adr/ADR-009-repository-workflow.md)).
- Merge a branch whose latest review isn't PASS or PASS WITH NOTES, or that has non-bookkeeping
  commits after the review.
- Commit the original assignment brief. [docs/prd.md](docs/prd.md) restates the requirements.

## Quick orientation for a new task

1. Find the block in [docs/blocks/](docs/blocks/) and read its spec.
2. Read the architecture sections and ADRs the spec links.
3. Scan [docs/tech-debt.md](docs/tech-debt.md) and any earlier review records for related items.
4. Run `/run-block NNN`. It walks through branch, build, verification, logs, review and its
   record.
