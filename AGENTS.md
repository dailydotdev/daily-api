# Agents.md

This file provides guidance to coding agents when working with code in this repository.

## Essential Commands

**Development:**
- `pnpm run dev` - Start API server with hot reload on port 5000
- `pnpm run dev:background` - Start background processor
- `pnpm run dev:temporal-worker` - Start Temporal worker
- `pnpm run dev:temporal-server` - Start Temporal server for local development

**Database:**
- `pnpm run db:migrate:latest` - Apply latest migrations
- `pnpm run db:migrate:reset` - Drop schema and rerun migrations
- `pnpm run db:seed:import` - Import seed data for local development
- `pnpm run db:migrate:make` - Generate new migration based on entity changes
- `pnpm run db:migrate:create` - Create empty migration file

**Building & Testing:**
- `pnpm run build` - Compile TypeScript to build directory
- `pnpm run lint` - Run ESLint (max 0 warnings)
- `pnpm run test` - Run full test suite with database reset
- `pnpm run cli` - Run CLI commands (e.g., `pnpm run cli api`)

**Individual Test Execution:**
- Remember to run only individual tests when possible for faster feedback
- `NODE_ENV=test npx jest __tests__/specific-test.ts --testEnvironment=node --runInBand`
- Use `--testEnvironment=node --runInBand` flags for database-dependent tests

## High-Level Architecture

**Core Framework Stack:**
- **Fastify** - Web framework with plugins for CORS, helmet, cookies, rate limiting
- **Mercurius** - GraphQL server with caching, upload support, and subscriptions
- **TypeORM** - Database ORM with entity-based modeling and migrations
- **PostgreSQL** - Primary database with master/slave replication setup
- **Redis** - Caching and pub/sub via ioRedisPool
- **Temporal** - Workflow orchestration for background jobs
- **ClickHouse** - Analytics and metrics storage

**Application Entry Points:**
- `src/index.ts` - Main Fastify server setup with GraphQL, auth, and middleware
- `bin/cli.ts` - CLI dispatcher supporting api, background, temporal, cron modes
- `src/background.ts` - Pub/Sub message handlers and background processing
- `src/cron.ts` - Scheduled task execution

**GraphQL Schema Organization:**
- `src/graphql.ts` - Combines all schema modules with transformers and directives
- `src/schema/` - GraphQL resolvers organized by domain (posts, users, feeds, etc.)
- `src/directive/` - Custom GraphQL directives for auth, rate limiting, URL processing
- **Docs**: See `src/graphorm/AGENTS.md` for comprehensive guide on using GraphORM to solve N+1 queries. GraphORM is the default and preferred method for all GraphQL query responses. Use GraphORM instead of TypeORM repositories for GraphQL resolvers to prevent N+1 queries and enforce best practices.

**Data Layer:**
- `src/entity/` - TypeORM entities defining database schema
- `src/migration/` - Database migrations for schema evolution  
- `src/data-source.ts` - Database connection with replication configuration

**Core Services:**
- `src/Context.ts` - Request context with user, permissions, and data loaders
- `src/auth.ts` - Authentication middleware and user context resolution
- `src/dataLoaderService.ts` - Efficient batch loading for related entities
- `src/workers/` - Use workers for async, non-critical operations (notifications, reputation, external syncs). Prefer `TypedWorker` for type safety. Architecture uses Google Pub/Sub + CDC (Debezium) for reactive processing. See `src/workers/AGENTS.md` for more.
- `src/integrations/` - External service integrations (Slack, SendGrid, etc.) 
- `src/cron/` - Scheduled cron jobs for maintenance and periodic tasks. One file per cron, registered in `index.ts`, deployed via `.infra/crons.ts` Pulumi config. Each cron exports a `Cron` object with `name` and `handler(DataSource, logger, pubsub)`. Run locally with `pnpm run cli cron <name>`. See `src/cron/AGENTS.md` for more.

**Business Domains:**
- **Content**: Posts, comments, bookmarks, feeds, sources
- **Users**: Authentication, preferences, profiles, user experience
- **Organizations**: Squad management, member roles, campaigns
- **Notifications**: Push notifications, email digests, alerts
- **Monetization**: Paddle subscription management, premium features

**Testing Strategy:**
- Jest with supertest for integration testing
- Database reset before each test run via pretest hook
- Fixtures in `__tests__/fixture/` for test data
- Mercurius integration testing for GraphQL endpoints

**Infrastructure Concerns:**
- OpenTelemetry for distributed tracing and metrics
- GrowthBook for feature flags and A/B testing
- OneSignal for push notifications
- Temporal workflows for async job processing
- Rate limiting and caching at multiple layers