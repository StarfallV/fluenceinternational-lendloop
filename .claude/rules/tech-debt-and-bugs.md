# Tech Debt and Bugs

## Tech-debt register

[docs/tech-debt.md](../../docs/tech-debt.md) is the single list of deferred work. Add an item
when:
- you take a shortcut;
- you write a `TODO`;
- you defer a review finding;
- you find a design gap that doesn't block the current block.

```markdown
### TD-nnn: Short title

- **Source:** Block NNN (context) | BUG-nnn | Planning baseline
- **Module:** PLT | AUTH | TOOL | LOAN | AUTO | WEB
- **Description:** What needs doing, and why.
- **Priority:** Low | Medium | High | Critical
- **Blocked by:** — or the items it waits on
```

| Priority | Meaning |
| --- | --- |
| Critical | Must be fixed before submission; it breaks a requirement |
| High | Should be fixed soon; it causes real friction or risk |
| Medium | A known gap with no immediate effect; it matters for production |
| Low | Cleanup or optimization |

**Never delete an item.** When it is resolved, add a line:
`- **Status: Resolved (block NNN)** — how it was resolved.`

## Bugs

1. **Document it** with `/report-bug`. It creates `docs/bugs/BUG-nnn-<slug>.md` with the
   severity, symptom, root cause and fix approach.
2. **Fix it** on `fix/BUG-nnn-<slug>`, with commits like `fix: … (BUG-nnn)`. Add a test that fails
   before the fix and passes after.
3. **Log it** in `docs/logs/BUG-nnn-completion.md`: root cause, fix, tests, decisions.
4. If the bug reveals a deeper issue, add a tech-debt item that cites `BUG-nnn`.

| Severity | Meaning |
| --- | --- |
| Critical | The app or the development flow is broken |
| High | Wrong behavior on a main path, or a security or privacy issue |
| Medium | Wrong behavior with a workaround, or on a secondary path |
| Low | Cosmetic, or an unlikely edge case |

## Identifiers

- `TD-`, `BUG-` and `ADR-` numbers are sequential across the whole project. Never restart, reuse
  or renumber them.
- With one branch open, take the next number. With branches running in parallel, claim numbers in
  [docs/id-registry.md](../../docs/id-registry.md) first.
- `npm run check:ids` fails CI on any duplicate.
