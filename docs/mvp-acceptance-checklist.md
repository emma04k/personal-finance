# MVP acceptance checklist

This checklist maps the MVP release plan to evidence and manual gates. Use it as a sign-off aid; do not mark a criterion accepted without either command output, a reviewed artifact, or an explicit manual approver.

## Evidence model

| Evidence type | Acceptable evidence | Notes |
| --- | --- | --- |
| Automated command | Command, environment, exit status, and relevant output summary | Prefer Docker-first output for release readiness. |
| Source contract | Passing Vitest contract test or reviewed source diff | Useful for route ownership, docs anchors, and non-runtime contracts. |
| Manual gate | Named approver, date, environment, device/browser, and result | Required for real-device and production checks. |
| Artifact review | Screenshot, exported file, workbook, log excerpt, or release note with synthetic data only | Do not store secrets or real personal data. |

## Plan acceptance matrix

| Acceptance criterion | Evidence | Manual gate |
| --- | --- | --- |
| Authenticated budgeting and periods are available | `npm run test`, source contract tests for budget planning, manual smoke creating a synthetic period/category/planned row | Staging owner confirms owner-scoped access. |
| Transactions are the source of actual totals | Unit tests for monthly summary and transaction workflow, manual smoke adding income/expense/debt/savings transactions | Reviewer confirms actual totals change from transactions, not manual summary fields. |
| Debt accounts, debt payments, linked transactions, and diagnostic work | Unit/config tests for debt account, debt payment, transaction link schema, and diagnostic; manual synthetic debt flow | Reviewer confirms diagnostic is educational and not financial advice. |
| Monthly CSV, XLSX, and PDF exports work | Export route tests and manual file download/open check for CSV, XLSX, and PDF | Reviewer confirms files contain only the authenticated synthetic period data. |
| Workbook preview/apply imports planned rows safely | Workbook preview/apply tests and manual synthetic workbook preview before apply | Reviewer confirms preview is side-effect free and apply is owner-scoped. |
| Workbook debt diagnostic default-payment apply updates existing debt accounts | Import contract test plus manual synthetic workbook with default required payment candidates | Reviewer confirms apply targets existing active debt accounts and does not create synthetic payments or transactions. |
| Security and privacy release posture is documented | Production readiness runbook review, secret scan, security header tests | Release owner confirms no secrets or real data in docs/artifacts. |
| Rollback and restore readiness exists before production | Runbook backup/restore/rollback sections reviewed | Release owner and rollback owner are named before deployment. |

## iPhone and real-device gates

Automated mobile coverage is necessary but not enough for MVP acceptance. This section records the real device gate separately from viewport simulation.

- [ ] Run the Playwright mobile E2E suite with the configured iPhone 13 Pro Max projects when browser dependencies are available.
- [ ] Test portrait and landscape responsive behavior.
- [ ] Manually verify at least one real iPhone Safari device before production approval.
- [ ] Confirm the app shell, bottom navigation, forms, report links, workbook import controls, debt account cards, and debt payment form do not require horizontal scrolling.
- [ ] Confirm text inputs use readable sizing and touch targets are usable with one hand.
- [ ] Record device model, iOS version, Safari version, environment URL, tester, and result.

## E2E, accessibility, and responsive validation

| Gate | Command or evidence | Acceptance expectation |
| --- | --- | --- |
| Unit and source-level contracts | `npm run test` | All tests pass. |
| Playwright E2E | `npm run test:e2e` | Passes when browsers/system dependencies are installed; exact blocker is recorded otherwise. |
| Accessibility semantics | Source contract tests and manual keyboard/screen-reader-oriented review | Forms have labels, inline feedback uses accessible status/alert semantics, and unavailable states are clear. |
| Responsive layout | Playwright iPhone projects plus manual real-device review | No horizontal scrolling at supported mobile widths; controls remain usable. |
| Security headers | `npm run test -- tests/config/security-headers.test.ts` or full test suite | Expected header contract remains in place. |

