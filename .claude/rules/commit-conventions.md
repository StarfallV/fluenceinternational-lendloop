# Commit Conventions

## Branches

- `main` is the trunk. It changes only through merged PRs. The exceptions are the root commit, and
  identifier claims once work continues from `main` with parallel branches
  ([ADR-009](../../docs/adr/ADR-009-repository-workflow.md)).
- **Branch names:** the exact name in the spec's **Branch** line: `feature/NNN-<slug>` for a
  block, or `fix/BUG-nnn-<slug>` for a fix block after the last planned one. `docs/<slug>` or
  `chore/<slug>` for work outside a block.
- **Base branch.** Blocks run one at a time, in number order
  ([delivery-blocks rule](delivery-blocks.md#lifecycle)). Block NNN's base is block NNN−1's branch;
  block 001's is `docs/planning-baseline`. Once that branch has merged, the base is `main`. Create
  the branch from the remote base: `git fetch origin`, then
  `git switch -c <branch> origin/<base>`.
- **Closed branches are frozen.** Never commit to, merge into, or rebase a Closed branch. Fixes go
  into the block in progress ([tech-debt-and-bugs rule](tech-debt-and-bugs.md#bugs)). Never
  rebase any pushed branch.
- Push with an explicit upstream: `git push -u origin HEAD`.

## Pull requests

- PRs are opened when the developer is ready, **not** as a gate for starting the next block. Open
  them one at a time, in stack order, starting with `docs/planning-baseline`. Open each against
  `main` once the PR below it has merged, so its diff shows only its own commits:
  - title: `[NNN] <Block title>`;
  - body: from `.github/pull_request_template.md`, linking the block's review records in
    `docs/reviews/` and its completion log.
- **Merge gate:** defined once, in the [delivery-blocks rule](delivery-blocks.md#merge-gate):
  latest review PASS or PASS WITH NOTES, only bookkeeping since, CI green.
- Merge with a **merge commit**, and keep the branch: `gh pr merge <n> --merge`, without
  `--delete-branch`. Keep GitHub's "automatically delete head branches" setting off. A branch has
  merged when `git merge-base --is-ancestor origin/<branch> origin/main` succeeds.

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
