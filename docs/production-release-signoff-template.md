# Production release sign-off template

Copy this template into the final MVP release decision record. This template does not authorize deployment and does not replace explicit release approval. Use it only after staging evidence, rollback readiness, and the approved release process are complete.

## Safety rules

- Use placeholders only for environment locations, evidence links, artifact references, backup references, and approver metadata.
- No real staging or production URLs, tokens, cookies, connection strings, secret-manager paths, backup locations, customer data, workbook values, screenshots with private data, or provider-specific identifiers.
- Do not paste production secret values. Record only that required production secrets are confirmed present through the approved secret manager without exposing names, values, identifiers, or paths.
- Do not attach screenshots, logs, workbooks, exports, or database evidence that contain real personal financial data or customer data.
- If prohibited data appears in the release decision record, stop sign-off, remove the evidence, rotate or revoke exposed values where applicable, and replace the evidence with a redacted placeholder.

## Release decision metadata

| Field | Placeholder |
| --- | --- |
| Release owner | `<RELEASE_OWNER>` |
| Reviewer | `<REVIEWER_NAME>` |
| Rollback owner | `<ROLLBACK_OWNER>` |
| Target commit SHA | `<TARGET_COMMIT_SHA>` |
| Release decision record | `<EVIDENCE_LINK>` |
| Decision date | `<DATE>` |

## CI and artifact evidence

| Evidence item | Placeholder | Result | Reviewer | Date |
| --- | --- | --- | --- | --- |
| CI/main evidence for `<TARGET_COMMIT_SHA>` | `<CI_MAIN_EVIDENCE>` | `<pass/blocker>` | `<REVIEWER_NAME>` | `<DATE>` |
| Reviewed build artifact | `<REVIEWED_BUILD_ARTIFACT>` | `<approved/blocked>` | `<REVIEWER_NAME>` | `<DATE>` |
| Last known good artifact | `<LAST_KNOWN_GOOD_ARTIFACT>` | `<available/blocker>` | `<ROLLBACK_OWNER>` | `<DATE>` |
| Target commit SHA matches reviewed artifact | `<TARGET_COMMIT_SHA>` | `<confirmed/blocker>` | `<REVIEWER_NAME>` | `<DATE>` |

## Backup, restore, and rollback readiness

| Readiness item | Placeholder | Owner | Date |
| --- | --- | --- | --- |
| Backup confirmation | `<BACKUP_CONFIRMATION>` | `<ROLLBACK_OWNER>` | `<DATE>` |
| Restore confirmation | `<RESTORE_CONFIRMATION>` | `<ROLLBACK_OWNER>` | `<DATE>` |
| Last known good artifact can be redeployed by the rollback owner | `<LAST_KNOWN_GOOD_ARTIFACT>` | `<ROLLBACK_OWNER>` | `<DATE>` |
| Rollback owner has the approved runbook steps available | `<EVIDENCE_LINK>` | `<ROLLBACK_OWNER>` | `<DATE>` |

## Production configuration confirmation

| Configuration item | Placeholder | Reviewer | Date |
| --- | --- | --- | --- |
| Production secret confirmation without values | `<PRODUCTION_SECRET_CONFIRMATION>` | `<REVIEWER_NAME>` | `<DATE>` |
| HTTPS/security headers | `<SECURITY_HEADER_EVIDENCE>` | `<REVIEWER_NAME>` | `<DATE>` |
| Cookie/cache behavior | `<COOKIE_CACHE_EVIDENCE>` | `<REVIEWER_NAME>` | `<DATE>` |
| Report downloads remain non-cacheable for authenticated financial data | `<COOKIE_CACHE_EVIDENCE>` | `<REVIEWER_NAME>` | `<DATE>` |

## Post-release smoke plan

| Field | Placeholder |
| --- | --- |
| Post-release smoke owner | `<SMOKE_OWNER>` |
| Smoke window | `<SMOKE_WINDOW>` |
| Smoke evidence record | `<EVIDENCE_LINK>` |

Smoke checks:

- [ ] Sign-in reaches the authenticated app shell.
- [ ] Budget period and transaction lists load for the authenticated owner.
- [ ] Debt account and debt payment history load for the authenticated owner.
- [ ] Report export route returns a file response for an approved synthetic or internal test period where policy permits it.
- [ ] Workbook preview remains side-effect free.
- [ ] Workbook apply updates only the selected synthetic period.
- [ ] No smoke evidence contains production secret values, real workbook values, customer data, or screenshots with private data.

## Rollback triggers

Start the rollback path instead of ad hoc production fixes when any approved threshold is met:

- failed health check;
- failed sign-in;
- failed owner-scoped data read;
- failed export;
- failed import apply;
- data integrity anomaly;
- unacceptable error rate;
- exposed secret, private screenshot, real workbook value, or customer data in release evidence.

## Go/no-go decision

| Decision field | Placeholder |
| --- | --- |
| Go/no-go decision | `<GO_OR_NO_GO>` |
| Decision rationale | `<DECISION_RATIONALE>` |
| Release owner | `<RELEASE_OWNER>` |
| Reviewer | `<REVIEWER_NAME>` |
| Rollback owner | `<ROLLBACK_OWNER>` |
| Approver | `<APPROVER_NAME>` |
| Date | `<DATE>` |

A `go` decision in this record is valid only when paired with the separate explicit release approval required by the deployment process. A `no-go` decision keeps the release blocked until the owner records new evidence and approval.
