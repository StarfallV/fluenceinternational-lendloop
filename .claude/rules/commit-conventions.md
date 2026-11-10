# Commit Conventions

## Branches

- `main` is the trunk. It changes only through merged PRs. The two exceptions are the root
  commit and identifier claims ([ADR-009](../../docs/adr/ADR-009-repository-workflow.md)).
- **Branch names:**
  - `feature/NNN-<slug>` for a delivery block, using the exact name in the spec's **Branch**
    line;
  - `fix/BUG-nnn-<slug>` for a bug fix;
  - `docs/<slug>` or `chore/<slug>` for work outside a block.
- **Base branch.** Branches stack while PRs are deferred (ADR-009 amendment):
  - if everything the block depends on has merged into `main`, branch from the latest
    `origin/main`;
  - otherwise, branch from the newest dependency branch whose latest review passed. The planning
    baseline, `docs/planning-baseline`, is the bottom of the stack.
- If a lower branch gains commits after a higher branch was cut, **merge** the lower branch into
  the higher one. Never rebase a pushed branch.
- Push with an explicit upstream: `git push -u origin HEAD`.

## Pull requests

- PRs are opened when the developer is ready, **not** as a gate for starting the next block. Open
  them in stack order, one per branch:
  - title: `[NNN] <Block title>`;
  - body: from `.github/pull_request_template.md`, linking the block's review records in
    `docs/reviews/` and its completion log.
- **Merge gate:**
  - the latest review record is PASS or PASS WITH NOTES;
  - every commit after the reviewed commit is bookkeeping only: `docs/`, `CHANGELOG.md`, and the
    `version` fields changed by `npm version`;
  - CI is green.
- Merge with a **merge commit**: `gh pr merge <n> --merge --delete-branch`. The next PR in the
  stack then targets `main`.

## Commit messages

Use conventional commits: `<type>: <what changed> (block NNN)`.

| Type | Use for |
| --- | --- |
| `feat` | New behavior |
| `fix` | A bug fix (cite `BUG-nnn`) |
| `refactor` | Restructuring with no behavior change |
| `test` | Tests only |
| `docs` | Documentation only: specs, logs, ADRs, review records, README |
| `chore` | Tooling, dependencies, configuration, release version bumps |
| `infra` | Compose, Docker, CI workflows |

- Add a body when the reason for the change isn't obvious.
- Commits written by Claude end with the attribution line the session specifies.

## Granularity

- Several commits per block, at natural boundaries. Never one commit for a whole block.
- Every commit typechecks, lints and passes its tests.
- Incidental fixes (a typo in an earlier block, a missing ignore rule) get their own commit.
- The completion log, together with the spec's switch to `Status: In review`, is the block's last
  commit before review: `docs: add block NNN completion log`.

## What to commit

- **Commit:** `package-lock.json`, `convex/_generated`, sanitized `n8n/workflows/*.json`, docs,
  review records.
- **Never commit:** `.env`, `.env.local`, `.env.n8n`, `.secrets/`, `node_modules/`, `.next/`, or a
  secret in any form.

## Releases

Versions follow SemVer. The milestones are `v0.1.0` (block 002), `v0.2.0` (block 005), `v0.3.0`
(block 009) and `v1.0.0` (block 012).

1. **In the milestone block's closing commits:**
   - move the `Unreleased` entries in `CHANGELOG.md` under `## [x.y.z] — YYYY-MM-DD`;
   - run `npm version x.y.z --no-git-tag-version`, which updates `package.json` and
     `package-lock.json`;
   - commit as `chore: release vX.Y.Z`.
2. **When that block's PR merges,** tag the merge commit on `main` with an annotated tag:
   `git tag -a vX.Y.Z -m "vX.Y.Z"`, then `git push origin vX.Y.Z`.
3. **Only for `v1.0.0`:** create a GitHub Release with
   `gh release create v1.0.0 --title "v1.0.0" --notes "<CHANGELOG section>"`. Earlier milestones
   are tags and CHANGELOG entries only.

Never move or delete a published tag. If a release is wrong, supersede it with a new version.
