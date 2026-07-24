# Agents.md

This file provides guidance to coding agents when working with code in this repository.

## Prerequisites

- **Node.js**: 24.18.0 (managed via Volta)
- **Package Manager**: pnpm 10.33.4 (`corepack enable && corepack prepare pnpm@10.33.4 --activate`)

## Essential Commands

**Development:**

- `pnpm run dev` - API server with hot reload on port 3000
- `pnpm run dev:background` / `dev:worker-job` / `dev:temporal-worker` / `dev:temporal-server` - other processes

**Database:**

- `pnpm run db:migrate:latest` - Apply migrations
- `pnpm run db:migrate:reset` - Drop schema and rerun migrations
- `pnpm run db:seed:import` - Import seed data
- `pnpm run db:migrate:make src/migration/MigrationName` - Generate migration from entity changes
- `pnpm run db:migrate:create src/migration/MigrationName` - Create empty migration

**Building & Testing:**

- `pnpm run build` - TypeScript compilation
- `pnpm run lint` - ESLint (max 0 warnings)
- `pnpm run test` - Full test suite with database reset
- `pnpm run cli` - CLI commands (e.g., `pnpm run cli cron <name>`)
- Individual tests (faster): `NODE_ENV=test npx jest __tests__/specific-test.ts --testEnvironment=node --runInBand`

## Migrations

- **Never use raw SQL queries** (`con.query()`) in application code — use TypeORM repository methods or query builder. If raw SQL is truly necessary, ask for permission first.
- To generate a migration, run `nvm use` inside daily-api first (uses `.nvmrc`), ensure the local DB is up to date (`db:migrate:latest`), then `db:migrate:make`. **Review the generated migration for schema drift** — the generator diffs against your local DB and may include unrelated changes; keep only the intended ones.
- After generating, use the `/format-migration` skill to format the SQL.
- **Never use `CONCURRENTLY`** — TypeORM runs migrations inside a transaction, where `CREATE/DROP INDEX CONCURRENTLY` fails.
- **Always use `IF NOT EXISTS` / `IF EXISTS`** on index creation/drops so migrations are idempotent.

## High-Level Architecture

**Stack:** Fastify + Mercurius (GraphQL) + TypeORM + PostgreSQL (master/replica) + Redis + Temporal + ClickHouse. OpenTelemetry tracing, GrowthBook feature flags, OneSignal push.

**Prefer the read replica** for queries where eventual consistency is acceptable (most reads). Use primary only for writes and reads that must be immediately consistent after a write.

**Entry points:**

- `src/index.ts` - Main Fastify server (GraphQL, auth, middleware)
- `bin/cli.ts` - CLI dispatcher: api, background, temporal, cron, personalized-digest, worker-job
- `src/background.ts` - Pub/Sub workers; `src/cron.ts` - scheduled tasks; `src/temporal/` - Temporal workflows; `src/commands/` - standalone commands

**Key directories & sub-docs:**

- `src/schema/` - GraphQL resolvers by domain; `src/graphql.ts` combines them; `src/directive/` - custom directives
- `src/graphorm/AGENTS.md` - **GraphORM is the default for all GraphQL query resolvers** (N+1 prevention)
- `src/workers/AGENTS.md` - Pub/Sub + CDC (Debezium) background workers; `src/workers/job/AGENTS.md` - WorkerJob system
- `src/cron/AGENTS.md` - cron jobs; `src/routes/public/AGENTS.md` - public REST API
- `src/entity/` - TypeORM entities; `src/migration/`; `src/data-source.ts` - replication config
- `src/Context.ts` - request context; `src/auth.ts`; `src/integrations/` - external services
- `.infra/` - Pulumi IaC: `.infra/crons.ts` (cron schedules), `.infra/common.ts` (worker subscriptions), `.infra/index.ts`

**Roles:** System moderators have `Roles.Moderator` in `ctx.roles` (ban posts, delete any post/comment, manage squad members in any squad); the `@auth(requires: [MODERATOR])` directive restricts mutations to them. Squad-level roles (`SourceMemberRoles`: Admin/Moderator/Member/Blocked) are per-squad, stored in `SourceMember.role` — a different concept.

## GraphQL Rules

