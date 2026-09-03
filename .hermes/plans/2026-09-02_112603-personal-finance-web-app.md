# Presupuesto EDOG Web Application Execution Plan

> **For Hermes:** Implement this plan incrementally with delegated work units and strict test-driven development. No application code was created while producing this plan.

**Goal:** Build a secure, mobile-first personal-finance web application that replaces the monthly workflow in `Presupuesto-EDOG.xlsx`, preserves its useful budget and debt calculations, and adds history and automation. AI guidance is a future enhancement and is not part of the initial implementation.

**Architecture:** Start as a modular monolith: one Next.js application contains the responsive UI, authenticated server endpoints, and deterministic domain services, backed by PostgreSQL. Do not create AI dependencies, routes, database tables, provider abstractions, or placeholder screens until that future enhancement is explicitly authorized.

**Tech Stack:** Next.js App Router, TypeScript, PostgreSQL, Prisma ORM, Auth.js, Zod, Tailwind CSS, shadcn/ui, Recharts, ExcelJS, Vitest, fast-check, React Testing Library, Playwright, Docker Compose.

---

## 1. Executive decision

Build a single-user-first application that is multi-user-safe internally. The first release must support:

1. Secure sign-in.
2. One budget per calendar month.
3. Planned and actual income.
4. Planned and actual expenses.
5. Automatic totals, variances, remaining balance, and percentage of income spent.
6. Debt accounts and a debt-to-income diagnostic.
7. A dashboard with monthly and category comparisons.
8. Data export and a controlled migration path from the Excel workbook.

Do not start with microservices, bank integrations, autonomous agents, investment recommendations, or complex accounting. Those would increase cost and risk before the core monthly workflow is proven.

## 2. Evidence extracted from the workbook

Source reviewed: `Presupuesto-EDOG.xlsx`.

| Sheet | Useful behavior to preserve |
|---|---|
| `Presupuesto ejemplo` | Demonstrates planned/actual income and expense lines, variances, totals, balance, expense ratio, and a summary chart. |
| `Formato Presupuesto` | Contains the real monthly template: income description, planned income, actual income, expense description, planned expense, actual expense, and expense variance. |
| `Lista Gastos-Ingresos Previstos` | Provides an initial catalog of income and expense groups such as housing, food, transport, loans, pets, savings, and leisure. |
| `DIAGNOSTICO DE DEUDA` | Calculates monthly debt payments divided by net income and classifies the result into four risk bands. |

Workbook formulas and rules to reproduce:

- `totalActualIncome = sum(actual income lines)`.
- `totalActualExpenses = sum(actual expense lines)`.
- `availableBalance = totalActualIncome - totalActualExpenses`.
- `incomeSpentRate = totalActualExpenses / totalActualIncome`.
- `expenseVariance = actualExpense - plannedExpense`.
- `debtPaymentTotal = sum(active monthly debt payments)`.
- `debtToIncomeRate = debtPaymentTotal / netMonthlyIncome`.
- Debt bands:
  - `<= 30%`: ideal.
  - `> 30% and <= 40%`: caution.
  - `> 40% and <= 60%`: capacity exceeded.
  - `> 60%`: over-indebted.

Important workbook limitations to correct:

- It has no explicit month/year dimension, so it cannot provide reliable history.
- Net income and debt information are duplicated across sheets. The current values are not identical, proving that manual duplication can drift.
- The active and example budgets have different fixed row capacities and totals-row behavior; web budget lines must be dynamic.
- The “percentage of income spent” heading spans both a monetary total and the actual percentage, so labels and values are ambiguous.
- Planned expenses use a filter-aware `SUBTOTAL`, while actual expenses use a full `SUM`; the web application must define dashboard totals as all-period totals and label any filtered-view subtotal separately.
- Expense and debt-payment data can be entered separately and accidentally counted twice.
- Savings are mixed into expenses, which obscures both consumption and the true savings rate.
- The category-list sheet contains template/placeholder values and should be treated as a catalog, not imported blindly as transactions.
- The `$` number format does not identify an ISO currency; currency must be selected explicitly during onboarding/import.
- The workbook's visual indicators are useful, but calculations should not depend on formatting or formulas stored in cells.

