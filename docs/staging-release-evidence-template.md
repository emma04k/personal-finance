# Staging release evidence template

Copy this template into the release ticket for staging sign-off. Keep every entry synthetic-data-only and replace placeholders with safe release metadata or evidence links only.

## Safety rules

- Use synthetic data only for every smoke check, import/export artifact, screenshot, and log excerpt.
- Do not paste real personal workbook values, production data, access tokens, session cookies, API keys, connection strings, or secret manager paths.
- Do not include production database copies, customer identifiers, real account labels, creditor labels, balances, transaction descriptions, workbook rows, exported reports, or screenshots derived from real data.
- Do not include plaintext secret values, secret names, secret identifiers, backup locations, or provider-specific secret manager paths. Record only that staging secrets are loaded from the approved secret manager and are not production secrets.
- If evidence accidentally exposes a prohibited value, stop review, remove the evidence from the ticket, rotate or revoke the exposed value where applicable, and attach only a redacted replacement.

## Release metadata

| Field | Evidence value |
| --- | --- |
| Target commit SHA | `<TARGET_COMMIT_SHA>` |
| Staging URL | `<STAGING_URL>` |
| Environment name | `<ENVIRONMENT_NAME>` |
| Release owner | `<RELEASE_OWNER>` |
| Reviewer | `<APPROVER_NAME>` |
| Release ticket | `<EVIDENCE_LINK>` |

## Source checklist mapping

This record maps to `docs/mvp-production-readiness-runbook.md` `## Staging checklist` and `docs/mvp-acceptance-checklist.md` `## Sign-off record`. Complete every row with synthetic-safe evidence before staging approval.

## CI evidence

| Check | Evidence link or command | Result | Approver | Date |
| --- | --- | --- | --- | --- |
| CI gates for `<TARGET_COMMIT_SHA>` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| `npm run test` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| `npm run lint` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| `npm run typecheck` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| `npm run build` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| `npm run db:validate` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |

## Docker-first evidence

| Runbook staging item | Evidence link or command | Result | Approver | Date |
| --- | --- | --- | --- | --- |
| Docker-first validation | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| `docker compose config --quiet` confirms Compose config without printing real secrets | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| `docker compose up -d --build` starts app and database services | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| In-container app gates complete for test, lint, typecheck, build, and db:validate | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Local smoke check and `docker compose down` complete | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |

## Staging deployment target and secret separation

| Runbook staging item | Evidence value |
| --- | --- |
| Confirm the staging deployment target | `<EVIDENCE_LINK>` |
| Confirm image/tag | `<EVIDENCE_LINK>` |
| Confirm commit SHA | `<TARGET_COMMIT_SHA>` |
| Confirm environment name | `<ENVIRONMENT_NAME>` |
| Confirm staging secrets are loaded from the approved secret manager | `<EVIDENCE_LINK>` |
| Confirm staging secrets are not production secrets | `<APPROVER_NAME>` |

## HTTPS and security-header evidence

| Runbook staging item | Evidence link or command | Result | Approver | Date |
| --- | --- | --- | --- | --- |
| Confirm HTTPS is enabled for the staging URL | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Confirm security headers are present for browser responses | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Confirm authenticated report responses remain non-cacheable where applicable | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |

## Synthetic smoke results

Use `docs/manual-acceptance-gates.md#owner-scoped-synthetic-smoke-checks` for reviewer-operated manual smoke steps and safe evidence rules.

| Runbook staging item | Evidence link or command | Result | Approver | Date |
| --- | --- | --- | --- | --- |
| Run smoke sign-in with a synthetic account | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Create a synthetic monthly period | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Create a synthetic category | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Create a planned income row | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Create a planned expense row | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Create synthetic transactions | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Add a synthetic debt account | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Record a debt payment | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Link debt payment to an eligible transaction where applicable | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Review the debt diagnostic with synthetic income and default required payment data | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |

## Import/export evidence

Use `docs/manual-acceptance-gates.md#import-and-export-file-review`, `docs/manual-acceptance-gates.md#workbook-preview-and-apply-review`, and `docs/manual-acceptance-gates.md#debt-default-apply-review` for reviewer-operated import/export gates.

| Runbook staging item | Evidence link or command | Result | Approver | Date |
| --- | --- | --- | --- | --- |
| Export synthetic monthly reports as CSV | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Export synthetic monthly reports as XLSX | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Export synthetic monthly reports as PDF | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Preview a synthetic workbook | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Preview a synthetic workbook, then apply planned rows to the selected synthetic period | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Apply workbook debt diagnostic default required payment candidates only to existing synthetic active debt accounts | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Confirm no synthetic debt payment or transaction was created by debt default apply | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |

## Mobile and iPhone evidence

Use `docs/manual-acceptance-gates.md#real-iphone-safari-review`, `docs/manual-acceptance-gates.md#playwright-iphone-viewport-evidence`, and `docs/manual-acceptance-gates.md#responsive-and-accessibility-review` for mobile manual gates.

| Manual evidence row | Evidence link or command | Result | Approver | Date |
| --- | --- | --- | --- | --- |
| E2E/mobile Playwright mobile viewport check on the configured Playwright iPhone viewport | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Verify mobile layout on the configured Playwright iPhone viewport and at least one real iPhone Safari device before release approval | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Record device model, iOS version, Safari version, environment URL, tester, and result using placeholders or synthetic-safe text only | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |

## MVP acceptance checklist sign-off rows

| Gate | Environment | Evidence link or command | Result | Approver | Date |
| --- | --- | --- | --- | --- | --- |
| Docker-first validation | Local Docker | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| CI gates | CI | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| E2E/mobile | `<ENVIRONMENT_NAME>` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Real iPhone Safari | `<ENVIRONMENT_NAME>` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Import/export | `<ENVIRONMENT_NAME>` | `<EVIDENCE_LINK>` | `<pass/blocker>` | `<APPROVER_NAME>` | `<DATE>` |
| Production readiness | Production review only; do not deploy from this template | `<EVIDENCE_LINK>` | `<approved/blocked>` | `<APPROVER_NAME>` | `<DATE>` |

## Approvals

| Approval | Owner or approver | Evidence link | Decision | Date |
| --- | --- | --- | --- | --- |
| Release owner staging sign-off | `<RELEASE_OWNER>` | `<EVIDENCE_LINK>` | `<approved/blocked>` | `<DATE>` |
| Security/privacy reviewer confirms no prohibited data appears in the ticket | `<APPROVER_NAME>` | `<EVIDENCE_LINK>` | `<approved/blocked>` | `<DATE>` |
| Product reviewer confirms staging checklist coverage | `<APPROVER_NAME>` | `<EVIDENCE_LINK>` | `<approved/blocked>` | `<DATE>` |
| Rollback owner acknowledges production readiness review remains separate | `<APPROVER_NAME>` | `<EVIDENCE_LINK>` | `<approved/blocked>` | `<DATE>` |