Manual accessibility review should include sign-in required states, budget forms, transaction forms, debt account/payment forms, report export links, and workbook import preview/apply controls.

## Docker-first validation

Before release sign-off, prefer Docker-first verification over host-only checks.

- [ ] `docker compose config` renders successfully without real secret values in output.
- [ ] `docker compose up -d --build` starts the app and database.
- [ ] `docker compose ps` shows expected services running.
- [ ] `docker compose exec app npm run test` passes.
- [ ] `docker compose exec app npm run lint` passes.
- [ ] `docker compose exec app npm run typecheck` passes.
- [ ] `docker compose exec app npm run db:validate` passes.
- [ ] `docker compose exec app npm run db:generate` passes.
- [ ] `docker compose exec app npm run build` passes.
- [ ] `curl --fail http://127.0.0.1:3000/` passes.
- [ ] `docker compose down` stops local containers after verification.

If Docker is unavailable, record the exact blocker and treat host commands as preliminary evidence only.

## Import and export acceptance

Use synthetic data only.

### Export checks

- [ ] Create or select a synthetic monthly period with planned rows and transactions.
- [ ] Download CSV and verify it opens with expected synthetic monthly rows.
- [ ] Download XLSX and verify it opens with expected synthetic monthly rows.
- [ ] Download PDF and verify it opens with expected synthetic monthly summary content.
- [ ] Confirm exported files are scoped to the authenticated owner and selected period.
- [ ] Confirm report responses are not cached for shared browser sessions.

### Workbook import checks

- [ ] Upload a synthetic `.xlsx` workbook for preview.
- [ ] Confirm preview displays planned income, actual income, planned expense, actual expense, net income, and debt diagnostic sections as available.
- [ ] Confirm preview does not write planned rows before the explicit apply action.
- [ ] Apply planned rows to the selected synthetic period.
- [ ] Reopen the budget period and verify imported planned rows appear once.
- [ ] Select workbook debt diagnostic default required payment candidates for existing active debt accounts.
- [ ] Apply selected debt defaults and verify the existing debt accounts show the updated default required payment.
- [ ] Confirm no synthetic debt payment or transaction was created by debt default apply.

## Manual staging and production gates

### Staging

- [ ] Target staging commit SHA is recorded.
- [ ] Staging uses separate secrets and synthetic data only.
- [ ] HTTPS and expected security headers are verified.
- [ ] Sign-in, budget, transaction, debt, report export, workbook import, and debt default apply smoke checks pass.
- [ ] Playwright mobile E2E either passes or has an exact environment blocker.
- [ ] Real iPhone Safari manual gate passes.
- [ ] Release owner reviews the production readiness runbook.

### Production

- [ ] Production deployment is explicitly approved outside this documentation task.
- [ ] CI is green for the exact release commit.
- [ ] Backup is completed before migration or deployment steps that can affect data.
- [ ] Rollback owner and last known good artifact are identified.
- [ ] Production secrets are confirmed present through the approved secret manager without exposing values.
- [ ] Post-release smoke checks are assigned and time-boxed.
- [ ] Any production issue triggers the runbook rollback criteria instead of ad hoc fixes.

## Sign-off record

Copy this table into the release ticket and fill it with synthetic-data-safe evidence.

| Gate | Environment | Evidence link or command | Result | Approver | Date |
| --- | --- | --- | --- | --- | --- |
| Docker-first validation | Local Docker | `<command output or CI link>` | `<pass/blocker>` | `<name>` | `<date>` |
| CI gates | CI | `<run URL>` | `<pass/blocker>` | `<name>` | `<date>` |
| E2E/mobile | Staging | `<run URL or blocker>` | `<pass/blocker>` | `<name>` | `<date>` |
| Real iPhone Safari | Staging | `<manual evidence>` | `<pass/blocker>` | `<name>` | `<date>` |
| Import/export | Staging | `<synthetic artifact evidence>` | `<pass/blocker>` | `<name>` | `<date>` |
| Production readiness | Production | `<release ticket>` | `<approved/blocked>` | `<name>` | `<date>` |
