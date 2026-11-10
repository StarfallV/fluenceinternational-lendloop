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
  docs, or try it. Versions move fast here: Next.js 16, Clerk 7, and n8n 2.x. TypeScript 7 is out,
  but the toolchain stays on 6.0.x until `typescript-eslint` supports 7.
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

- Never read `.env`, `.env.local`, `.env.n8n`, `.secrets/` or other secret files, and never print
  Convex env values. Check whether a variable is set with a script that reports only "set" or
  "missing". The deny rules in `.claude/settings.json` are best-effort (their coverage is listed in
  [security.md §5](../../docs/security.md#5-secrets-management)); the rule applies even where a
  command isn't blocked.
- If a secret appears in output anyway, stop, tell the developer, and treat that secret as needing
  rotation.
- The hook in `.claude/hooks/guard-secrets.mjs` blocks any shell command whose text names a secret
  file, even when the name is only mentioned, for example in a commit message. Put such text in a
  file instead, for example `git commit -F <file>`; never work around the hook to reach the file.
- The static deny rules match the whole command text. A compound command that pipes into a
  reader (`| tail`) and later names a template (`git add .env.example`) is denied too. Split it
  into separate commands.

## Skills

- A skill's `allowed-tools` pre-approve commands only for the turn that invokes it. Later turns of
  a long block prompt as usual.

## Things only the developer can do

Creating accounts and logging in: Clerk, `npx convex dev` the first time, the n8n owner account,
and `gh auth login`. Ask for these when a block needs them, as listed in its **Manual Steps**.
