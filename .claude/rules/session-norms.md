# Session Norms

How Claude Code works in this repository.

## Before writing code

- Read `CLAUDE.md`, the block spec, and the architecture sections and ADRs the spec links.
- Scan `docs/tech-debt.md` for items this block can resolve cheaply. Resolve them and note it in
  the completion log.
- Settle the block's verification items (architecture.md §16) **first**. They can change the
  approach.
- Confirm every acceptance criterion is unambiguous. If one isn't, ask before building.

## While implementing

- One block at a time, within its scope. Findings outside the scope become tech-debt items.
- Run typecheck, lint and the relevant tests after each change. Never commit with any of them
  failing.
- Check current tool behavior before relying on memory: read the installed package's types and
  docs, or try it. Versions move fast here (Next.js 16, Clerk 7, n8n 2.x, TypeScript 7).
- Ask before making an architectural decision the docs don't cover. Otherwise choose, record the
  choice in the completion log, and write an ADR if it qualifies.
- Don't add a dependency without giving the reason in the completion log.

## Code quality

- Follow the rules even where you would personally choose differently. Consistency wins.
- No `TODO` without a tech-debt item, no commented-out code, and no `eslint-disable` without a
  reason.

## Finishing a block

- Verify every acceptance criterion and collect its evidence before writing the completion log.
- Make sure the tech-debt register and the completion log agree.
- Keep the docs true (delivery-blocks rule).

## Secrets

- Never read `.env`, `.env.local` or other secret files, and never print Convex env values.
  Check whether a variable is set with a script that reports only "set" or "missing".
- If a secret appears in output anyway, stop, tell the developer, and treat that secret as needing
  rotation.

## Things only the developer can do

Creating accounts and logging in: Clerk, `npx convex dev` the first time, the n8n owner account,
and `gh auth login`. Ask for these when a block needs them, as listed in its **Manual Steps**.
