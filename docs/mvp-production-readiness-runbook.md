# MVP production readiness runbook

This runbook defines the release-hardening path for the MVP. It is an operational checklist only: it does not authorize deployment, infrastructure changes, schema changes, dependency changes, or production data access.

## Scope and non-goals

Use this runbook when preparing a staged or production release review for the current MVP workflows:

- authenticated monthly budgeting, categories, planned rows, and transactions;
- debt accounts, debt payments, linked transaction review, and debt diagnostic;
- monthly CSV, XLSX, and PDF exports;
- workbook preview/apply for planned rows;
- workbook debt diagnostic default required payment apply to existing debt accounts.

Non-goals for this MVP release:

- no bank sync, third-party financial provider integration, AI advice, charts, hard-delete self-service, recurring transactions, multi-currency conversion, collaborative household roles, or public registration;
- no deployment from this repository task without explicit release authorization;
- no real personal workbook values, customer data, access tokens, keys, or live connection strings in docs, logs, tests, issues, or screenshots.

## Secret handling

- Store environment values only in the approved secret manager for the target environment.
- Use placeholders in documentation: `<DATABASE_URL>`, `<AUTH_SECRET>`, `<OIDC_CLIENT_ID>`, `<OIDC_CLIENT_SECRET>`, and `<APP_BASE_URL>`.
- Never paste real tokens, API keys, session cookies, database URLs, production workbook values, backup locations, or customer identifiers into commits, tickets, chat, screenshots, CI logs, or runbooks.
- Rotate a value immediately if it appears outside the approved secret manager.
- Keep `.env` local and untracked. Use `.env.example` only for variable names and safe placeholder guidance.
- Confirm staging and production secrets are separate. A staging value must not grant production access.

## Docker-first local verification

Run local verification in Docker before relying on host checks.

```bash
cp .env.example .env
docker compose config
docker compose up -d --build
docker compose ps
docker compose exec app npm run test
docker compose exec app npm run lint
docker compose exec app npm run typecheck
docker compose exec app npm run db:validate
docker compose exec app npm run db:generate
docker compose exec app npm run build
curl --fail http://127.0.0.1:3000/
docker compose down
docker compose ps
```

Expected result:

- Compose config renders without exposing real secrets.
- App and database containers become healthy enough for commands to run inside the app service.
- Tests, lint, typecheck, Prisma validation/generation, and build pass inside the container.
- The local HTTP smoke check returns success.
- Containers are stopped after verification unless an operator intentionally keeps a local session open.

## CI gates and expected commands

CI should run the same project gates that developers run locally. Required commands for the current package scripts are:

```bash
npm run test
npm run lint
npm run typecheck
npm run build
npm run db:validate
```

Run E2E when browsers and system dependencies are available:

```bash
npm run test:e2e
```

Notes:

- `npm run db:generate` is a local generation check and may run in CI when the environment expects generated Prisma client verification.
- There is no `db:diff-check` package script in the current MVP. Do not document it as a required gate unless the script is added in a separate approved change.
- Treat missing Playwright browsers or system libraries as an environment blocker, not a product pass.
- Do not run breaking dependency remediation automatically. If a dependency audit is requested, capture the advisory, affected path, and proposed mitigation separately.

## Staging checklist

Use only synthetic data in staging.

- [ ] Confirm the staging deployment target, image/tag, commit SHA, and environment name.
- [ ] Confirm staging secrets are loaded from the approved secret manager and are not production secrets.
- [ ] Confirm HTTPS is enabled for the staging URL.
- [ ] Confirm security headers are present for browser responses.
- [ ] Run smoke sign-in with a synthetic account.
- [ ] Create a synthetic monthly period, category, planned income row, planned expense row, and transactions.
- [ ] Add a synthetic debt account, record a debt payment, and link it to an eligible transaction where applicable.
- [ ] Review the debt diagnostic with synthetic income and default required payment data.
- [ ] Export synthetic monthly reports as CSV, XLSX, and PDF.
- [ ] Preview a synthetic workbook, then apply planned rows to the selected period.
- [ ] Apply workbook debt diagnostic default required payment candidates only to existing synthetic active debt accounts.
- [ ] Verify mobile layout on the configured Playwright iPhone viewport and at least one real iPhone Safari device before release approval.

