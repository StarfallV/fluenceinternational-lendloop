# LendLoop — Product Requirements

**Status:** v1.4 (2026-11-11): AUT-2, ADM-4 and OPS-1 simplified, and the blocks re-planned,
at the start of block 002. Baseline v1.3 (2026-11-10, revised after planning review
[rounds 1](reviews/planning-baseline-review-1.md), [2](reviews/planning-baseline-review-2.md) and
[3](reviews/planning-baseline-review-3.md))
**Scope:** Everything LendLoop must do, the rules it enforces, and which delivery block delivers
each requirement. Where the brief was silent, the gap is filled here and marked _(decision)_.

---

## 1. Purpose

LendLoop is a neighborhood tool-lending board. Neighbors list tools they are willing to lend and
request to borrow each other's tools for a date range. Lenders approve or decline requests and
mark loans as returned. Automated workflows in n8n handle notifications and overdue reminders.

The product is deliberately small. The engineering focus is on **correct access control**, a
**secure and reliable integration between Convex and n8n**, and a practical, minimal UX.

## 2. Roles

| Role | Who | Summary |
| --- | --- | --- |
| Visitor | Anyone not signed in | Sees the public landing page only |
| `user` | Any signed-in neighbor | Lends and borrows; acts only on their own listings, requests and loans |
| `admin` | Moderator | Everything a `user` can do, plus removing any listing, viewing all loans, marking Trusted Lenders and watching automation health |

An admin is a user with extra powers. Admins get **no** override on other people's loan
decisions (approve, decline, return); least privilege applies _(decision)_.

## 3. Functional requirements

### 3.1 Public page

| ID | Requirement |
| --- | --- |
| PUB-1 | The landing page shows the company name **LendLoop** and the tagline **"Borrow what you need. Lend what you don't."** |
| PUB-2 | The landing page shows a read-only list of **available** tools, read from Convex. Each entry shows the tool **name and category only**, never owner details. A tool is available when it is listed and not currently on loan (BR-12). |
| PUB-3 | A **"Sign in to lend or borrow"** button starts Clerk sign-in. Signed-in visitors see a button into the app instead. |

### 3.2 Listings

| ID | Requirement |
| --- | --- |
| LST-1 | A signed-in user can list a tool with a name, category, condition and short description. |
| LST-2 | The owner can edit their own listing. |
| LST-3 | The owner can delete their own listing, subject to BR-13. |
| LST-4 | Signed-in users can browse all tools with their availability status, filtered by category. Each card shows the owner's display name and a Trusted Lender badge where it applies. |
| LST-5 | A **My listings** view shows the user's own tools. Each shows its availability status and its number of pending requests, which links to Incoming requests. |

### 3.3 Borrowing

| ID | Requirement |
| --- | --- |
| BRW-1 | A signed-in user can request to borrow someone else's tool for a date range, with an optional short note to the lender. |
| BRW-2 | The lender can approve or decline pending requests on their own tools. |
| BRW-3 | The lender can mark a loan as returned. |
| BRW-4 | The borrower can cancel their request while it is pending, or after approval but before the loan starts. The lender can cancel an approved loan before it starts _(decision)_. |
| BRW-5 | A **My requests** view shows the user's requests and loans as a borrower. |
| BRW-6 | An **Incoming requests** view shows requests and loans on the user's tools, pending first, with a count of pending requests in the navigation. |
| BRW-7 | A pending request expires automatically once its start date has passed _(decision)_, so no request is left waiting forever. |

### 3.4 Administration

| ID | Requirement |
| --- | --- |
| ADM-1 | An admin can remove any listing, with an optional reason. |
| ADM-2 | An admin can view all loans, filtered by status. Long-overdue loans (BR-20) are flagged. |
| ADM-3 | An admin can mark or unmark a user as a **Trusted Lender**. The users list shows each user's join date and number of listings, so people with the same display name can be told apart. |
| ADM-4 | An admin can see automation health: failed webhook deliveries (with **Retry** and **Retry all**), recent n8n workflow errors, and when the reminder workflow last ran. The navigation flags anything that needs action: failed deliveries, a workflow error in the last 24 hours, or a reminder workflow that has stopped running _(decision)_. |

### 3.5 Automation

