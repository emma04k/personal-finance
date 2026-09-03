# Presupuesto EDOG

A Docker-first, mobile-first Next.js foundation for replacing the monthly workflow in `Presupuesto-EDOG.xlsx`. Phase 0 provides only the responsive application shell and development tooling; it does not create or simulate financial records.

## Requirements

- Docker Engine with Compose v2 (Docker Desktop WSL integration on Windows)
- Optional host fallback: Node.js 22.23.1 and npm 10+

## Docker-first setup

```bash
cp .env.example .env
# Replace the example local password in .env.
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

The app receives a container-safe `DATABASE_URL` that uses `db:5432`. PostgreSQL data and container dependencies live in named volumes. Do not commit `.env`.

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

## Product contract

See [`docs/phase-0-decisions.md`](docs/phase-0-decisions.md) for the glossary, safe initial defaults, classification rules, and responsive hierarchy.

AI advice, SDKs, routes, tables, tests, and placeholder UI are future scope and are intentionally absent from this phase.