- Use `graphorm.query` / `queryOne` / `queryPaginated` for query resolvers; manual TypeORM reads only when GraphORM can't express the pattern. Default pure `Query` reads to the read replica (via `queryReadReplica(...)` or GraphORM's read-replica flag).
- **One GraphQL type per entity** — before adding a type, check whether one already maps `from` that entity; extend it instead of creating a parallel type.
- Only add GraphORM mappings in `src/graphorm/index.ts` when you need custom mapping/transforms or diverging names — straightforward reads need no config.
- Viewer-permission field nulling belongs in `src/graphorm/index.ts` as a shared transform (e.g. `nullIfNotLoggedIn`); reuse it from manual paths rather than re-implementing in schema field resolvers.
- Subscriptions on GraphORM-backed types: publish payloads already matching the GraphQL shape; avoid fallback field resolvers that override the GraphORM path (and if unavoidable, preserve already-hydrated fields).
- For offset pagination needing only `pageInfo.hasNextPage`, overfetch one extra row and slice — no separate `COUNT(*)` unless the client needs a total.
- Errors: never throw `ApolloError` directly in resolvers — use `AuthenticationError`/`ForbiddenError`/`ValidationError` from `apollo-server-errors` or typed errors from `src/errors.ts` (`NotFoundError`, `ConflictError`).
- Feed resolvers: use `feedResolver`/`applyFeedWhere` options (`allowPrivatePosts`, `removeHiddenPosts`, `removeBannedPosts`, `removeNonPublicThresholdSquads`) for standard visibility filtering; keep builders focused on feed-specific constraints. `applyFeedWhere` does **not** handle blocked-user actor filtering — add `whereNotUserBlocked(...)` explicitly for actor-based lists. Keep query-specific defaults in the resolver wrapper, not on shared queries like `anonymousFeed`.
- **To verify a `typeDefs`/SDL change assembles into a valid schema, run a domain integration test** (e.g. `__tests__/feeds.ts`) — it builds the schema through the normal import path. Do NOT cold-`require` `build/src/graphql.js` or import `src/graphql` via ts-node: the `src/entity` barrel has circular-import ordering that throws (`Cannot read properties of undefined`) outside the app's entry sequence — it looks like a real error but is not.

## Type Safety & Validation

