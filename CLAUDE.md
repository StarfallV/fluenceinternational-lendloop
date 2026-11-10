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
| [docs/architecture.md](docs/architecture.md) | Components, data model, authorization, loan lifecycle, the integration contract, open verification items (§16) |
| [docs/security.md](docs/security.md) | Threat model, controls, data minimization, secrets |
| [docs/adr/](docs/adr/) | Decisions, with the options considered |
| [docs/blocks/](docs/blocks/) | Delivery block specs and their status |
| [docs/logs/](docs/logs/) | Completion logs |
| [docs/tech-debt.md](docs/tech-debt.md) | Deferred work. Scan it before starting a block. |
| [docs/id-registry.md](docs/id-registry.md) | Identifier claims, needed only for parallel branches |

## Stack at a glance

Versions current on 2026-11-10. The lockfile is authoritative.

- **Next.js 16** (App Router, `src/`), **React 19**. UI only. `proxy.ts` (Clerk) gates routes for
  UX, not for security.
- **Clerk** (`@clerk/nextjs` 7): identity only. Roles do not live in Clerk.
- **Convex** 1.49: data, business rules, authorization, the outbox, crons, and the HTTP endpoints
  for n8n. It also uses `convex-helpers` (custom functions) and `@convex-dev/rate-limiter`.
- **n8n** 2.47 in Docker, with **Mailpit** (SMTP catcher), a **Caddy** edge proxy, and a
  **cloudflared** quick tunnel.
- **Tailwind CSS 4** and **shadcn/ui**; **react-hook-form** and **zod 4**; **sonner** toasts;
  **date-fns**.
- **TypeScript** in strict mode, pinned to the newest version `typescript-eslint` supports (see
  the block 001 log).
- **Vitest** and **convex-test**.
- **GitHub Actions** CI; **npm**, with `package-lock.json` committed; Node ≥ 22 (`.nvmrc`).

## Module codes

Used in block titles, tech-debt entries and ADR context.

| Code | Module | Owns |
| --- | --- | --- |
| `PLT` | Platform | Function wrappers, errors, validators, dates, signing, HTTP router, crons, tooling, CI |
| `AUTH` | Identity and roles | `users`, role and trust changes, `auditLog` |
| `TOOL` | Listings | `tools`, availability, the public list |
| `LOAN` | Borrowing | `loans`, the loan state machine, expiry |
| `AUTO` | Automation | `outbox`, `automationEvents`, `workflowRuns`, `/n8n/*` endpoints, the n8n workflows |
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
- `/review-block NNN`
- `/close-block NNN`
- `/resume-block NNN`
- `/report-bug`

## Repo layout (target)

```
CLAUDE.md  README.md  CHANGELOG.md  compose.yml  .env.example
.claude/            rules/, skills/, settings.json (deny rules for secrets)
.github/            workflows/ci.yml, pull_request_template.md
convex/             schema, auth config, http router, crons
  lib/              function wrappers, errors, validators, domain constants, dates, hmac, env
  model/            business logic (plain TypeScript)
  *.ts              thin registered functions: users, tools, loans, admin, automation, dev
  *.test.ts         convex-test suites; helpers in convex/test/
src/
  app/              (public) landing · (app) tools, listings, requests, incoming, admin
  features/         UI by domain: tools/, loans/, admin/, automation/
  components/ui/    shadcn/ui primitives
  lib/              client helpers
n8n/workflows/      exported, sanitized workflow JSON
scripts/            setup, tunnel sync, n8n import/export/check, ID check, smoke tests
docs/               prd, architecture, security, production (block 012), tech-debt, id-registry,
                    adr/, blocks/, logs/, runbooks/, bugs/
```

## Commands

From block 001:

```
npm run dev              Next.js dev server
npx convex dev           Convex dev deployment: codegen and push (from block 002)
npm run typecheck        TypeScript
npm run lint             ESLint (zero warnings)
npm run format:check     Prettier
npm test                 Vitest
npm run build            Production build
npm run check:ids        Duplicate identifier check
```

From block 007:

```
npm run setup            n8n stack, secrets, Convex env, tunnel (idempotent)
npm run tunnel:sync      Point Convex at the current tunnel URL
npm run n8n:export       Export and sanitize workflows into n8n/workflows/
npm run check:workflows  Secret and pinned-data scan of workflow JSON
npm run smoke:notifications | smoke:reminders
```

## Never

- Read `.env`, `.env.local` or any secret file, or print Convex env values. `.claude/settings.json`
  denies these; don't work around it.
- Import the raw `query`, `mutation` or `action` builders outside `convex/lib/functions.ts`.
- Commit to `main` directly, except identifier claims ([ADR-009](docs/adr/ADR-009-repository-workflow.md)).
- Commit the original assignment brief. [docs/prd.md](docs/prd.md) restates the requirements.

## Quick orientation for a new task

1. Find the block in [docs/blocks/](docs/blocks/) and read its spec.
2. Read the architecture sections and ADRs the spec links.
3. Scan [docs/tech-debt.md](docs/tech-debt.md) for related items.
4. Run `/run-block NNN`. It walks through branch, build, verification, logs and the PR.