## 3. Product principles

1. **One source of truth:** dashboards and debt diagnostics derive from the same period-scoped records.
2. **Plan versus reality:** planned amounts and actual transactions are separate concepts.
3. **No double counting:** a debt payment may link to an expense transaction; it is not added again to total expenses.
4. **Savings are allocations:** track savings separately from consumption expenses while still showing total cash outflow. Preserve an Excel-comparable total-outflow rate, but also expose a consumption/debt-spend rate and a savings rate so the diagnosis is not distorted.
5. **Deterministic math first:** TypeScript domain services calculate every financial metric using exact integer minor units.
6. **No speculative AI infrastructure:** AI advice remains a future enhancement; the initial product must be complete and useful without an AI API.
7. **Privacy by default:** no financial details in logs, client-visible secrets, analytics payloads, screenshots, or error reports.
8. **Monthly continuity:** a user can copy planned lines and recurring items into the next month without copying actual transactions.

## 4. MVP functional scope

### 4.1 Authentication and profile

- Auth.js sign-in through passwordless email or an OIDC provider, selected in Phase 0, with server-side validation, rate limiting, and secure HTTP-only cookies. Avoid owning password storage and recovery unless the user explicitly chooses credential authentication.
- Profile settings: explicitly selected ISO currency (COP is the initial proposal, not an inference from `$`), timezone (initial proposal: `America/Bogota`), and preferred debt thresholds.
- Every financial row must carry `userId`; the server derives it from the authenticated session, never from request input.

### 4.2 Monthly budget

- Create, open, close, and reopen a monthly period.
- Copy the previous month's planned budget into a new month.
- Add/edit/archive income and expense categories.
- Enter planned income and planned expense allocations.
- Register actual income and expense transactions with date, description, category, amount, and optional note.
- Automatically aggregate transactions into the month's actual columns.
- Show both income and expense variances:
  - Income variance: `actual - planned`.
  - Expense variance: `actual - planned`; positive values mean overspending.
- Warn, but do not block, when expenses exceed income or a category exceeds its plan.

### 4.3 Dashboard

- Cards: actual income, actual expenses, allocated savings, available balance, income-spent rate, and debt-to-income rate.
- Planned-versus-actual chart.
- Expense-by-category chart.
- Top positive and negative variances.
- Month-to-month trend after at least two periods exist.
- Clear labels when a metric uses planned data because actual data is incomplete.

### 4.4 Debt diagnostic

- Register debt type, lender/name, outstanding balance, annual interest rate when known, minimum/monthly payment, due day, and active status.
- Link a recorded debt payment to the corresponding expense transaction.
- Compute debt-to-income using active required monthly payments and actual net income for the selected month.
- If actual income is unavailable, use planned income only as an explicitly labeled estimate.
- Display the four Excel diagnostic bands, the user's current band, the amount needed to reach the next safer band, and the debts contributing to the ratio.
- Provide educational language, not promises or regulated financial advice.

### 4.5 Data portability

- Export a monthly report to CSV/XLSX and a human-readable PDF summary.
- Import the existing workbook through a preview-and-confirm workflow:
  1. Select the period and currency.
  2. Parse supported sheets.
  3. Show proposed categories, planned values, actual values, and debts.
  4. Flag incomplete, ambiguous, or duplicate rows.
  5. Persist only after explicit confirmation.
- Keep the original file unchanged.

## 5. Explicitly deferred scope

- Automatic bank synchronization.
- Open-banking credentials or card-number storage.
- Autonomous payment execution or budget changes.
- Investment product recommendations.
- Shared household accounts and complex roles.
- Native mobile applications.
- Receipt OCR.
- Snowball/avalanche payoff simulations beyond a basic educational comparison.
- AI advisor, model-provider API, agent chat, AI evaluation suite, and advice-history storage.
- A public MCP server for arbitrary external agents.

These can be revisited after the core workflow has real monthly usage data.

## 6. Proposed user experience

