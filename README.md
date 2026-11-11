# LendLoop

**Borrow what you need. Lend what you don't.**

LendLoop is a neighborhood tool-lending board. Neighbors list tools they are willing to lend,
request to borrow each other's tools for a date range, and get email notifications and overdue
reminders from n8n workflows.

Built with Next.js (App Router), Clerk, Convex, n8n and TypeScript.

> **Status: in development.** The work is planned as numbered delivery blocks in
> [docs/blocks/](docs/blocks/). The n8n setup arrives with block 007, and the final README with
> block 008.

## Development

**Prerequisites:**
- Node.js 22.13 or a later 22.x, 24, or 26 and later (`.nvmrc` pins 24, which CI uses). Node 25
  isn't supported by Vitest;
- npm and Git;
- a Clerk account (the free plan is enough). Convex needs no account: it runs locally;
- from block 007, Docker Desktop, for the local automation stack.

### First-time setup

1. **Install:** `npm ci`.
2. **Clerk:** create an application with email sign-in, and make first and last name required
   (they become display names such as "Alex P."). Under **Integrations**, turn on **Convex**. Then,
   under **Sessions → Customize session token**, keep the `"aud": "convex"` claim the integration
   added and add the name and email claims, so the token reads:

   ```json
   {
     "aud": "convex",
     "name": "{{user.full_name}}",
     "given_name": "{{user.first_name}}",
     "family_name": "{{user.last_name}}",
     "email": "{{user.primary_email_address}}"
   }
   ```

3. **Convex:** run `npx convex dev --once`, and choose **Start without an account (run Convex
   locally)**. It provisions a local deployment, keeps its data in `.convex/`, and writes the
   `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` lines to
   `.env.local`. It then stops with "Environment variable CLERK_JWT_ISSUER_DOMAIN is used in auth
   config file but its value was not set", which the next step fixes.
4. **Tell Convex which Clerk instance to trust:** the Frontend API URL from Clerk's **API keys**
   page (it is public):

   ```sh
   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-instance>.clerk.accounts.dev
   ```

5. **Clerk keys for Next.js:** add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from
   the same page to `.env.local`, below the lines Convex wrote. Don't copy `.env.example` over
   the file; it only documents the variables. The secret key stays in `.env.local`: Convex never
   needs it.

### Running

```sh
npx convex dev   # terminal 1: the local backend (127.0.0.1:3210), pushing code on every change
npm run dev      # terminal 2: http://localhost:3000
```

Sign in from the landing page; your first sign-in creates your LendLoop user. To make yourself an
admin, run this while `npx convex dev` is running. It works the same in PowerShell, Git Bash and
other shells, and it never prints the email:

```sh
npm run admin:grant -- you@example.com
```

Roles change only from the command line (BR-18). `npx convex dashboard` opens the local
dashboard, where you can browse the data and run functions such as `users:grantRole`.

**Stopping on Windows:** stopping `npx convex dev` can leave the `convex-local-backend` process
running, holding port 3210. Stop it from PowerShell:
`Stop-Process -Id (Get-NetTCPConnection -LocalPort 3210 -State Listen).OwningProcess`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serves the production build |
| `npm run typecheck` | Generates the Next.js route types, then runs `tsc` (TypeScript 6.0, strict) |
| `npm run lint` | ESLint, with zero warnings allowed. It also rejects the raw Convex `query`, `mutation` and `action` builders outside `convex/lib/functions.ts` |
| `npm run format` | Formats code with Prettier (`format:check` only checks) |
| `npm test` | Vitest: a `node` project (scripts, libraries, the lint rule, Claude Code hooks) and a `convex` project (`convex-test`, in the edge runtime) |
| `npm run check:ids` | Fails if a TD, ADR or BUG identifier, or a block number, is defined twice under `docs/` |
| `npm run admin:grant -- <email>` | Makes a user who has signed in at least once an admin |

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs `npm ci`, then typecheck, lint,
format check, tests, build and the ID check, on every pushed branch and on pull requests. It
needs no secrets: the tests run on `convex-test`, and the build uses placeholder public values
that are set in the workflow.

The Next.js variables are documented in [.env.example](.env.example).

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/prd.md](docs/prd.md) | Requirements, business rules, and the requirement-to-block traceability table |
| [docs/architecture.md](docs/architecture.md) | Components, data model, authorization model, and the Convex ↔ n8n integration contract |
| [docs/security.md](docs/security.md) | Threat model, controls, secrets, and data-minimization decisions |
| [docs/adr/](docs/adr/) | Architecture decision records, with the options considered |
| [docs/blocks/](docs/blocks/) | Delivery block specs and their status |
| [docs/reviews/](docs/reviews/) | Independent review records for the plan and for each block |
