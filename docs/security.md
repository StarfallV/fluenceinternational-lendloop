# LendLoop — Security and Privacy

**Status:** v1.5 (2026-11-11): local development topology (local Convex, no tunnel) at the start
of block 002. v1.4: §5's agent guardrails rewritten in block 001 (TD-009) and revised after its
review rounds [1](reviews/001-review-1.md), [2](reviews/001-review-2.md),
[3](reviews/001-review-3.md) and [4](reviews/001-review-4.md). Baseline v1.3 (2026-11-10,
revised after planning review [rounds 1](reviews/planning-baseline-review-1.md),
[2](reviews/planning-baseline-review-2.md) and [3](reviews/planning-baseline-review-3.md)).
**Scope:** What we protect, from whom, with which controls, and which personal data goes where.
The mechanisms are specified in [architecture.md](architecture.md). This document explains why
they exist.

---

## 1. Assets

| Asset | Why it matters |
| --- | --- |
| Users' email addresses | Personal data; the only contact channel |
| Listings and loans | Show who owns what, and who is away from home with whose tools |
| Roles and the Trusted Lender flag | Control moderation power and neighbors' trust |
| Signing secrets (two) | Whoever holds one can impersonate Convex or n8n to the other |
| `CLERK_SECRET_KEY`, the n8n encryption key | Control sessions, and the n8n credential store |

## 2. Trust boundaries

1. **Browser → Convex.** Untrusted input. Every Convex function is reachable by anyone who can
   reach the deployment, whatever the UI shows.
2. **Convex → n8n.** Stays on the developer's machine locally (`localhost`); crosses a network in
   production.
3. **n8n → Convex.** HTTP endpoints anyone who can reach the deployment can call. Locally the
   backend listens on all interfaces, so that includes the local network unless the firewall
   blocks it.
4. **n8n → SMTP.** Leaves our control once sent.
5. **Operator → Convex.** CLI and dashboard with the deploy key. Trusted, used for role grants
   and seeds.

## 3. Threats and controls

| Threat | Control | Where |
| --- | --- | --- |
| Calling a Convex function directly, without the UI | Every public function goes through the wrappers in `lib/functions.ts`, which check identity and role. An ESLint rule forbids the raw builders. | architecture §5.1 |
| Acting on someone else's listing or loan (IDOR) | The acting user comes from `ctx.auth`, never from arguments. Ownership and party checks live in `model/*`, with one fixed error code per resource. Tests cover each case. | architecture §5.1 |
| Privilege escalation | Roles live in Convex, and only the internal `users:grantRole` changes them, from the CLI. No public path exists. | ADR-002 |
| Data leaking through the public query | `tools:listPublic` builds an explicit projection, and its `returns` validator rejects any extra field | architecture §6 |
| Forged webhook or forged write-back | HMAC-SHA256 over the timestamp, method, path and raw body (newline-separated). One secret per direction. Constant-time comparison. Bare 401. | ADR-004 |
| Replay | ±300 s timestamp window, plus idempotency keys on every write to Convex. Replays to n8n inside the window are a residual risk (§6). | ADR-004, ADR-005 |
| Cross-endpoint replay | The signature covers the method and path | ADR-004 |
| Oversized or malformed bodies | 64 KiB limit checked first; validated with Convex validators before any write | architecture §8 |
| Junk traffic turned into writes | Rejected requests write nothing: the reason goes to the logs as a code, and every check runs before any write | architecture §8 |
| Personal data in error text | n8n sends error codes plus redacted, truncated messages. Convex redacts again before storing. Parties see only the status; admins see the redacted detail. | architecture §4, §8 |
| Secrets committed or leaked | Secrets are only in env files and n8n credentials. `.env*` and `.secrets/` are gitignored. Compose gives `.env.n8n` to the n8n container only, and Next.js never loads it. n8n's encryption key stays in its data volume, never in `$env`. The workflow exporter strips pinned data, and a CI check fails on anything secret-shaped. Claude Code deny rules (best-effort) cover reading env files and listing Convex env values. | §5 |
| The n8n editor or Mailpit exposed to the network | Compose publishes n8n and Mailpit on `127.0.0.1` only; n8n reaches Convex through `host.docker.internal`, and nothing is tunnelled | ADR-001, `compose.yml` |
| HTML or header injection through user text in emails | Plain-text emails only. Single-line fields reject control characters. Length limits on all user text. React escapes all rendering. | BR-3, BR-16, BR-21 |
| Spam and abuse | Rate limits on creating listings and requests, one open request per tool, field limits | SEC-6 |
| Retry storms against n8n | Bounded backoff with jitter, then a dead letter. One loan's events go out in order. | architecture §7.3 |
| Demo or seed functions running in production | `dev:*` are internal functions **and** need `ALLOW_DEV_FUNCTIONS=true` | `convex/dev.ts` |

## 4. Data minimization

