# Agents.md

This file provides guidance to coding agents when working with code in this repository.

## Prerequisites

- **Node.js**: 22.22.0 (managed via Volta)
- **Package Manager**: pnpm 9.14.4

## Essential Commands

**Development:**
- `pnpm run dev` - Start API server with hot reload on port 3000
- `pnpm run dev:background` - Start background processor
- `pnpm run dev:temporal-worker` - Start Temporal worker
- `pnpm run dev:temporal-server` - Start Temporal server for local development

**Database:**
- `pnpm run db:migrate:latest` - Apply latest migrations
- `pnpm run db:migrate:reset` - Drop schema and rerun migrations
- `pnpm run db:seed:import` - Import seed data for local development
- `pnpm run db:migrate:make src/migration/MigrationName` - Generate new migration based on entity changes
- `pnpm run db:migrate:create src/migration/MigrationName` - Create empty migration file
- **Never use raw SQL queries** (`con.query()`) - always use TypeORM repository methods or query builder
- If raw SQL is absolutely necessary, explain the reason and ask for permission before implementing

**Migration Generation:**
When adding or modifying entity columns, **always generate a migration** using:
```bash
# IMPORTANT: Run nvm use from within daily-api directory (uses .nvmrc with node 22.22)
cd /path/to/daily-api
nvm use
pnpm run db:migrate:make src/migration/DescriptiveMigrationName
```
The migration generator compares entities against the local database schema. Ensure your local DB is up to date with `pnpm run db:migrate:latest` before generating new migrations.

**IMPORTANT: Review generated migrations for schema drift.** The generator may include unrelated changes from local schema differences. Always review and clean up migrations to include only the intended changes.

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
- **PostgreSQL** - Primary database with master/slave replication setup. **Prefer read replica for queries** when eventual consistency is acceptable (most read operations). Use primary only for writes and reads that must be immediately consistent after a write.
- **Redis** - Caching and pub/sub via `@dailydotdev/ts-ioredis-pool`
- **Temporal** - Workflow orchestration for background jobs
- **ClickHouse** - Analytics and metrics storage

**Application Entry Points:**
- `src/index.ts` - Main Fastify server setup with GraphQL, auth, and middleware
- `bin/cli.ts` - CLI dispatcher supporting api, background, temporal, cron, personalized-digest modes
- `src/background.ts` - Pub/Sub message handlers and background processing
- `src/cron.ts` - Scheduled task execution
- `src/temporal/` - Temporal workflow definitions and workers
- `src/commands/` - Standalone command implementations (e.g., personalized digest)

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

