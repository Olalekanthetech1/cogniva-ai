# Cogniva

**Understand More. Think Better.**

Cogniva is an AI-powered university learning companion designed to help students build understanding through guided reasoning, interactive explanations, and evidence-aware learning support.

## Product principles

- **Teach, don't merely answer.** Guide students through a problem one meaningful step at a time.
- **Preserve student agency.** Ask for attempts, offer progressive hints, and explain the current step without silently advancing.
- **Be honest about uncertainty.** Confirm ambiguous image/document extraction and disclose unavailable or failed verification.
- **Ground academic claims.** Use uploaded learning materials and credible sources where appropriate; never invent citations.
- **Verify where possible.** Use deterministic tools and subject-specific checks when a capability is available.
- **ZeroMock.** No fabricated production data, pretend processing, static AI answer fallbacks, or false verification statuses.
- **Build incrementally.** Keep the architecture modular without creating premature microservices.

## Repository layout

The intended monorepo structure is documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The initial application lives in `apps/web`; reusable domain capabilities live in `packages/`; background workloads, tests, and product documentation remain separate.

## Product scope

Cogniva is intended for undergraduate university students across academic disciplines. The first implementation milestone is a complete, reliable Socratic tutoring workflow. Subject breadth will expand through capability-declared subject modules rather than unsupported claims that every subject is fully verified.

## Engineering status

The web application foundation is implemented and its CI lint, TypeScript, and production-build checks pass. Phase 1 now introduces the PostgreSQL schema, Drizzle data layer, and Better Auth integration. A live database and email sender must be configured before registration or migrations can run. AI tutoring, document processing, and subject verification are not yet implemented.

## Prerequisites

- Node.js 24.x
- pnpm 12.21.0 (pinned in the root `package.json`)

## Local development

From the repository root:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
pnpm lint
pnpm typecheck
pnpm check
pnpm build
pnpm start
```

## Phase 1 database setup

1. Copy `.env.example` to `.env.local`.
2. Create a PostgreSQL database and set `DATABASE_URL`. For a provider with separate pooled and direct connection URLs, set `DATABASE_MIGRATION_URL` to the direct URL for migrations.
3. Set `BETTER_AUTH_URL` and generate a secret with at least 32 characters of high-entropy random data. Do not commit it.
4. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` using a verified sender. Cogniva keeps registration unavailable until email verification can actually be delivered.
5. Generate and review a migration, then apply it:

```bash
pnpm db:generate
pnpm db:migrate
```

Do not run migrations against production without reviewing the generated SQL and taking an appropriate backup.

## Health check

`GET /api/health` is an application liveness endpoint. It confirms that the web process is responding; it does not claim that the database, authentication email, or AI providers are healthy.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE.md)
- [API conventions](docs/API.md)
- [ZeroMock policy](docs/ZERO_MOCK.md)
- [Global academic architecture](docs/GLOBAL_ACADEMIC_ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