## Production checklist

Do not deploy until staging evidence and rollback readiness are complete.

- [ ] Release owner, reviewer, and rollback owner are named.
- [ ] Target commit SHA matches the reviewed build artifact.
- [ ] CI gates are passing for the target commit.
- [ ] Database migration plan is reviewed and has a tested backup/restore path.
- [ ] Production secrets are present in the approved secret manager and were not shared in plaintext.
- [ ] HTTPS, security headers, cookie settings, and cache behavior are verified.
- [ ] Retention and deletion expectations are acknowledged for MVP operations.
- [ ] Monitoring or manual smoke-check ownership is assigned for the release window.
- [ ] Rollback trigger conditions and rollback commands are available to the release owner.
- [ ] No real customer data is copied into staging or local environments.

## Database migrations and backups

- Review generated migration SQL before applying it to staging or production.
- Back up the target database before any production migration.
- Record backup completion, backup identifier, target database, timestamp, and operator in the release notes without exposing connection strings or secret storage paths.
- Validate restore procedure against a non-production target before production launch.
- Keep migrations forward-only unless an explicit rollback script or restore path is approved.
- Verify Prisma schema consistency with `npm run db:validate` before release.
- Do not run ad hoc SQL against production without approval, scope, and rollback notes.

## Restore and rollback procedures

Prepare rollback before release.

1. Identify the last known good build artifact and commit SHA.
2. Confirm the pre-release database backup exists and is restorable.
3. Define rollback triggers: failed health check, failed sign-in, failed owner-scoped data read, failed export, failed import apply, data integrity anomaly, or unacceptable error rate.
4. If app rollback is enough, redeploy the last known good artifact and run production smoke checks.
5. If data rollback is required, stop writes if the platform supports it, restore the approved backup to the target database, and verify row ownership and critical workflow smoke checks before reopening access.
6. Record what was restored, who approved it, and what evidence confirmed recovery. Do not record secret values.

Minimum post-rollback smoke checks:

- sign-in reaches the authenticated app shell;
- budget period and transaction lists load for the authenticated owner;
- debt account and debt payment history load for the authenticated owner;
- report export route returns a file response for a known safe synthetic or internal test period where policy permits it.

## HTTPS, security headers, retention, and deletion

HTTPS and headers:

- Serve staging and production only over HTTPS.
- Keep authentication cookies secure, HTTP-only, and same-site where supported by the auth provider configuration.
- Confirm response headers include the configured hardening headers expected by the app tests and hosting platform.
- Keep report downloads non-cacheable for authenticated financial data.

Retention and deletion:

- MVP deletion is limited. Debt accounts support archive behavior; this is not the same as irreversible deletion.
- Do not promise automated retention windows, legal hold handling, or end-user self-service deletion unless those capabilities are implemented and verified.
- Handle deletion or export requests manually through an approved operator workflow until product support exists.
- Keep backup retention aligned with the hosting provider and organizational policy; document the active policy outside this repository if it contains sensitive details.

## Synthetic-data-only staging verification

Staging verification must use synthetic data only.

Allowed staging data examples:

- synthetic account names such as `Synthetic Owner`;
- fake categories such as `Synthetic Income`, `Synthetic Rent`, and `Synthetic Debt`;
- fabricated amounts that do not mirror a real personal workbook;
- generated workbook files with fake rows and no real identifiers.

Disallowed staging data:

- real workbook rows, screenshots, names, account labels, creditor labels, transaction descriptions, balances, or exported reports;
- production database copies unless they are formally anonymized through an approved process;
- real access tokens, cookies, or connection strings.

## Known deferred scope and unsupported operations

The MVP does not support:

- bank sync or external provider imports;
- AI financial advice, credit recommendations, or automated debt payoff advice;
- charts or analytics beyond the current summary and diagnostic text;
- recurring transactions;
- public registration or household sharing roles;
- automated data retention/deletion workflows;
- production support for importing real customer workbooks into staging;
- hard delete flows for debt accounts through the UI.

If release validation requires one of these items, open a separate scoped issue instead of expanding this runbook-driven release.
