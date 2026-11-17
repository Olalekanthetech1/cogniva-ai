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

The repository is in Phase 0 (engineering foundation). The web application shell and CI checks are being established. Architecture documents describe intended contracts and implementation phases; they do not imply that database, authentication, AI tutoring, document processing, or verification features are already implemented.

## Prerequisites

- Node.js 24.x
- pnpm 12.19.0 (pinned in the root `package.json`)

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

The first dependency installation generates `pnpm-lock.yaml`. Commit that generated lockfile after installation so subsequent CI runs can use frozen-lockfile installs.

## Health check

The web server exposes `GET /api/health` as an application liveness endpoint. It confirms that the web process is responding; it does not claim that database or AI dependencies are healthy.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE.md)
- [API conventions](docs/API.md)
- [ZeroMock policy](docs/ZERO_MOCK.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
