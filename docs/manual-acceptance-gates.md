# Manual acceptance gates

This playbook is for reviewer-operated manual acceptance gates for Phase 29. It is not a staging deployment, not a production deployment, and not evidence that the app completed these gates automatically. A reviewer must execute the steps, record synthetic-data-safe evidence, and leave any blocked item open until a named approver accepts the evidence.

## Scope and reviewer operation

Use this guide when staging reviewers need to execute and record the remaining MVP manual gates.

- Manual gate evidence must come from a reviewer action, an artifact the reviewer opened, or an explicit approver decision.
- The guide does not claim automated completion. Playwright viewport checks can support the review, but they do not replace real iPhone Safari review.
- Do not deploy, promote, migrate, rotate secrets, inspect secret values, or copy production data while using this guide.
- Record blockers plainly with the placeholder evidence fields below instead of guessing or marking a gate as passed.

## Safe evidence placeholders

Use placeholders for all review metadata until the release ticket is filled with approved synthetic-safe values.

| Evidence field | Placeholder |
| --- | --- |
| Environment URL | `<ENVIRONMENT_URL>` |
| Environment name | `<ENVIRONMENT_NAME>` |
| Target commit SHA | `<TARGET_COMMIT_SHA>` |
| Device model | `<DEVICE_MODEL>` |
| iOS version | `<IOS_VERSION>` |
| Safari version | `<SAFARI_VERSION>` |
| Playwright project or viewport | `<PLAYWRIGHT_IPHONE_VIEWPORT>` |
| Tester name | `<TESTER_NAME>` |
| Evidence link | `<EVIDENCE_LINK>` |
| Approver | `<APPROVER_NAME>` |
| Review date | `<DATE>` |
| Result | `<pass/blocker>` |

## Forbidden data and secret handling

Every manual gate must use synthetic data only. Do not enter, upload, export, screenshot, paste, or link evidence containing real personal workbook values, production data, tokens, cookies, API keys, connection strings, or secret manager paths.

Synthetic evidence may include invented account names, invented categories, invented debt labels, invented balances, invented transactions, and invented workbook rows that cannot be mistaken for real personal finance data.

If prohibited data appears in evidence:

1. Stop the review for that gate.
2. Remove the unsafe artifact from the release ticket or evidence store.
3. Ask the responsible owner to rotate or revoke exposed credentials where applicable.
4. Replace the artifact with redacted synthetic evidence and record the blocker resolution.

## Real iPhone Safari review

A real iPhone Safari gate is required before production approval. This is a manual/reviewer-operated check.

Record:

- Environment: `<ENVIRONMENT_URL>` and `<ENVIRONMENT_NAME>`.
- Device: `<DEVICE_MODEL>`, `<IOS_VERSION>`, and `<SAFARI_VERSION>`.
- Tester: `<TESTER_NAME>`.
- Evidence: `<EVIDENCE_LINK>`.
- Result and approver: `<pass/blocker>`, `<APPROVER_NAME>`, and `<DATE>`.

Review steps:

- Sign in with a synthetic account only.
- Open the app shell, bottom navigation, budget forms, transaction forms, debt account cards, debt payment form, report export links, and workbook import controls.
- Check portrait and landscape orientation.
- Check readable text, visible focus/feedback states, and touch targets that can be used with one hand.
- Confirm no horizontal scrolling is required for core flows.
- Record accessibility feedback for labels, status messages, error messages, disabled states, and keyboard or assistive-technology concerns observed during review.

## Playwright iPhone viewport evidence

Playwright iPhone viewport evidence supports, but does not replace, the real iPhone Safari gate.

Record:

- Command or run: `<EVIDENCE_LINK>`.
- Project or viewport: `<PLAYWRIGHT_IPHONE_VIEWPORT>`.
- Environment: `<ENVIRONMENT_URL>`.
- Result, tester, approver, and date: `<pass/blocker>`, `<TESTER_NAME>`, `<APPROVER_NAME>`, and `<DATE>`.

Review expectations:

- Use the configured Playwright iPhone viewport or project.
- Capture evidence for portrait and landscape where available.
- If browser dependencies or system packages are missing, record the exact blocker and do not convert the blocker into a pass.
- Do not treat viewport automation as manual completion.

## Responsive and accessibility review

Run these checks on synthetic data in both real iPhone Safari and supporting viewport evidence when available.

