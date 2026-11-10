# Testing Standards

## Frameworks

- **Vitest** for everything.
- **`convex-test`** for Convex functions, in the edge-runtime environment.
- No other test framework without an ADR.

## Layout

- Convex tests sit beside the module they test: `convex/loans.test.ts` covers `convex/loans.ts`
  and its model.
- Shared helpers live in `convex/test/`: identity helpers, and factories such as `makeUser`,
  `makeTool` and `makeLoan`.
- Script and library tests sit beside their file: `scripts/check-ids.test.ts`.

## Naming

- `describe` names the function or unit: `describe("loans.approve", …)`.
- `it` reads as a specification of a scenario and its outcome:
  - `it("rejects approval by anyone but the lender", …)`
  - `it("auto-declines overlapping pending requests", …)`

## Structure

- Arrange, act, assert, separated by blank lines, with no section comments.
- One behavior per test. Use table-driven tests (`it.each`) for matrices: roles × functions,
  states × transitions.
- Deterministic: fake timers (`vi.useFakeTimers`, `vi.setSystemTime`) for anything that depends
  on dates or retries; stub `fetch`; no network access.

## What must be tested

- **Access:** every public function, signed out, as the wrong user, and as an admin where it
  matters.
- **Transitions:** every loan transition, from every allowed and every disallowed state.
- **Boundaries:** business rules just inside and just outside each limit (BR-3, BR-5).
- **Result shapes** wherever data minimization applies: assert the exact keys.
- **Integration:**
  - signature checks, valid and each kind of invalid;
  - idempotency, with the same request sent twice and sent concurrently;
  - retry classification and the backoff schedule.

## Evidence

- Completion logs cite tests by `describe › it` name for each acceptance criterion.
- Manual checks are recorded as what was done and what was observed.
- Coverage percentage is not a target. The acceptance criteria are.