| Route | Purpose |
|---|---|
| `/login` | Secure authentication. |
| `/onboarding` | Currency, timezone, and initial categories. |
| `/dashboard?period=YYYY-MM` | Monthly summary and alerts. |
| `/budget/[period]` | Spreadsheet-like planned/actual income and expense view. |
| `/transactions` | Fast transaction entry, filters, and edits. |
| `/debts` | Debt accounts, payments, and diagnostic. |
| `/reports` | Monthly comparison and exports. |
| `/settings` | Profile, categories, privacy, and data controls. |

UX requirements — the iPhone experience is the primary experience:

- Design mobile-first for Safari on the user's iPhone 13 Pro Max; desktop is an adaptive expansion, not the default layout shrunk onto a phone.
- Validate every critical flow on the real iPhone in portrait and landscape before considering a phase complete. Playwright must also run a WebKit touch-device project using the closest descriptor available in the pinned version.
- Use `width=device-width, initial-scale=1` and never disable zoom.
- Respect the notch, Dynamic Island, and home indicator through `env(safe-area-inset-*)`; fixed headers, bottom navigation, forms, and primary actions must never sit underneath system UI.
- Use `min-height: 100dvh`/dynamic viewport units where appropriate so Safari's collapsing browser chrome does not hide content or actions.
- Use a single-column content hierarchy on phones. Summary cards stack; secondary detail uses disclosure panels rather than dense side-by-side regions.
- Do not render the Excel budget as a wide table on mobile. Use category/line cards with planned amount, actual amount, variance, and an expand/edit action. Keep the comparative table only for tablet/desktop.
- Provide a persistent bottom navigation with no more than five labeled destinations: Summary, Budget, Add, Debts, and More. The central Add action opens fast transaction entry.
- Make transaction capture one-handed: amount first, numeric keyboard, visible category selector, date defaulted to today, optional description collapsed initially, and immediate success/error feedback.
- Every touch target must be at least 44×44 CSS pixels with at least 8 pixels between neighboring targets. Do not rely on hover, swipe, or precision gestures for critical actions.
- Inputs use at least 16px text to prevent unwanted iOS zoom; body text starts at 16px with comfortable line height and supports text scaling without clipping.
- No page may create horizontal viewport scrolling. Long labels and amounts wrap or use intentional, accessible truncation with a way to reveal the full value.
- Charts reflow for narrow screens, expose exact values on tap, limit visible categories, and include a textual summary or accessible table alternative.
- Preserve selected month, filters, draft form state, and scroll position across back navigation. Confirm before dismissing a form with unsaved changes.
- Use semantic color tokens, tabular figures for currency, visible labels, clear focus/pressed/disabled states, and icon plus text for warnings. Debt status must never depend on green/yellow/orange/red alone.
- Respect `prefers-reduced-motion`; keep purposeful interaction feedback brief and avoid layout-shifting animations.
- Provide an installable web-app manifest and iPhone home-screen icons. Offline editing/synchronization is deferred; when offline, show a clear read-only/unavailable state rather than risking conflicting writes.

### 6.1 Responsive layout contract

| Phone | Tablet | Desktop |
|---|---|---|
| Single column, bottom navigation, card-based budget rows, bottom-sheet forms, simplified charts. | Two-column summaries where space permits, adaptive navigation, larger charts, optional comparison table. | Sidebar or top navigation, multi-column dashboard, complete comparison tables, keyboard-efficient editing. |

The design system should be calm, trustworthy, and content-first: accessible contrast, restrained financial colors, 4/8px spacing rhythm, consistent Lucide SVG icons, light and dark system themes, and no decorative “AI” gradients.

## 7. Recommended architecture

### 7.1 Modular monolith

```text
Browser
  -> Next.js UI and Server Actions/API routes
      -> Application services
          -> Budget domain
          -> Debt domain
          -> Reporting domain
      -> Prisma repositories
          -> PostgreSQL
```

Why this shape:

- One deployment and one database are enough for a personal application.
- Domain modules keep calculation rules independent from React and Prisma.
- A future AI enhancement can consume existing read-only reporting services without placing speculative abstractions in the MVP.

### 7.2 Proposed file structure