| Data | Stored in | Visible to | Sent to n8n |
| --- | --- | --- | --- |
| Email | Convex `users` | The user themselves, and the counterparty on an **approved** loan (to arrange pickup). Not visitors, other users, or admin screens. | Only the recipient's email, only on the event or reminder that needs it |
| Display name ("Alex P.") | Convex `users` | Signed-in users | The recipient's and counterparty's display names |
| Owner of a tool | Convex `tools` | Signed-in users (display name only). **Never the public page.** | No |
| Tool name and category | Convex `tools` | Everyone (public page) | Tool name only |
| Tool description and condition | Convex `tools` | Signed-in users | No |
| Loan dates | Convex `loans` | The two parties and admins | Yes, they are the content of the notification |
| Request note | Convex `loans` | The lender and the borrower | **No** |
| Role and Trusted flag | Convex `users` | Badge to signed-in users; role to the user and admins | No |
| Automation status | Convex `automationEvents` | The loan's parties (status only) and admins | — |
| Error codes and messages | Convex `automationEvents`, `workflowRuns`; the admin alert email | Admins only, **redacted and truncated** | — |
| Outbox rows | Convex `outbox` | Admins | Rows store IDs only. The payload is built when it is sent. |
| n8n executions | n8n database | n8n operators | Successful and manual executions are **not saved**; failed ones are kept 7 days |
| Logs | Convex logs | Operators | IDs and error codes only, never emails or names |

## 5. Secrets management

| Secret | Generated by | Stored in | Never in |
| --- | --- | --- | --- |
| `CONVEX_TO_N8N_SIGNING_SECRET` | `npm run setup` (32 random bytes) | Convex env, `.env.n8n` → n8n container env | Code, workflow JSON, logs, the Next.js process |
| `N8N_TO_CONVEX_SIGNING_SECRET` | `npm run setup` | Convex env, `.env.n8n` → n8n container env | Code, workflow JSON, logs, the Next.js process |
| n8n encryption key | n8n, on first start | n8n's data volume (`~/.n8n/config`) | Env variables (so `$env` can't read it), anywhere else |
| `CLERK_SECRET_KEY` | Clerk dashboard | `.env.local` | Convex, n8n, logs |
| The local Convex deployment's admin key, its env values (the signing secrets above among them) and its data | `npx convex dev`, on first run | `.convex/` (gitignored) | Git, logs |
| SMTP credentials | n8n credential (encrypted with the key above) | n8n database | Workflow JSON |

**Trade-offs we accept:**
- The Code nodes that sign and verify read the signing secrets from `$env`, which needs env access
  enabled in n8n nodes (TD-003).
- If the Convex CLI can't read values from stdin, `npm run setup` passes them as command arguments
  for an instant, which is visible to local process listings. That is acceptable on a developer
  machine.