**Type Safety & Validation:**
- We favor type safety throughout the codebase. Use TypeScript interfaces and types for compile-time type checking.
- **Zod schemas** are preferred for runtime validation, especially for input validation, API boundaries, and data parsing. Zod provides both type inference and runtime validation, making it ideal for verifying user input, API payloads, and external data sources.
- **This project uses Zod 4.x** (currently 4.3.5). Be aware of API differences from Zod 3.x:
  - **Primitive types are now top-level**: Use `z.email()` instead of `z.string().email()`, `z.uuid()` instead of `z.string().uuid()`, `z.url()` instead of `z.string().url()`
  - `z.literal([...])` in Zod 4.x supports arrays and validates that the value matches one of the array elements
  - For enum-like validation of string literals, both `z.literal([...])` and `z.enum([...])` work in Zod 4.x
  - Always consult the [Zod 4.x documentation](https://zod.dev) for the latest API
- When possible, prefer Zod schemas over manual validation as they provide type safety, better error messages, and can be inferred to TypeScript types.

**Business Domains:**
- **Content**: Posts, comments, bookmarks, feeds, sources
- **Users**: Authentication, preferences, profiles, user experience, streaks
- **Squads**: Squad management, member roles, public requests
- **Organizations**: Organization management, campaigns
- **Notifications**: Push notifications, email digests, alerts
- **Monetization**: Paddle subscription management, premium features, cores/transactions
- **Opportunities**: Job matching, recruiter features, candidate profiles

**Testing Strategy:**
- Jest with supertest for integration testing
- Database reset before each test run via pretest hook
- Fixtures in `__tests__/fixture/` for test data
- Mercurius integration testing for GraphQL endpoints
- Avoid creating multiple overlapping tests for the same scenario; a single test per key scenario is preferred
- When evaluating response objects (GraphQL, API), prefer `toEqual` and `toMatchObject` over multiple `expect().toBe()` lines

**Infrastructure Concerns:**
- OpenTelemetry for distributed tracing and metrics
- GrowthBook for feature flags and A/B testing
- OneSignal for push notifications
- Temporal workflows for async job processing
- Rate limiting and caching at multiple layers

**Infrastructure as Code:**
- `.infra/` - Pulumi configuration for deployment
- `.infra/crons.ts` - Cron job schedules and resource limits
- `.infra/common.ts` - Worker subscription definitions
- `.infra/index.ts` - Main Pulumi deployment configuration

## Code Style Preferences

**Keep implementations concise:**
- Prefer short, readable implementations over verbose ones
- Avoid excessive logging - errors will propagate naturally
- Use early returns instead of nested conditionals
- Extract repeated patterns into small inline helpers (e.g., `const respond = (text) => ...`)
- Combine related checks (e.g., `if (!match || match.status !== X)` instead of separate blocks)

**Function style:**
- Prefer const arrow functions over function declarations: `const foo = () => {}` instead of `function foo() {}`
- Prefer single props-style argument over multiple arguments: `const foo = ({ a, b }) => {}` instead of `const foo = (a, b) => {}`
- Don't extract single-use code into separate functions - keep logic inline where it's used
- Only extract functions when the same logic is needed in multiple places

**PubSub topics should be general-purpose:**
- Topics should contain only essential identifiers (e.g., `{ opportunityId, userId }`)
- Subscribers fetch their own data - don't optimize topic payloads for specific consumers
- This allows multiple subscribers with different data needs

**Avoid magic numbers for time durations:**
- Use time constants from `src/common/constants.ts` instead of inline calculations
- Available constants: `ONE_MINUTE_IN_SECONDS`, `ONE_HOUR_IN_SECONDS`, `ONE_DAY_IN_SECONDS`, `ONE_WEEK_IN_SECONDS`, `ONE_MONTH_IN_SECONDS`, `ONE_YEAR_IN_SECONDS`, `ONE_HOUR_IN_MINUTES`, `ONE_DAY_IN_MINUTES`
- Example: Use `2 * ONE_DAY_IN_MINUTES` instead of `2 * 24 * 60`
- Add new constants to `src/common/constants.ts` if needed (they are re-exported from `src/common/index.ts`)

**Type declarations:**
- Only create separate exported types if they are used in multiple places
- For single-use types, define them inline within the parent type
- Example: Instead of `export type FileData = {...}; type Flags = { file: FileData }`, use `type Flags = { file: { ... } }`

**Imports:**
- **Avoid barrel file imports** (index.ts re-exports). Import directly from the specific file instead.
- Example: Use `import { User } from './entity/user/User'` instead of `import { User } from './entity'`
- This improves build times, makes dependencies clearer, and avoids circular dependency issues

**Zod patterns:**
- Use `.nullish()` instead of `.nullable().optional()` - they are equivalent but `.nullish()` is more concise
- **Place Zod schemas in `src/common/schema/`** - not inline in resolver files. Create a dedicated file per domain (e.g., `userStack.ts`, `opportunities.ts`)

## Best Practices & Lessons Learned

**Avoiding Code Duplication:**
- **Always check for existing implementations** before creating new helper functions. Use Grep or Glob tools to search for similar function names or logic patterns across the codebase.
- **Prefer extracting to common utilities** when logic needs to be shared. Place shared helpers in appropriate `src/common/` subdirectories (e.g., `src/common/opportunity/` for opportunity-related helpers).
- **Export and import, don't duplicate**: When you need the same logic in multiple places, export the function from its original location and import it where needed. This ensures a single source of truth and prevents maintenance issues.
- **Example lesson**: When implementing `handleOpportunityKeywordsUpdate`, the function was duplicated in both `src/common/opportunity/parse.ts` and `src/schema/opportunity.ts`. This caused lint failures and maintenance burden. The correct approach was to export it from `parse.ts` and import it in `opportunity.ts`.

**Avoiding N+1 Queries with Lazy Relations:**
- **Never await lazy relations inside loops or map functions** - this causes N+1 query problems where each iteration triggers a separate database query.
- **Batch fetch related entities** using TypeORM's `In()` operator to fetch all related records in a single query, then create a Map for O(1) lookups.
- **Example pattern**:
  ```typescript
  // BAD: N+1 queries - each iteration awaits a lazy relation
  const results = await Promise.all(
    items.map(async (item) => {
      const related = await item.lazyRelation; // Triggers a query per item!
      return { ...related, itemId: item.id };
    })
  );

  // GOOD: Batch fetch with single query + Map lookup
  const relatedIds = items.map((item) => item.relatedId);
  const relatedItems = await repository.findBy({ id: In(relatedIds) });
  const relatedMap = new Map(relatedItems.map((r) => [r.id, r]));
  const results = items.map((item) => {
    const related = relatedMap.get(item.relatedId);
    return { ...related, itemId: item.id };
  });
  ```
- **Example lesson**: In `notifyJobOpportunity`, locations were fetched one-by-one inside a `Promise.all` map by awaiting `locationData.location`. The fix was to extract all `locationId`s upfront, fetch all `DatasetLocation` records in a single query using `In(locationIds)`, and use a Map for lookups.

## Pull Requests

Keep PR descriptions concise and to the point. Reviewers should not be exhausted by lengthy explanations.

## Claude Code Hooks

Hooks are configured in `.claude/settings.json`:

- **File Protection** (PreToolUse): Blocks edits to `pnpm-lock.yaml`, `src/migration/`, `.infra/Pulumi.*`, `.env`, `.git/`
- **Prevent Force Push** (PreToolUse): Blocks `git push --force` and `git push -f`
- **Auto-Lint** (PostToolUse): Runs `eslint --fix` on TypeScript files after edits

## Node.js Version Upgrade Checklist

When upgrading Node.js version, update these files:
- `.nvmrc`
- `package.json` (volta section)
- `Dockerfile`
- `Dockerfile.dev`
- `.circleci/config.yml` (2 places: executor tag and docker image)
- `.infra/.nvmrc`
- `.infra/package.json` (volta section)
- This file (`AGENTS.md` - Prerequisites section)

After updating, run `pnpm install` to check if lock file needs updating and commit any changes.