```text
src/
  app/
    (auth)/login/page.tsx
    (app)/dashboard/page.tsx
    (app)/budget/[period]/page.tsx
    (app)/transactions/page.tsx
    (app)/debts/page.tsx
    api/import/xlsx/route.ts
  modules/
    budget/domain/
    budget/application/
    budget/infrastructure/
    debt/domain/
    debt/application/
    debt/infrastructure/
    reporting/domain/

  components/
  lib/auth/
  lib/db/
  lib/security/
prisma/
  schema.prisma
  migrations/
tests/
  unit/
  integration/
  e2e/
compose.yaml
Dockerfile.dev
Dockerfile
.dockerignore
.env.example
```

The domain folders must not import React or Prisma packages.

## 8. Data model

Store money as non-negative `BIGINT` minor units plus an ISO 4217 currency code. Keep calculations in `bigint`, classify ratios with integer cross-multiplication before display rounding, and serialize monetary DTO fields as decimal strings; never use JavaScript floating-point arithmetic for financial amounts.

| Entity | Essential fields and rules |
|---|---|
| `User` | Identity and ownership root. |
| `UserPreference` | Currency, timezone, accessibility/display preferences, and configurable warning thresholds. |
| `FinancialPeriod` | `userId`, first day of month, currency, `DRAFT/CLOSED`; unique per user/month/currency. |
| `Category` | `userId`, name, kind (`INCOME`, `EXPENSE`, `SAVINGS`, `DEBT_PAYMENT`), group, active flag. |
| `BudgetLine` | Period, category, nullable planned amount, source label, normalized category, and actual-review state; one line per period/category unless intentionally split. `null` means not supplied and zero means deliberately set to zero. |
| `Transaction` | User, period, category, date, description, positive amount in minor units, direction/source, optional note. Actual totals are derived from transactions; line/period review state distinguishes “confirmed zero” from “not entered yet”. |
| `RecurringRule` | Template for planned or actual recurring entries; never silently creates paid transactions. |
| `DebtAccount` | User, type, name, balance, rate, required payment, due day, status. |
| `DebtPayment` | Debt, period, scheduled amount, paid amount, optional linked transaction. |
| `FinancialGoal` | Emergency fund, saving target, due date, progress. Defer UI if needed. |
| `ImportJob` | Source filename/hash, preview status, errors, selected period, and import result. |
| `AuditEvent` | Security and sensitive-change events with redacted metadata. |

Database constraints must enforce ownership, unique period keys, non-negative monetary inputs where appropriate, valid dates, and safe debt-payment links.

## 9. Financial calculation engine

Create pure functions in the domain layer and cover them before UI or database work:

- Sum planned and actual income.
- Sum consumption and debt-payment expenses separately from savings allocations.
- Compute total cash outflow and available balance.
- Compute an Excel-comparable total-outflow rate, plus a consumption/debt-spend rate and a savings rate.
- Compute income and expense variance.
- Compute category utilization.
- Return `not available` rather than infinity for every income-based rate when income is zero.
- Compute debt-to-income and continuous band boundaries.
- Classify debt bands from unrounded integer inputs, not a rounded display percentage.
- Compute the monthly amount required to reach a safer debt band.
- Prevent double counting when a debt payment links to a transaction.
- Define rounding and currency display rules.
- Preserve imported source labels for traceability while normalizing casing, accents, and surrounding whitespace into stable categories; never auto-merge labels that may represent different people, accounts, or debts.

A calculation result should include both the value and metadata such as period, data completeness, and whether planned values were used.

## 10. Future improvement — AI advisor

AI integration is deliberately excluded from the MVP because no provider API is currently available. Do not install an AI SDK or create advisor routes, tables, prompts, placeholder chat screens, or provider interfaces during the initial phases.

When this improvement is authorized later, create a separate reviewed plan. The future advisor should consume deterministic, read-only reporting services; require explicit consent; receive aggregate data by default; cite every numeric claim; have no write, SQL, filesystem, payment, or bank tools; and leave the complete application usable when the provider is unavailable.

## 11. Security and privacy baseline