| ID | Requirement |
| --- | --- |
| AUT-1 | **Request notification.** When a borrow request is created or changes status, Convex calls an n8n webhook. The workflow emails the relevant user (§5.4), using only the fields it needs. |
| AUT-2 | **Overdue reminders.** A scheduled n8n workflow fetches overdue loans from a Convex HTTP endpoint once a day, emails each borrower a reminder, and writes the reminder status back to Convex. Each borrower gets at most one reminder per loan per day (BR-20). A reminder that fails stays due, so the next run tries again _(decision)_. |
| AUT-3 | **Automation activity (bonus).** Each loan shows its recent automation activity, for example "Lender notified · 3 minutes ago" or "Overdue reminder sent · 2 days ago". |

## 4. Security, privacy and reliability requirements

| ID | Requirement |
| --- | --- |
| SEC-1 | Two roles, `admin` and `user`, enforced inside Convex functions, not only in the UI. |
| SEC-2 | A `user` can create, edit and delete only their own listings, and act only on requests that involve their own tools or their own borrowing. |
| SEC-3 | Requests between Convex and n8n are signed with HMAC in both directions, and the receiving side verifies every signature. |
| SEC-4 | Secrets live only in environment variables and n8n credentials, never in code or in exported workflow JSON. |
| SEC-5 | Data is minimized everywhere: the public page shows no owner details, n8n receives only the fields it needs, contact details are shared only when needed (BR-16), and error text is redacted before it is stored or shown. |
| SEC-6 | Abuse is limited by field length limits, one open request per tool per borrower, and rate limits on creating listings and requests _(decision)_. |
| REL-1 | Write-backs from n8n are idempotent: retries never create duplicate records or duplicate reminders. |
| REL-2 | Failures are retried, an n8n error workflow handles failed runs, and every failure is recorded where an admin can see it. Nothing fails silently, including n8n being down entirely. |

## 5. Business rules

### 5.1 Listings

| ID | Rule |
| --- | --- |
| BR-1 | **Categories:** Power tools, Hand tools, Garden, Kitchen, Camping, Cleaning, Ladders, Other. |
| BR-2 | **Conditions:** New, Like new, Good, Fair, Worn. |
| BR-3 | **Field limits:** the name is 2–60 characters, the description at most 500, and the request note at most 280. Text is trimmed, required fields cannot be blank, and single-line fields (the tool name) reject control characters such as line breaks. |

### 5.2 Requests and loans

| ID | Rule |
| --- | --- |
| BR-4 | A user cannot request their own tool, or a deleted or removed tool. |
| BR-5 | **Date range:** dates are calendar dates in the app timezone (ADR-008). The start date must be from today to today + 90 days, inclusive. The end date must be on or after the start date, and a loan lasts at most 30 days. Both dates count, so a loan lasts 1 to 30 days. |
| BR-6 | A borrower can have at most one **open** request per tool. Open means pending, or approved and not yet returned. |
| BR-7 | A request whose dates overlap an approved, unreturned loan on the same tool is rejected. Pending requests from different borrowers may overlap; the lender chooses. |
| BR-8 | **Approve:** lender only, pending only, and only if the start date is today or later. Approval re-checks overlap inside the same transaction. Other pending requests that overlap are **declined automatically** with the reason "dates taken". |
| BR-9 | **Decline:** lender only, pending only. |
| BR-10 | **Cancel:** the borrower may cancel while pending, or while approved before the start date. The lender may cancel while approved before the start date. |
| BR-11 | **Mark returned:** lender only, for approved loans whose start date is today or earlier. A tool can be returned early. |
| BR-12 | **Availability**, derived for today: a tool is **On loan** when it has an approved, unreturned loan that has started (including overdue loans); otherwise it is **Available**. The next approved booking is shown as "Booked from &lt;date&gt;". A loan is **overdue** when it is approved, not returned, and its end date is before today. |
| BR-13 | **Deleting a listing:** blocked while the tool is on loan. Otherwise the listing is soft-deleted, and its pending requests and future approved loans are cancelled (reason "listing deleted"), which notifies the borrowers. Loan history keeps the tool's name. |
| BR-14 | **Admin removal:** allowed at any time. Pending requests and future approved loans are cancelled (reason "listing removed"). A loan already in progress stays in place so it can still be returned. The removal is recorded in the audit log. |
| BR-15 | **Expiry:** a pending request whose start date has passed becomes `expired`, and the borrower is notified. |

### 5.3 People and privacy

| ID | Rule |
| --- | --- |
| BR-16 | **Contact details:** other signed-in users see a display name, never an email address. Once a request is approved, and only while the loan is approved, the borrower and lender can see each other's email to arrange pickup. Admin screens show display names, not emails. **Display names** are "Given F." from the Clerk profile (Clerk requires first and last name). If no name is available they are "Neighbor ####", never derived from the email. At most 40 characters, with no control characters. |
| BR-17 | **Trusted Lender:** a flag on a user that only an admin can set. Its badge shows next to the owner's name in signed-in views. Every change is recorded in the audit log. |
| BR-18 | **Admins** are granted only from the command line, by an internal function (`npm run admin:grant -- <email>`). No screen or public function can change a role. |