- **Prefer `type` over `interface`**; single-use types stay inline, export only if used in multiple places.
- **Zod 4.x** (not 3.x): top-level primitives (`z.email()`, `z.uuid()`, `z.url()` — not `z.string().email()`); `z.literal([...])` accepts arrays. Use `.nullish()` over `.nullable().optional()`. Consult [zod.dev](https://zod.dev) when unsure.
- Zod schemas live in `src/common/schema/` (one file per domain), named with a `Schema` suffix. Export only the schema; derive types with `z.infer<typeof schema>` at the point of use — never re-export inferred types or hand-write duplicates. For TS string enums in schemas, derive the tuple via the helper in `src/common/schema/utils.ts`.
- **Connect RPC handlers must return typed proto message classes** from `@dailydotdev/schema` (`new ResponseType({...})`), never plain objects — **including mock/`isMockEnabled` returns**. Never create wrapper types around schema classes (`SomeProto & { extra }`) — if the field belongs in the proto, add it to the schema package first.

## Code Style

- Keep implementations concise: early returns, combined checks, small inline helpers. Don't extract single-use logic into separate functions.
- **Never use `logger.info` for successful operations** — results are visible in the database; errors propagate with automatic retry notifications.
- No unnecessary comments — code should be self-documenting; ask before adding one.
- Const arrow functions (`const foo = () => {}`), single props-style argument (`const foo = ({ a, b }) => {}`).
- Prefer switch statements over nested ternary chains for 3+ branches.
- **Never use the non-null assertion `!`** — explicitly check and throw with a clear message.
- **Check undefined with `typeof value === 'undefined'`**, not `value === undefined`.
- **Never use `require()`** or inline type imports (`import('module').Type`) — regular `import` / `import type` at the top. Avoid barrel imports: `import { User } from './entity/user/User'`, not from `./entity`.
- Time durations: use constants from `src/common/constants.ts` (`ONE_DAY_IN_SECONDS`, etc.), never inline math like `24 * 60 * 60`.
- For service-only private routes, don't add end-user auth/role checks unless explicitly required.
- PubSub topics stay general-purpose: essential identifiers only (`{ opportunityId, userId }`); subscribers fetch their own data.
- When an external payload has explicit TS types, map fields directly (`avatar_url -> avatarUrl`); avoid dynamic key-picking helpers unless the schema is genuinely unknown.

## Recurring Bug Patterns (learned from failures)

- **Boolean `||` coercion**: never `unreadOnly || null` — it turns `false` into `null`. Use explicit conditionals for booleans (`unreadOnly ? true : null`) and `??` for optionals where `''`/`0` are valid.
- **Fastify async handlers must `return reply.send(...)`** (including when delegating to a helper that sends). Without `return`, Fastify may handle the response twice → `ERR_HTTP_HEADERS_SENT`. This was a latent bug that only surfaced when an onSend hook changed response timing.
- **JSONB key removal**: `undefined` is not sent to PostgreSQL — use `null` to remove a key. Hard-code keys for removal rather than iterating `Object.keys()`.
- **N+1 via lazy relations**: never await lazy relations inside loops/maps. Batch-fetch with `In(ids)` + a Map, or better, eager-load in one query with `leftJoinAndSelect`.
- **TypeORM quirk**: `leftJoinAndSelect` combined with an explicit `.select([...])` maps the relation to `entity.__relationName__` (double underscores), not `entity.relationName`. Access via `(entity as unknown as { __user__: User }).__user__`.
- **Code duplication**: before writing a helper, Grep for an existing implementation. When logic is needed in two places, export from the original location and import — never copy.

## Database Patterns

- **Select only needed fields** with `.select([...])` on query builders — for both the main entity and joined relations.
- **JSONB flags**: use the utilities in `src/common/utils.ts` (`updateFlagsStatement`, `updateNotificationFlags`, `updateSubscriptionFlags`, ...) — they emit an atomic `flags || '{...}'` merge, no read-then-spread. For nested JSONB values (arrays, objects), use query builder with `.setParameter('json', JSON.stringify(v))` and `column || :json` to avoid escaping bugs.
- **Transactions**: wrap 2+ sequential writes in `con.transaction(async (manager) => {...})`. Reusable write functions should accept `DataSource | EntityManager` so they can join a caller's transaction. In crons/batch jobs, keep reads outside and writes inside; for many independent scopes, prefer atomic per-scope writes over one giant transaction.
- **Read replica helper**: `queryReadReplica(con, ({ queryRunner }) => ...)` from `src/common/queryReadReplica.ts` for read-only queries in common functions and crons.
- Prefer negative state checks: `state: Not(OpportunityState.DRAFT)` over listing every non-draft state.
- Materialized/archive tables: persist the smallest schema that supports lookups/joins (no `updatedAt`/counters without a read-path need); keep a surrogate `id` but enforce the real business unique key in the DB.

## Testing Strategy

- **Prefer integration tests over unit tests** — unit tests only for complex utility logic; never both for the same behavior.
- **Avoid redundant tests**: when multiple functions share a helper, test the helper's logic once, then one simple test per caller. Don't repeat input variations across callers. One test per key scenario; each test verifies one distinct behavior.
- Prefer `toEqual`/`toMatchObject` over stacked `expect().toBe()` lines; skip assertions logically implied by others.
- **Prefer strict proto assertions**: `new SchemaClass({...})` over `expect.objectContaining` — the latter ignores extra fields and defeats schema checks.
- Typed worker tests: always pass the generic — `expectSuccessfulTypedBackground<'topic-name'>(worker, { feedback: toChangeObject(feedback) })`.
- **RPC error testing**: create a separate mock transport per error scenario (a dedicated `createMock...ErrorTransport` throwing `ConnectError`) instead of parameterizing the happy-path transport; in the test, `jest.restoreAllMocks()` then re-spy with the error transport.
- When adding/removing persisted entity fields, update affected snapshots (`toMatchSnapshot` payloads) in the same change.
- Materialized-view tests: schema comes from migrations; refresh the view before assertions, never recreate its definition in test files.
- Fixtures in `__tests__/fixture/`; DB resets via pretest hook.

## Pre-Commit Checks

`pnpm run build` and `pnpm run lint` must both pass before any commit.

## Pull Requests

Keep PR descriptions concise.

## Claude Code Hooks (`.claude/settings.json`)

- **File Protection** (PreToolUse): blocks edits to `pnpm-lock.yaml`, `src/migration/`, `.infra/Pulumi.*`, `.env`, `.git/`
- **Prevent Force Push** (PreToolUse): blocks `git push --force` / `-f`
- **Auto-Lint** (PostToolUse): `eslint --fix` on edited TypeScript files

## Node.js Version Upgrade Checklist

Update: `.nvmrc`, `package.json` (volta + `@types/node`), `Dockerfile`, `Dockerfile.dev`, `.circleci/config.yml` (executor tag + docker image), `.infra/.nvmrc`, `.infra/package.json` (volta + `@types/node`), and this file's Prerequisites. Then `pnpm install` in **both** root and `.infra/` to regenerate lock files.