- The Claude Code guardrails are best-effort, for agents, not a security boundary. They cover:
  - **File tools:** deny rules, anchored to the project root, for reading (`Read`, which Claude
    Code also applies to its other file-reading tools) and writing (`Edit`, which also covers
    `Write`). They cover every env file Next.js loads (`.env`, `.env.local`, `.env.<mode>`,
    `.env.<mode>.local`), plus `.env.n8n`, `.secrets/` and `.convex/`.
  - **Shell commands:** a PreToolUse hook (`.claude/hooks/guard-secrets.mjs`, with its matching
    logic in `secret-names.mjs`) runs before every Bash, PowerShell and Monitor command. That
    includes commands Claude Code would auto-approve, and subagents' commands. It is registered
    in exec form, so it doesn't depend on a shell. It blocks:
    - any command over 64 KiB, unchecked. Every check below is linear in the command's length
      (under 25 ms for any 64 KiB input tried on the development machine), and the hook must
      answer well inside its 10 s timeout, because a hook that times out lets the command run;
    - any command that names a secret file, in any path form or letter case: `.env`,
      `.env.<anything>` except the committed `*.example` templates, or anything under
      `.secrets` or `.convex`. Examples: `cat .env.local`, `diff .env.n8n.example .env.n8n`,
      `cat .ENV`, `Get-Content -Path .\.secrets\n8n_encryption_key`,
      `cat .convex/local/default/config.json`.
    - commands that print secrets without naming a file:
      - `docker compose config` (or its alias `convert`) without `--no-env-resolution`, also as
        `docker.exe compose`, `docker-compose` or `docker-compose.exe`;
      - commands that run something in a container: a word whose program name (its last path
        segment, without `.exe`) is `docker` or `docker-compose`, followed in the same simple
        command by `exec` or `run`. Options before the subcommand are fine, and so is a path
        (`/usr/bin/docker`, `C:\…\docker.exe`). Then the **whole** command is checked word by
        word, splitting at whitespace, quotes, `=`, brackets, backticks, backslashes,
        redirections and separators. So words piped into the container, every step of an
        `sh -c` script or heredoc, and a host command chained after it all count. Blocked:
        - the whole environment: a word whose program name is `env`, `printenv` or `environ`
          (`/usr/bin/env`, `--entrypoint=env`, `` `env` ``, `\env`, `/proc/1/environ`),
          `environ` inside a word (`os.environ`), `declare` or `typeset`, a bare `set` or
          `export` (followed by nothing but a separator, a quote or a redirection), and
          `export -p`;
        - one secret: any text containing `SIGNING_SECRET` or `ENCRYPTION_KEY`, and
          `process.env`;
        - n8n's `~/.n8n/config`, which holds the encryption key: a command that mentions both
          `.n8n` and `config`;
      - the same docker words with `cp`: anything that mentions `.n8n`, and the single-secret
        rules above;
      - the same docker words with `inspect`;
      - `n8n export:credentials --decrypted`, on the host or in a container;
      - recursive searches that ignore `.gitignore`, judged token by token after the program
        name:
        - `grep`, `egrep` or `fgrep` with a short-flag cluster containing `r` or `R` (`-rnC3`),
          `--rec…` or `--der…` (`--recursive`, `--dereference-recursive`, abbreviated), or
          `-d`/`--directories` with `rec…` (attached, after `=`, or as the next token); and
          `rgrep`;
        - `rg` with a short-flag cluster containing a lowercase `u` (`-uuA2`), `--unrestricted`
          or `--no-ignore…`;
        - `git grep --no-index` or `--no-exclude-standard`;
        - `Get-ChildItem -Recurse` (or `gci -r`, or `-Depth`) piped into `Select-String`, `sls`
          or `Get-Content`, and `-Recurse` before or after a reader in one statement;
        - `findstr` with a `/` or `-` switch containing `s` (`/s`, `/si`, `/s/i`, `-s`);
      - `convex env list` and `convex env get`.

    It allows:
    - the `*.example` templates. The static rules below still deny `cat .env.example`, so read
      the templates with the Read tool;
    - expressions such as `process.env` or `$env:X`;
    - `docker compose config --no-env-resolution`;
    - plain `rg` (and `rg -U`, multiline mode) and plain `git grep`, which respect `.gitignore`;
    - non-recursive `grep` and `findstr`.

    The test lists every case (`.claude/hooks/secret-names.test.mjs`), and another test checks
    the hook's registration in `.claude/settings.json`. If the hook's input is unreadable, or a
    tool call has no command (other than Monitor's WebSocket form, which runs none), it fails
    open with a warning. If its matcher fails to load (a broken pattern, for example) or throws,
    it denies.
  - **Static deny rules** for the common readers (`cat`, `head`, `tail`, `less`, `source`,
    `Get-Content`, `gc`, `type`), and for `convex env list` and `convex env get` through `npx` or
    the CLI's Node entry point. They back up the hook if it fails to run.

  The guardrails don't cover anything outside the lists above. In particular:
  - a program that opens the files itself (a script run with `node`, `tar`, `zip`, `cp -r`), or
    a file list built by another command (`find … -exec cat`, `xargs`);
  - a path assembled at run time, or matched by a wildcard or a search glob (`cat .e*`,
    `rg -g '*'`);
  - a program reached under another name (an alias, a function, or a copy of the binary);
  - inside a container: an interactive shell; a word assembled from pieces (`e""nv`,
    `${x}env`); another language's environment API (Perl's `%ENV`, Ruby's `ENV`); a variable
    whose name contains neither `SIGNING_SECRET` nor `ENCRYPTION_KEY`; a file other than
    `~/.n8n/config`; and n8n's data volume mounted into another container
    (`docker run -v <volume>:/data … cat /data/config`). The volume's name is added once
    `compose.yml` defines it (TD-013).

  The rule in `CLAUDE.md` is what governs.

## 6. Residual risks

| Risk | Why it is accepted here | Production answer |
| --- | --- | --- |
| User profile changes in Clerk only sync on the next sign-in (TD-001) | Low impact locally | Clerk webhooks (signed, verified) |
| Anyone can sign up and then see every listing and display name (TD-007) | A demo needs open sign-up | Invite-only or allowlisted sign-up, or address verification for a neighborhood |
| A replay of a loan event to n8n inside the 5-minute window re-sends one email (TD-006) | Needs a captured, valid request; the effect is one duplicate email | Event-ID deduplication in n8n after the send, or idempotency keys at the email provider |
| A duplicate email in the other narrow cases of TD-006: a lost acknowledgement, a timed-out send that completes anyway, a reminder whose write-back never lands, overlapping reminder runs, or an SMTP reply lost after acceptance | At-least-once is standard, and the email is harmless | The same as above |
| The local Convex backend listens on all interfaces (ports 3210 and 3211) | Development only; every function still checks the caller, and the endpoints check signatures | A cloud deployment, with n8n reached over a private network or a real domain with TLS |
| Host sleep can skew the Docker VM clock beyond ±300 s, so signed calls are rejected | The rejections show in the logs and as n8n workflow errors; the runbook gives the fix | Hosts that use NTP |