### 5.4 Notifications

| ID | Rule |
| --- | --- |
| BR-19 | Each loan event emails exactly one recipient: `requested` → the lender; `approved`, `declined`, `expired`, `returned` → the borrower; `cancelled` → the other party. A cancellation caused by a listing deletion or removal goes to the borrower. |
| BR-20 | **Overdue reminders** go to the borrower at most once per loan per calendar day, until the loan is returned, and at most **7** in total _(decision)_. After the 7th, reminders stop and admins see the loan flagged as long overdue. |
| BR-21 | Emails are plain text. **Notification emails** contain only: the recipient's display name, the other party's display name, the tool name, the loan dates, the reason where one applies, and a link back to the app. **Reminder emails** contain only: the borrower's display name, the lender's display name, the tool name, the loan dates, the days overdue, and a link. |

## 6. Non-functional requirements

| ID | Requirement |
| --- | --- |
| UX-1 | Minimal, clean layout that works from 360 px wide upward. Keyboard accessible, with labelled inputs and readable contrast. |
| UX-2 | Every view has loading, empty and error states. Actions confirm or explain failure with a toast that uses plain language. |
| UX-3 | Views update live when data changes (Convex reactivity), with no manual refresh, including when the date changes. |
| QA-1 | TypeScript strict mode. Lint, typecheck and tests pass on every commit, and CI enforces them on every pushed branch. |
| QA-2 | Automated tests cover every access rule, every loan state transition, the business-rule boundaries, signature verification, redaction and idempotency. |
| OPS-1 | A reviewer can run the whole system locally by following the README: a Clerk application, Docker for n8n, a local Convex deployment that needs no account, one setup command, and two browser profiles to act as lender and borrower. |

## 7. Out of scope

Payments and deposits, ratings and reviews, in-app messaging, tool photos, maps and geofencing,
multiple neighborhoods, invite-only sign-up (TD-007), a borrower-side "I returned it" confirmation
(TD-008), notification preferences and unsubscribe, SMS and push notifications, and localization.
Production-only concerns are covered in `docs/production.md` (block 008).

## 8. Deliverables

| ID | Deliverable |
| --- | --- |
| DEL-1 | GitHub repository with the application source |
| DEL-2 | Exported n8n workflow JSON files in the repository |
| DEL-3 | README covering local setup (including n8n via docker-compose), environment variables, architecture, and the security and data-minimization decisions |
| DEL-4 | A short note on what would change to run this in production: summarized in the README, in full in `docs/production.md` |

## 9. Traceability

Each block's completion log records the evidence (test names, manual checks) for the
requirements it delivers. When a block closes, its log is linked in the Evidence column.

| Requirement | Delivered by | Evidence |
| --- | --- | --- |
| PUB-1, PUB-3 | 001 (shell), 002 (sign-in) | [001](logs/001-completion.md) (shell) |
| PUB-2 | 003 (public list), 004 (excludes tools on loan) | — |
| LST-1 – LST-4 | 003, 004 (availability) | — |
| LST-5 | 003 (view), 004 (availability and pending counts) | — |
| BRW-1 – BRW-7 | 004 | — |
| ADM-1 – ADM-3 | 005 | — |
| ADM-4 | 006 (data, retry), 008 (UI) | — |
| AUT-1 | 006 (Convex side), 007 (workflow) | — |
| AUT-2 | 006 (endpoints), 007 (workflow) | — |
| AUT-3 | 006 (data), 008 (UI) | — |
| SEC-1, SEC-2 | 002 (wrappers), 003–005 (rules) | — |
| SEC-3 | 006 (Convex side), 007 (n8n side) | — |
| SEC-4 | 007 (env files, workflows and sanitizer) | — |
| SEC-5 | 003 – 008 | — |
| SEC-6 | 003, 004 | — |
| REL-1 | 006, 007 | — |
| REL-2 | 006, 007, 008 | — |
| UX-1 – UX-3 | 003–005, 008 | — |
| QA-1, QA-2 | 001 (CI), every block (tests) | [001](logs/001-completion.md) (CI, strict TypeScript, lint) |
| OPS-1 | 007, 008 | — |
| DEL-1 – DEL-4 | 007 (workflows), 008 (README, production note) | — |
