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

This repository is at the foundation/scaffolding stage. The architecture documents describe intended contracts and implementation phases; they do not imply that the corresponding features, integrations, providers, or infrastructure are already implemented.

## Development

The repository is configured as a pnpm workspace. Application-specific installation and run commands will be documented after the web application package and its tooling are added.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE.md)
- [API conventions](docs/API.md)
- [ZeroMock policy](docs/ZERO_MOCK.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