- Authenticate every application route and server operation.
- Enforce ownership inside each query/mutation, not only in navigation middleware.
- Use secure HTTP-only cookies and CSRF protection for state-changing operations.
- Validate all form, route, and import inputs.
- Rate-limit login, workbook import, and exports using a shared production store/provider when traffic requires it.
- Keep `DATABASE_URL` and authentication secrets in environment variables.
- Add CSP and standard security headers.
- Never log amounts, descriptions, debt names, model prompts, tokens, or uploaded workbook contents.
- Restrict workbook uploads by MIME type, extension, size, ZIP structure, row count, and processing timeout; reject macros and external links.
- Parse imports server-side in an isolated, bounded process and delete temporary files.
- Encrypt transport with HTTPS and use a managed database with encryption and backups.
- Provide data export and account/data deletion.
- Run dependency and secret scanning before deployment.


## 12. Testing and quality strategy

Strict TDD applies to every production behavior: RED, GREEN, REFACTOR in small vertical slices.

### Unit tests

- Money and rounding rules.
- All budget formulas and zero-income behavior.
- Every debt-band boundary: exactly 30%, just over 30%, exactly 40%, just over 40%, exactly 60%, and over 60%.
- Savings-versus-expense classification.
- Debt-payment double-count prevention.
- Property-based invariants: line ordering never changes totals; adding an expense cannot increase available balance; savings change total outflow but not consumption spending; linking a debt payment cannot count it twice.

### Integration tests

- Prisma repositories against a disposable PostgreSQL test database.
- Authentication and cross-user isolation.
- Period creation/copy/close behavior.
- Transaction aggregation into monthly actuals.
- Debt payments linked to transactions.
- Workbook preview, validation, duplicate detection, and confirmed import.


### End-to-end tests

- Sign in -> create month -> add plan -> register transactions -> verify dashboard.
- Register debts -> verify diagnostic band and contributors.
- Export and re-open a monthly report.
- Complete the main monthly flow in Mobile Safari emulation without horizontal scrolling or hidden actions.
- Validate the closest Playwright iPhone profile plus real-device iPhone 13 Pro Max portrait and landscape smoke checks.
- Verify bottom navigation, safe-area spacing, 44×44 touch targets, 16px inputs, text scaling, reduced motion, chart summaries, and unsaved-form protection.

Quality gates inside Docker:

```bash
docker compose exec app npm run test
docker compose exec app npm run test:integration
docker compose exec app npm run lint
docker compose exec app npm run typecheck
docker compose exec app npm run build
docker compose exec app npm run test:e2e
```

## 13. Local development environment

Planned services:

- `app`: Next.js development/runtime container.
- `db`: PostgreSQL with a named persistent volume and health check.
- Optional `db-test`: isolated PostgreSQL database for integration tests.

Required files to create during implementation:

- `compose.yaml`
- `Dockerfile.dev`
- `Dockerfile`
- `.dockerignore`
- `.env.example`

Important container rules:

- Bind-mount the source directory for development.
- Use a named/anonymous container volume for `/app/node_modules` so host dependencies do not shadow container dependencies.
- The application connects to PostgreSQL through hostname `db`, not `localhost`.
- Expected internal URL shape:
  `DATABASE_URL=postgresql://budget:budget@db:5432/personal_finance?schema=public`
- Do not commit the real `.env` file.

