# LendLoop

**Borrow what you need. Lend what you don't.**

LendLoop is a neighborhood tool-lending board. Neighbors list tools they are willing to lend,
request to borrow each other's tools for a date range, and get email notifications and overdue
reminders from n8n workflows.

Built with Next.js (App Router), Clerk, Convex, n8n and TypeScript.

> **Status: in development.** The work is planned as numbered delivery blocks in
> [docs/blocks/](docs/blocks/). Setup instructions arrive with the local automation stack
> (block 007), and the final README with block 012.

## Development

**Prerequisites:**
- Node.js 22.13 or a later 22.x, 24, or 26 and later (`.nvmrc` pins 24, which CI uses). Node 25
  isn't supported by Vitest;
- npm and Git;
- from block 007, Docker Desktop, for the local automation stack.

```sh
npm ci        # install the exact locked dependencies
npm run dev   # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serves the production build |
| `npm run typecheck` | Generates the Next.js route types, then runs `tsc` (TypeScript 6.0, strict) |
| `npm run lint` | ESLint, with zero warnings allowed |
| `npm run format` | Formats code with Prettier (`format:check` only checks) |
| `npm test` | Vitest: a `node` project (scripts, libraries, Claude Code hooks) and a `convex` project (edge runtime) |
| `npm run check:ids` | Fails if a TD, ADR or BUG identifier, or a block number, is defined twice under `docs/` |

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs `npm ci`, then typecheck, lint,
format check, tests, build and the ID check, on every pushed branch and on pull requests.

Environment variables are listed in [.env.example](.env.example): copy it to `.env.local` and
fill it in. None are needed yet; Convex and Clerk arrive in block 002.

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/prd.md](docs/prd.md) | Requirements, business rules, and the requirement-to-block traceability table |
| [docs/architecture.md](docs/architecture.md) | Components, data model, authorization model, and the Convex ↔ n8n integration contract |
| [docs/security.md](docs/security.md) | Threat model, controls, secrets, and data-minimization decisions |
| [docs/adr/](docs/adr/) | Architecture decision records, with the options considered |
| [docs/blocks/](docs/blocks/) | Delivery block specs and their status |
| [docs/reviews/](docs/reviews/) | Independent review records for the plan and for each block |
