# 011 — UX polish

**Status:** Planned
**Module:** WEB
**Branch:** feature/011-ux-polish

## Goal
Make every view feel finished: consistent states, clear errors, and a layout that is responsive
and accessible.

## Dependencies
- Depends on: 010
- Depended on by: 012

## Requirements
UX-1, UX-2, UX-3.

## Inputs
- Every route built in blocks 002–010.

## Outputs
- **States:** loading skeletons, empty states that suggest the next action, and error boundaries.
- **Errors:** a map from each `ConvexError` code to a plain-language message. Unknown errors show
  a generic message that never exposes internals.
- **Feedback:** a toast for every mutation.
- **Consistency:** status badges and date formatting are the same everywhere.
- **Navigation:** a mobile menu.
- **Accessibility:** dialogs manage focus; inputs have labels and ARIA attributes; contrast is
  checked.
- **Pages:** a 404 page.

## Acceptance Criteria
- [ ] Every route has loading, empty and error states (checklist per route, recorded).
- [ ] Every error code maps to a plain message, and unknown errors show the generic message (test
      on the mapping).
- [ ] Every flow works at 360 px, with no horizontal scrolling (manual check, recorded).
- [ ] A keyboard-only run through request → approve → return succeeds. Dialogs trap focus and give
      it back when they close (manual check, recorded).
- [ ] Lighthouse accessibility scores 95 or more on the landing, browse and requests pages
      (scores recorded).
