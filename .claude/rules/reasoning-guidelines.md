# Reasoning Guidelines

## Ownership

- Own the problems you find. Don't dismiss one as "not caused by my changes" or "a pre-existing
  issue". Either fix it, or record it as a tech-debt item with a real reason why it is out of
  scope.
- Don't stop at the first obstacle. Look for another way through before reporting a blocker.
- When you can solve something, solve it. Ask only for decisions that belong to the developer:
  scope, product rules, accounts, anything irreversible.

## Method

- **Research first.** Read the code, docs and installed packages before changing anything.
  Reason from what is actually there, not from memory.
- **Plan multi-step work before acting:** which files to read, in what order, and with which
  tools.
- **Make surgical edits** rather than sweeping rewrites.
- **Check your own work:** re-read the diff, run the checks, and compare the result against the
  acceptance criteria before calling something done.
- **Think deeply.** The cost of extra reasoning is small next to the cost of a wrong assumption
  that has to be undone later.