- Portrait and landscape layouts keep navigation, forms, report links, workbook controls, debt account cards, and debt payment controls usable.
- Text scaling remains readable and does not hide required actions.
- Touch targets are large enough to operate without accidental adjacent taps.
- No horizontal scrolling is required at the supported mobile widths.
- Accessibility feedback is recorded for missing labels, unclear errors, non-announced status changes, disabled controls, focus order, and screen-reader-oriented concerns.
- Any blocker includes the affected route, orientation, viewport or device details, expected behavior, actual behavior, and `<EVIDENCE_LINK>`.

## Import and export file review

Use synthetic data only for report export evidence.

- Create or select a synthetic monthly period with planned rows and synthetic transactions.
- Export CSV, XLSX, and PDF reports.
- Open each file locally and verify it contains the expected synthetic period, categories, totals, and transactions.
- Confirm each file is scoped to the authenticated owner and selected period.
- Confirm exported evidence does not include real personal workbook values, production data, tokens, cookies, API keys, connection strings, or secret manager paths.
- Record `<EVIDENCE_LINK>`, `<TESTER_NAME>`, `<APPROVER_NAME>`, `<DATE>`, and `<pass/blocker>` for each file type.

## Workbook preview and apply review

Use a synthetic workbook only.

- Upload a synthetic workbook and review the workbook preview before applying changes.
- Confirm preview is side-effect free and displays available planned income, actual income, planned expense, actual expense, net income, and debt diagnostic sections.
- Apply planned rows only after the preview is reviewed.
- Reopen the selected synthetic period and verify imported planned rows appear once.
- Confirm workbook preview and apply remain owner-scoped to the authenticated synthetic account.
- Record any blocker with `<EVIDENCE_LINK>` and the safe metadata placeholders.

## Debt default apply review

Debt default apply review must target existing active debt accounts and must not create synthetic payments or transactions.

- Start with synthetic existing active debt accounts.
- In workbook preview, identify synthetic debt diagnostic default required payment candidates.
- Apply selected default required payment values only to the existing active debt accounts.
- Verify the debt accounts show the updated default required payment.
- Confirm no synthetic debt payment or transaction was created by debt default apply.
- Record `<EVIDENCE_LINK>`, `<TESTER_NAME>`, `<APPROVER_NAME>`, `<DATE>`, and `<pass/blocker>`.

## Owner-scoped synthetic smoke checks

Run smoke checks with at least two synthetic accounts when feasible.

- Synthetic account A creates a monthly period, categories, planned rows, transactions, a debt account, and a debt payment.
- Synthetic account B must not see or mutate account A's budget, debt, import, or export evidence.
- Report exports, workbook preview, workbook apply, debt default apply, and debt payment links remain scoped to the authenticated synthetic owner.
- Evidence must identify only placeholder reviewer metadata and synthetic labels.
- Any owner-scope failure blocks staging sign-off.

## Evidence record

Copy one row per gate into the staging release evidence template.

| Gate | Environment | Device or viewport | Evidence link | Result | Tester | Approver | Date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Real iPhone Safari | `<ENVIRONMENT_NAME>` | `<DEVICE_MODEL> / <IOS_VERSION> / <SAFARI_VERSION>` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<TESTER_NAME>` | `<APPROVER_NAME>` | `<DATE>` |
| Playwright iPhone viewport | `<ENVIRONMENT_NAME>` | `<PLAYWRIGHT_IPHONE_VIEWPORT>` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<TESTER_NAME>` | `<APPROVER_NAME>` | `<DATE>` |
| Responsive and accessibility review | `<ENVIRONMENT_NAME>` | `<DEVICE_MODEL or PLAYWRIGHT_IPHONE_VIEWPORT>` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<TESTER_NAME>` | `<APPROVER_NAME>` | `<DATE>` |
| Import/export file review | `<ENVIRONMENT_NAME>` | `<DEVICE_MODEL or browser>` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<TESTER_NAME>` | `<APPROVER_NAME>` | `<DATE>` |
| Workbook preview/apply review | `<ENVIRONMENT_NAME>` | `<DEVICE_MODEL or browser>` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<TESTER_NAME>` | `<APPROVER_NAME>` | `<DATE>` |
| Debt default apply review | `<ENVIRONMENT_NAME>` | `<DEVICE_MODEL or browser>` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<TESTER_NAME>` | `<APPROVER_NAME>` | `<DATE>` |
| Owner-scoped synthetic smoke | `<ENVIRONMENT_NAME>` | `<DEVICE_MODEL or browser>` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<TESTER_NAME>` | `<APPROVER_NAME>` | `<DATE>` |