Operational flow:

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
docker compose exec app npm run db:migrate
docker compose exec app npm run test
docker compose exec app npm run lint
docker compose exec app npm run build
docker compose down
```

## 14. Deployment recommendation

Initial recommendation:

- Application: the production Docker image on Railway.
- PostgreSQL: Railway managed PostgreSQL with private networking, backups, and an explicitly selected data region.
- Error monitoring: privacy-filtered Sentry or equivalent, optional for the first local milestone.

Tradeoff: Railway keeps local and production execution close because both use the Docker image, which reduces deployment drift and simplifies bounded XLSX/PDF processing. Vercel plus Neon remains a valid alternative if free/serverless operation becomes more important than container parity. If full self-hosting becomes a requirement, the same production Dockerfile can target Coolify.

## 15. Phased execution plan

### Phase 0 — Validate product rules and bootstrap

**Outcome:** Agreed business glossary, acceptance criteria, and reproducible project shell.

- Confirm currency/timezone defaults and the meaning of “net income”.
- Select passwordless email or OIDC authentication and define registration as single-user, invite-only, or open.
- Confirm whether the first release is single-user-only at the UI level.
- Document expense, savings, and debt-payment classification.
- Define the mobile information hierarchy, bottom navigation, safe-area tokens, responsive breakpoints, and phone/tablet/desktop component behavior before implementing pages.
- Scaffold Next.js/TypeScript and Docker Compose.
- Configure lint, typecheck, Vitest, Playwright, Prisma, and CI.
- Create `.env.example`; verify no secrets are tracked.

**Gate:** Containers start detached; a smoke test, lint, typecheck, and production build pass. The responsive shell has no horizontal overflow and remains usable with iOS safe areas and text scaling.

### Phase 1 — Financial domain engine

**Outcome:** Workbook calculations exist as framework-independent, tested domain rules.

- Implement money, budget summary, variance, savings, and debt diagnostic value objects/functions through strict TDD.
- Encode exact debt-band boundaries.
- Add completeness metadata and zero-income behavior.

**Likely paths:** `src/modules/budget/domain/`, `src/modules/debt/domain/`, `tests/unit/`.

**Gate:** All workbook-derived scenarios and edge cases pass without database or UI dependencies.

### Phase 2 — Persistence and secure ownership

**Outcome:** Authenticated users can own isolated periods and financial records.

- Add Prisma schema and migrations.
- Add Auth.js and secure session handling.
- Implement repositories and ownership tests.
- Seed the category catalog from the workbook without importing its placeholder amounts.

**Likely paths:** `prisma/schema.prisma`, `src/lib/auth/`, `src/lib/db/`, module infrastructure folders, `tests/integration/`.

**Gate:** Cross-user reads and writes fail; migrations and repository tests pass in PostgreSQL.

### Phase 3 — Monthly budget and transactions

**Outcome:** The Excel monthly workflow works end to end in the browser.

- Build period creation and previous-plan copy.
- Build income/expense planning tables.
- Build one-handed mobile transaction entry and card-based mobile budget rows; keep tables for wider screens only.
- Aggregate actual values from transactions.
- Add close/reopen behavior and recurring templates.

**Likely paths:** `src/app/(app)/budget/`, `src/app/(app)/transactions/`, `src/modules/budget/application/`.

**Gate:** E2E flow reproduces planned/actual totals, variances, balance, and expense rate. The complete flow passes in the WebKit touch-device project and is manually verified on the iPhone 13 Pro Max.

### Phase 4 — Dashboard and reports

**Outcome:** The user can understand the month without reading rows manually.

- Add summary cards and planned-versus-actual chart.
- Add category distribution and variance rankings.
- Add history and period comparison.
- Ensure statuses are accessible without relying on color.
- Reflow charts and metric cards for phone screens and provide text/table alternatives.

**Likely paths:** `src/app/(app)/dashboard/`, `src/modules/reporting/`, `src/components/charts/`.

**Gate:** Dashboard values match domain-service outputs for known fixtures and remains readable without horizontal scrolling in portrait and landscape.

### Phase 5 — Debt accounts and diagnostic

**Outcome:** The Excel debt diagnosis becomes period-aware and consistent with the budget.

- Add debt accounts and required-payment schedules.
- Link debt payments to transactions.
- Show band, contributors, and safer-band target.
- Add clear estimated-versus-actual labeling.

**Likely paths:** `src/app/(app)/debts/`, `src/modules/debt/`, `tests/e2e/debt-diagnostic.spec.ts`.

**Gate:** Every threshold boundary and no-double-count scenario passes.

### Phase 6 — Workbook migration and exports

**Outcome:** Existing data can be brought in safely and monthly records remain portable.

- Implement read-only workbook parsing and preview.
- Add validation, duplicate detection, and explicit confirmation.
- Export monthly CSV/XLSX and PDF summaries.

**Likely paths:** `src/app/api/import/xlsx/route.ts`, `src/modules/import/`, `src/modules/reporting/`.

**Gate:** Original workbook remains unchanged; import is idempotent for the same file/period; exported totals match the app.

### Phase 7 — Hardening and deployment

**Outcome:** A recoverable, observable, production-ready release.

- Run security review, dependency audit, accessibility checks, and full E2E suite.
- Complete real-device Safari testing on the iPhone 13 Pro Max in portrait and landscape, including text scaling, safe areas, slow network, and add-to-home-screen behavior.
- Configure backups, migrations, HTTPS, security headers, retention, and deletion flow.
- Deploy staging, verify with synthetic data, then deploy production.
- Document restore and rollback procedures.

**Gate:** CI and staging verification pass; no real workbook or secret appears in source control, logs, fixtures, screenshots, or test artifacts.

## 16. Work-unit commit strategy

Use small English Conventional Commits during implementation, for example:

- `chore: scaffold containerized web app`
- `test: define monthly budget calculation rules`
- `feat: add monthly budget domain engine`
- `feat: add user-owned financial periods`
- `feat: add transaction-based actual totals`
- `feat: add debt capacity diagnostic`
- `feat: add workbook import preview`
- `chore: harden production deployment`

Each commit must pass the tests for its vertical slice before the next slice starts.

## 17. MVP acceptance criteria

- A signed-in user can create a month and enter planned income and expenses.
- Actual totals come from dated transactions rather than duplicated manual totals.
- The budget screen shows the Excel-equivalent totals, variances, balance, and income-spent rate.
- Zero income never produces an invalid percentage or application error.
- A missing amount remains distinguishable from a deliberately recorded zero, and incomplete periods are labeled as such.
- Dashboard totals include the complete selected period; any filtered-view subtotal is labeled separately.
- Every period has an explicitly selected ISO currency; the importer never infers it from the `$` symbol.
- Savings are visible separately from consumption expenses and total cash outflow.
- Debt diagnosis uses the selected period's income and active monthly debt payments.
- All four debt-risk bands behave correctly at their boundaries.
- Linked debt payments are not counted twice.
- The dashboard and debt screen use the same underlying records.
- The existing workbook can be previewed before import and remains unchanged.
- The app can export a monthly report.
- Every critical workflow is usable on the iPhone 13 Pro Max in portrait and landscape without horizontal scrolling, hidden controls, or content behind safe areas.
- Mobile touch targets are at least 44×44 CSS pixels, form text is at least 16px, charts have accessible summaries, and the interface survives text scaling and reduced motion.
- Unit, integration, E2E, accessibility, responsive, lint, typecheck, and build gates run in Docker.

## 18. Risks and tradeoffs

| Risk | Mitigation |
|---|---|
| Spreadsheet concepts become duplicated database values | Derive summaries from transactions and budget lines; do not store calculated totals as competing sources of truth. |
| Debt payments are double-counted | Link debt payment to one transaction and test the invariant. |
| Desktop spreadsheet layout becomes unusable on mobile | Use card-based budget rows, one-column hierarchy, bottom navigation, safe-area spacing, and real-device Safari gates. |
| Workbook import accepts malformed ZIP/XML | Bounded parser, no macros/external links, preview, limits, timeout, and isolated processing. |
| Scope expands into accounting/banking software | Keep the MVP focused on monthly personal budgeting and debt awareness. |
| Framework/provider lock-in | Keep domain rules independent and place Prisma/Auth behind application interfaces only where replacement has real value. |
| Mobile Safari viewport and keyboard behavior hide actions | Use dynamic viewport units, safe-area insets, non-fixed fallbacks, and tests with the virtual keyboard and orientation changes. |

## 19. Decisions to confirm before implementation

These do not block this plan, but Phase 0 must settle them:

- Whether account registration is open, invite-only, or a single preconfigured user.
- Whether monthly income in the debt diagnostic means only salary or all net income sources.
- Whether debt required payments come from the current month, a debt default, or both with an override.
- Whether initial deployment should use Railway managed services or the same Docker image on Coolify.

## 20. Reference documentation

- Auth.js for Next.js: https://authjs.dev/reference/nextjs
- Prisma with Docker: https://www.prisma.io/docs/guides/deployment/docker
- Playwright device emulation: https://playwright.dev/docs/emulation

## 21. First implementation checkpoint

When implementation is authorized, execute only Phase 0 first. Present the generated project structure, Docker status, real test/lint/typecheck/build output, and proposed commit message before moving to the financial domain engine.
