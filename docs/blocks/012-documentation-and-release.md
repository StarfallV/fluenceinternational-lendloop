# 012 — Documentation and release

**Status:** Planned
**Module:** PLT
**Branch:** feature/012-documentation-and-release

## Goal
Finish the deliverables a reviewer reads first, prove that a fresh clone works by following them,
and cut `v1.0.0`.

## Dependencies
- Depends on: 011
- Depended on by: None

## Requirements
DEL-1 – DEL-4, OPS-1.

## Inputs
- Every completion log, `docs/tech-debt.md`, [prd.md §9](../prd.md#9-traceability).

## Outputs
- **README:**
  - what LendLoop is, with screenshots;
  - quickstart: prerequisites, Clerk, Convex, `npm run setup`, run, seed, grant an admin;
  - the environment variable table;
  - an architecture summary with diagrams;
  - the security and data-minimization summary;
  - the n8n workflows, and how to import and export them;
  - testing, the requirements-coverage table, a repo map, and the delivery process.
- **`docs/production.md`,** the production note:
  - **Hosting and n8n:** hosting; n8n in queue mode on Postgres.
  - **Secrets:** a secrets manager, and rotation that accepts the current and previous secret
    during the switch.
  - **Email:** an SMTP provider with SPF, DKIM and DMARC, plus bounces and unsubscribe.
  - **Identity:** Clerk webhooks for profile sync and deletion.
  - **Network:** private networking or an IP allowlist instead of a tunnel.
  - **Operations:** monitoring and alerting on the heartbeat and dead letters; backups;
    retention and deletion (GDPR); CI/CD with separate environments.
  - **Performance:** denormalized availability.
  - The open tech-debt items that matter for production.
- **Consistency:** the PRD §9 evidence column is complete, and a pass over architecture.md and
  security.md makes them match the final code.
- **Release:** the `v1.0.0` entry in `CHANGELOG.md`, an annotated tag on `main`, and a GitHub
  Release.

## Acceptance Criteria
- [ ] Following only the README, a fresh clone gets through:
  - sign-in;
  - listing a tool;
  - request → approve → return with the emails in Mailpit;
  - an overdue reminder run.

  The run is documented in the completion log.
- [ ] Every PRD requirement has linked evidence in §9.
- [ ] The README covers DEL-3 in full, and `docs/production.md` covers DEL-4.
- [ ] CI, `check:workflows` and `check:ids` are green on the release commit, and the annotated
      `v1.0.0` tag points at `main`.

**Release:** `v1.0.0`.
