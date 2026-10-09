# Presupuesto EDOG

A Docker-first, mobile-first Next.js MVP for authenticated monthly budgeting, transaction-backed actuals, debt diagnostics, workbook import support, and monthly report exports. It replaces the manual review path from `Presupuesto-EDOG.xlsx` with owner-scoped app workflows and release-hardening documentation.

## Requirements

- Docker Engine with Compose v2 (Docker Desktop WSL integration on Windows)
- Optional host fallback: Node.js 22.23.1 and npm 10+

## Docker-first setup

```bash
cp .env.example .env
# Replace local placeholder values before running the app.
bash scripts/docker-release-validate.sh
```

The release validation helper keeps the Docker startup non-blocking, avoids printing rendered Compose secrets, and cleans up containers when a validation step fails after startup begins. For transparency, it runs this expanded sequence:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose exec app npm run db:validate
docker compose exec app npm run db:generate
docker compose exec app npm run test
docker compose exec app npm run lint
docker compose exec app npm run typecheck
docker compose exec app npm run build
curl --fail http://127.0.0.1:3000/
docker compose down
docker compose ps
```

The app receives a container-safe `DATABASE_URL` that uses `db:5432`. PostgreSQL data and container dependencies live in named volumes. Do not commit `.env`.

PostgreSQL is intentionally not published to the host by default. This avoids local port collisions while keeping app-to-database traffic on the Compose network. If you need a desktop database client, add a local-only override file that publishes `127.0.0.1:5432:5432` for the `db` service.

If WSL reports `docker: command not found`, enable that distribution under Docker Desktop → Settings → Resources → WSL Integration, then rerun the commands above. Do not replace `db` with `localhost` inside the app container.

## Host checks

Host checks are useful for quick feedback but are not substitutes for Docker validation:

```bash
npm ci
npm run test
npm run lint
npm run typecheck
npm run db:validate
npm run db:generate
npm run build
npx playwright install webkit
npm run test:e2e
```

The pinned Playwright project uses WebKit with the exact `iPhone 13 Pro Max` device descriptor available in `@playwright/test`.

## Supported MVP workflows

### Authenticated budgeting and periods

Budgeting is scoped to an authenticated owner session. Users can create monthly periods, categories, and planned budget rows; server actions derive ownership from the session instead of accepting client-supplied owner identifiers.

### Transactions drive actual totals

Transactions are the source of actual totals for each period. Monthly summaries compare planned rows with confirmed dated transactions, then surface available balance, income, outflows, savings allocations, debt payments, and variance signals without duplicating actual totals in separate manual fields.

### Debt accounts, payments, links, and diagnostic

Debt workflows support active debt accounts, account edits, archive actions, debt payment recording, optional linked transaction review, and a read-only debt diagnostic. The diagnostic uses monthly income and required debt payments as an educational signal, not financial advice.

### Monthly CSV, XLSX, and PDF exports

The reports area exports owner-scoped monthly report data as CSV, XLSX, and PDF files. Export routes load the selected period, planned rows, and transactions from the authenticated owner context and send no-store report responses.

### Workbook preview and apply

The workbook import flow previews `.xlsx` files before writing data. Applying an import confirms planned rows for the selected period; preview remains side-effect free and apply re-parses the workbook server-side before persisting changes.

### Workbook debt diagnostic defaults

Workbook debt diagnostic candidates can be mapped to existing active debt accounts. Applying those selections updates default required payment values on the selected existing debt accounts; it does not create synthetic debt payments or transactions.

## Product contract

See [`docs/phase-0-decisions.md`](docs/phase-0-decisions.md) for the original glossary, safe initial defaults, classification rules, and responsive hierarchy that still constrain the MVP.

## Release hardening docs

- [`docs/mvp-production-readiness-runbook.md`](docs/mvp-production-readiness-runbook.md) defines the local, CI, staging, production, migration, backup, restore, rollback, security header, retention, deletion, and deferred-scope checks for release readiness.
- [`docs/mvp-acceptance-checklist.md`](docs/mvp-acceptance-checklist.md) maps MVP acceptance criteria to evidence and manual gates, including iPhone real-device review, E2E, accessibility, responsive validation, Docker-first validation, import/export checks, and staging/production sign-off.
- [`docs/production-release-signoff-template.md`](docs/production-release-signoff-template.md) records the final MVP production release go/no-go decision, required evidence placeholders, post-release smoke plan, and rollback triggers without authorizing deployment.
