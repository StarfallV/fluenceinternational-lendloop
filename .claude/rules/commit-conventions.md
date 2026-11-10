# Commit Conventions

## Branches

- `main` is the trunk. It changes only through merged PRs. The two exceptions are the root
  commit and identifier claims ([ADR-009](../../docs/adr/ADR-009-repository-workflow.md)).
- Branch from the latest `origin/main`:
  - `feature/NNN-<slug>` for a delivery block, using the exact name in the spec's **Branch**
    line;
  - `fix/BUG-nnn-<slug>` for a bug fix;
  - `docs/<slug>` or `chore/<slug>` for work outside a block.
- Push with an explicit upstream: `git push -u origin HEAD`.

## Pull requests

- One PR per block, titled `[NNN] <Block title>`, with the body taken from
  `.github/pull_request_template.md`.
- Merge only after `/review-block` returns **PASS** or **PASS WITH NOTES** on the latest commit,
  and CI is green.
- Merge with a **merge commit**: no squash, no rebase. That keeps each block's commit history
  readable on `main`. Command: `gh pr merge <n> --merge --delete-branch`.

## Commit messages

Use conventional commits: `<type>: <what changed> (block NNN)`.

| Type | Use for |
| --- | --- |
| `feat` | New behavior |
| `fix` | A bug fix (cite `BUG-nnn`) |
| `refactor` | Restructuring with no behavior change |
| `test` | Tests only |
| `docs` | Documentation only: specs, logs, ADRs, README |
| `chore` | Tooling, dependencies, configuration |
| `infra` | Compose, Docker, CI workflows |

- Add a body when the reason for the change isn't obvious.
- Commits written by Claude end with the attribution line the session specifies.

## Granularity

- Several commits per block, at natural boundaries. Never one commit for a whole block.
- Every commit typechecks, lints and passes its tests.
- Incidental fixes (a typo in an earlier block, a missing ignore rule) get their own commit.
- The completion log is the block's last commit before review:
  `docs: add block NNN completion log`.

## What to commit

- **Commit:** `package-lock.json`, `convex/_generated`, sanitized `n8n/workflows/*.json`, docs.
- **Never commit:** `.env`, `.env.local`, `node_modules/`, `.next/`, `.data/`, or a secret in any
  form.

## Releases

Versions follow SemVer. The milestones are `v0.1.0` (after block 002), `v0.2.0` (after 005),
`v0.3.0` (after 009) and `v1.0.0` (after 012).

1. In the milestone block's PR, before merging:
   - move the `Unreleased` entries in `CHANGELOG.md` under `## [x.y.z] — YYYY-MM-DD`;
   - bump `version` in `package.json`;
   - commit as `docs: release vX.Y.Z`.
2. Merge the PR.
3. Tag the merge commit on `main` with an annotated tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`, then
   `git push origin vX.Y.Z`.
4. `gh release create vX.Y.Z --title "vX.Y.Z" --notes "<that CHANGELOG section>"`.

Never move or delete a published tag. If a release is wrong, supersede it with a new version.
