# Agents.md

This file provides guidance to coding agents when working with code in this repository.

## Prerequisites

- **Node.js**: 22.22.0 (managed via Volta)
- **Package Manager**: pnpm 9.14.4

## Essential Commands

**Development:**
- `pnpm run dev` - Start API server with hot reload on port 3000
- `pnpm run dev:background` - Start background processor
- `pnpm run dev:worker-job` - Start worker-job processor (dedicated process for jobExecuteWorker)
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

**After generating a migration, use the `/format-migration` skill** to format the SQL code for readability and consistency. This skill ensures proper SQL formatting with multi-line queries, correct constraint placement, and index handling best practices.

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
- `bin/cli.ts` - CLI dispatcher supporting api, background, temporal, cron, personalized-digest, worker-job modes
- `src/background.ts` - Pub/Sub message handlers and background processing
- `src/cron.ts` - Scheduled task execution
- `src/temporal/` - Temporal workflow definitions and workers
- `src/commands/` - Standalone command implementations (e.g., personalized digest, worker-job)
- `src/commands/workerJob.ts` - Dedicated process for `jobExecuteWorker`, isolated from background for independent scaling and controlled concurrency. See `src/workers/job/AGENTS.md` for the full WorkerJob system (entity, RPCs, parent-child batches, adding new job types).

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
- We favor type safety throughout the codebase. **Prefer `type` over `interface`** for type declarations.
- **Zod schemas** are preferred for runtime validation, especially for input validation, API boundaries, and data parsing. Zod provides both type inference and runtime validation, making it ideal for verifying user input, API payloads, and external data sources.
- **This project uses Zod 4.x** (currently 4.3.5). Be aware of API differences from Zod 3.x:
  - **Primitive types are now top-level**: Use `z.email()` instead of `z.string().email()`, `z.uuid()` instead of `z.string().uuid()`, `z.url()` instead of `z.string().url()`
  - `z.literal([...])` in Zod 4.x supports arrays and validates that the value matches one of the array elements
  - For enum-like validation of string literals, both `z.literal([...])` and `z.enum([...])` work in Zod 4.x
  - Always consult the [Zod 4.x documentation](https://zod.dev) for the latest API
- When possible, prefer Zod schemas over manual validation as they provide type safety, better error messages, and can be inferred to TypeScript types.
- **Connect RPC handlers must return typed proto message classes** from `@dailydotdev/schema`, not plain objects. Use `new ResponseType({...})` instead of returning `{...}` directly.
  ```typescript
  // BAD: plain object
  return {
    jobId: job.id,
    status: job.status,
  };

  // GOOD: typed proto message
  return new GetJobStatusResponse({
    jobId: job.id,
    status: job.status,
  });
  ```

**Business Domains:**
- **Content**: Posts, comments, bookmarks, feeds, sources
- **Users**: Authentication, preferences, profiles, user experience, streaks
- **Squads**: Squad management, member roles, public requests
- **Organizations**: Organization management, campaigns
- **Notifications**: Push notifications, email digests, alerts
- **Monetization**: Paddle subscription management, premium features, cores/transactions
- **Opportunities**: Job matching, recruiter features, candidate profiles

**Roles & Permissions:**
- **System Moderator**: Users with `Roles.Moderator` in their roles array (`ctx.roles.includes(Roles.Moderator)`). System moderators have elevated privileges across the platform including:
  - Banning/unbanning posts
  - Deleting any post or comment
  - Promoting/demoting squad members in any squad (without needing to be a squad member)
- **Squad Roles** (`SourceMemberRoles`): Admin, Moderator, Member, Blocked - these are per-squad roles stored in `SourceMember.role`
- The `@auth(requires: [MODERATOR])` GraphQL directive restricts mutations to system moderators only

**Testing Strategy:**
- **Prefer integration tests over unit tests** - Integration tests provide more value by testing the full stack (GraphQL/API endpoints, validation, database interactions)
- **Unit tests should be rare** - Only create unit tests for complex utility functions with significant business logic. Simple validation or formatting functions are better tested through integration tests
- **Avoid test duplication** - Don't create both unit and integration tests for the same functionality. If integration tests cover the behavior, unit tests are redundant
- **CRITICAL: Avoid redundant unit tests that test the same logic multiple times**:
  - When multiple functions use the same underlying logic, don't test that logic separately for each function
  - Example: If `functionA()`, `functionB()`, and `functionC()` all call the same `isAllowedDomain()` helper, test the domain matching logic ONCE in the `isAllowedDomain` test, then just verify each function correctly uses it (one simple test per function)
  - **Don't test the same input variations across multiple functions** - if you've already verified that domain matching supports subdomains in one function, you don't need to test subdomain support again in other functions that use the same logic
  - Each test should verify ONE distinct behavior. If two tests exercise the exact same code path with the same logic, one is redundant
  - Testing costs money and processing time - minimize test count while maintaining confidence
- Jest with supertest for integration testing
- Database reset before each test run via pretest hook
- Fixtures in `__tests__/fixture/` for test data
- Mercurius integration testing for GraphQL endpoints
- Avoid creating multiple overlapping tests for the same scenario; a single test per key scenario is preferred
- When evaluating response objects (GraphQL, API), prefer `toEqual` and `toMatchObject` over multiple `expect().toBe()` lines
- Avoid redundant test assertions - if an assertion already verifies the value, don't add negative checks that are logically implied (e.g., if `expect(result).toBe('a')` passes, don't also check `expect(result).not.toBe('b')`)
- When adding/removing persisted entity fields, update affected Jest snapshots in worker/integration tests (for example `toMatchSnapshot` payloads) as part of the same change to avoid CI drift.
- **Typed worker tests**: Always use the generic type parameter with `expectSuccessfulTypedBackground<'topic-name'>()` for type safety. Use `toChangeObject()` to convert entities to the expected message payload format:
  ```typescript
  await expectSuccessfulTypedBackground<'api.v1.feedback-created'>(worker, {
    feedback: toChangeObject(feedback),
  });
  ```

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
- **Never use logger.info for successful operations** - successful database updates, API calls, or data processing don't need logging. Results are visible in the database and errors will propagate naturally with automatic retry notifications.
- Use early returns instead of nested conditionals
- Extract repeated patterns into small inline helpers (e.g., `const respond = (text) => ...`)
- Combine related checks (e.g., `if (!match || match.status !== X)` instead of separate blocks)
- **Prefer switch statements over nested ternary operators** for mapping multiple cases - switch statements are more readable and maintainable when handling 3+ conditional branches:
  ```typescript
  // BAD: Nested ternary chain - hard to read and extend
  const result =
    value?.case === 'optionA'
      ? { optionA: value.data }
      : value?.case === 'optionB'
        ? { optionB: value.data }
        : value?.case === 'optionC'
          ? { optionC: value.data }
          : {};

  // GOOD: Switch statement - clear and maintainable
  let result = {};
  if (value?.case) {
    switch (value.case) {
      case 'optionA':
        result = { optionA: value.data };
        break;
      case 'optionB':
        result = { optionB: value.data };
        break;
      case 'optionC':
        result = { optionC: value.data };
        break;
    }
  }
  ```

**Comments:**
- **Do not add unnecessary comments** - code should be self-documenting through clear naming
- If you feel a comment is needed, ask first before adding it
- Avoid comments that simply restate what the code does (e.g., `// Check if user exists` before `if (!user)`)

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
- **Prefer `type` over `interface`** - Use `type` for all type declarations unless you specifically need interface features (declaration merging, extends)
- Only create separate exported types if they are used in multiple places
- For single-use types, define them inline within the parent type
- Example: Instead of `export type FileData = {...}; type Flags = { file: FileData }`, use `type Flags = { file: { ... } }`

**Imports:**
- **Never use `require()`** - Always use `import` statements at the top of the file. If you believe a lazy/dynamic import or `require()` is truly necessary, explicitly ask for permission before using it.
- **Avoid barrel file imports** (index.ts re-exports). Import directly from the specific file instead.
- Example: Use `import { User } from './entity/user/User'` instead of `import { User } from './entity'`
- This improves build times, makes dependencies clearer, and avoids circular dependency issues
- **Never use inline type imports** - Always use regular `import type` statements at the top of the file instead of `import('module').Type` syntax.
  ```typescript
  // BAD: Inline type import
  type FastifyInstance = {
    con?: import('typeorm').DataSource;
  };

  // GOOD: Import type at top of file
  import type { DataSource } from 'typeorm';

  type FastifyInstance = {
    con?: DataSource;
  };
  ```

**Avoid non-null assertion operator (`!`):**
- **Never use the `!` operator** to assert that a value is not null/undefined. Instead, explicitly check and throw an error if the value is missing.
- This provides better runtime safety and clearer error messages when something goes wrong.
- **Example pattern**:
  ```typescript
  // BAD: Using non-null assertion
  const result = await executeGraphql(fastify.con!, query);

  // GOOD: Explicit check with thrown error
  if (!fastify.con) {
    throw new Error('Database connection not initialized');
  }
  const result = await executeGraphql(fastify.con, query);
  ```

**Zod patterns:**
- Use `.nullish()` instead of `.nullable().optional()` - they are equivalent but `.nullish()` is more concise
- **Place Zod schemas in `src/common/schema/`** - not inline in resolver files. Create a dedicated file per domain (e.g., `userStack.ts`, `opportunities.ts`)
- **IMPORTANT - Zod Type Inference:**
  - **ALWAYS use `z.infer<typeof schema>` to derive TypeScript types from Zod schemas** at the point of use
  - **NEVER manually define or re-export types that duplicate Zod schema structure**
  - Export only the schemas themselves, not the inferred types
  - Example:
    ```typescript
    // GOOD: Export only the schema
    export const userSchema = z.object({ name: z.string(), age: z.number() });

    // BAD: Re-exporting inferred type
    export type User = z.infer<typeof userSchema>;

    // GOOD: Use z.infer at point of use
    import type { userSchema } from './schema';
    type User = z.infer<typeof userSchema>;

    // GOOD: Inline in function parameters
    const processUser = (user: z.infer<typeof userSchema>) => { ... };
    ```
- **Schema exports must use a `Schema` suffix** (e.g., `paginationSchema`, `urlParseSchema`, `fileUploadSchema`). This makes schema variables clearly distinguishable from regular values and types.

## Best Practices & Lessons Learned

**Avoiding Code Duplication:**
- **Always check for existing implementations** before creating new helper functions. Use Grep or Glob tools to search for similar function names or logic patterns across the codebase.
- **Prefer extracting to common utilities** when logic needs to be shared. Place shared helpers in appropriate `src/common/` subdirectories (e.g., `src/common/opportunity/` for opportunity-related helpers).
- **Export and import, don't duplicate**: When you need the same logic in multiple places, export the function from its original location and import it where needed. This ensures a single source of truth and prevents maintenance issues.
- **Example lesson**: When implementing `handleOpportunityKeywordsUpdate`, the function was duplicated in both `src/common/opportunity/parse.ts` and `src/schema/opportunity.ts`. This caused lint failures and maintenance burden. The correct approach was to export it from `parse.ts` and import it in `opportunity.ts`.

**Feed resolver filtering ownership:**
- Prefer `feedResolver`/`applyFeedWhere` options (`allowPrivatePosts`, `removeHiddenPosts`, `removeBannedPosts`, `removeNonPublicThresholdSquads`) for standard feed filtering behavior.
- Keep feed builder functions focused on feed-specific constraints (for example, `sharedPostId` for reposts) instead of duplicating common visibility/privacy checks in each builder.
- `applyFeedWhere` does not handle blocked-user actor filtering; for actor-based lists (for example reposts/upvotes), explicitly add `whereNotUserBlocked(...)` with the correct column.
- For activity lists where chronological order is required (for example repost lists), force `Ranking.TIME` in the resolver wrapper.
- When introducing query-specific defaults (for example `supportedTypes` for one resolver), do not add schema-level defaults to shared feed queries like `anonymousFeed`; keep defaults scoped to the intended resolver wrapper.

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

**Using Eager Loading with TypeORM Relations:**
- **Prefer eager loading over separate queries** when you need to access entity relations. Instead of fetching an entity and then querying for related records separately, use TypeORM's query builder with `leftJoinAndSelect()` to fetch everything in a single query.
- **This is more efficient than both**: (1) awaiting lazy relations, which triggers separate queries, and (2) extracting IDs and fetching with `In()`, which requires two queries.
- **Example pattern**:
  ```typescript
  // BAD: Separate query for related entities
  const entities = await repo.find({ where: { ... } });
  const relatedIds = entities.map((e) => e.relatedId);
  const related = await relatedRepo.find({ where: { id: In(relatedIds) } });
  // Two queries total

  // BAD: Awaiting lazy relations (even worse - N queries)
  const entities = await repo.find({ where: { ... } });
  const related = await Promise.all(entities.map((e) => e.lazyRelation));
  // N+1 queries total

  // GOOD: Eager load with query builder - single query with JOIN
  const entities = await repo
    .createQueryBuilder('entity')
    .leftJoinAndSelect('entity.relation', 'relation')
    .where('entity.someField = :value', { value })
    .getMany();
  // Now entities[0].relation is already loaded, no await needed
  // Single query with JOIN
  ```

**Selecting Only Necessary Fields:**
- **Always use `.select()` to fetch only the fields you need** when using query builder. This reduces data transfer, improves query performance, and makes the code more maintainable by explicitly documenting which fields are used.
- **Specify fields for both the main entity and joined relations** - don't let TypeORM fetch all columns by default.
- **Example pattern**:
  ```typescript
  // BAD: Fetches ALL columns from both tables
  const entities = await repo
    .createQueryBuilder('entity')
    .leftJoinAndSelect('entity.user', 'user')
    .where('entity.id = :id', { id })
    .getMany();
  // User entity has 20+ columns but we only need 3

  // GOOD: Select only the fields you actually use
  const entities = await repo
    .createQueryBuilder('entity')
    .leftJoinAndSelect('entity.user', 'user')
    .select([
      'entity.id',
      'entity.someField',
      'user.id',
      'user.name',
      'user.email',
    ])
    .where('entity.id = :id', { id })
    .getMany();
  // Now only fetches the 5 columns we actually need
  ```
- **Important TypeORM quirk**: When using `leftJoinAndSelect` with explicit `.select()`, TypeORM maps joined relations to `__relationName__` (double underscore prefix) instead of the normal property name. Access via type assertion:
  ```typescript
  // With explicit .select(), relation is NOT on entity.user
  // It's mapped to entity.__user__ instead
  const user = (entity as unknown as { __user__: User }).__user__;
  const name = user?.name || 'Unknown';
  ```

**Updating JSONB Flag Fields:**
- **Use flag update utilities** instead of manually spreading existing flags. Utilities in `src/common/utils.ts` leverage PostgreSQL's JSONB `||` operator for atomic, efficient updates.
- Available utilities: `updateFlagsStatement`, `updateNotificationFlags`, `updateSubscriptionFlags`, `updateRecruiterSubscriptionFlags`
- **Example pattern**:
  ```typescript
  // BAD: Manual spread - requires reading entity first, non-atomic
  const entity = await repo.findOneBy({ id });
  const existingFlags = entity.flags || {};
  await repo.update(id, {
    flags: { ...existingFlags, newField: value },
  });

  // GOOD: Use utility - atomic PostgreSQL JSONB merge
  await repo.update(id, {
    flags: updateFlagsStatement<Entity>({ newField: value }),
  });
  ```
- The utilities generate SQL like `flags || '{"newField": "value"}'` which atomically merges without needing to read first (unless you need to reference existing values).
- **For nested JSONB values** (arrays, objects with special characters), use query builder with `setParameter` to properly escape:
  ```typescript
  // BAD: Inline JSON string - can have escape issues with nested data
  await repo.update(id, {
    history: () => `history || '${JSON.stringify(entry)}'`,
  });

  // GOOD: Use query builder with setParameter
  await repo
    .createQueryBuilder()
    .update()
    .set({ history: () => `history || :historyJson` })
    .where({ id })
    .setParameter('historyJson', JSON.stringify(entry))
    .execute();
  ```

**Using Transactions for Multiple Sequential Updates:**
- **Wrap multiple sequential database updates in a transaction** to ensure atomicity - if any operation fails, all changes are rolled back.
- Use `con.transaction(async (manager) => { ... })` pattern where `manager` is an `EntityManager` for all operations within the transaction.
- **When to use transactions**: Any time you have 2+ sequential write operations that should succeed or fail together.
- **For reusable functions**: Accept `DataSource | EntityManager` as the connection parameter so the function can participate in a caller's transaction.
- **Example pattern**:
  ```typescript
  // BAD: Multiple sequential updates without transaction
  await orgRepo.update(orgId, { status: 'active' });
  await alertsRepo.upsert({ userId, showAlert: true }, { conflictPaths: ['userId'] });
  await opportunityRepo.update(oppId, { state: 'IN_REVIEW' });
  // If the third update fails, the first two are already committed!

  // GOOD: Wrap in transaction for atomicity
  await con.transaction(async (manager) => {
    await manager.getRepository(Organization).update(orgId, { status: 'active' });
    await manager.getRepository(Alerts).upsert({ userId, showAlert: true }, { conflictPaths: ['userId'] });
    await manager.getRepository(OpportunityJob).update(oppId, { state: 'IN_REVIEW' });
  });
  // All updates succeed together or none are committed

  // GOOD: Reusable function that accepts either DataSource or EntityManager
  type DataSourceOrManager = DataSource | EntityManager;

  const updateEntity = async ({ con }: { con: DataSourceOrManager }) => {
    await con.getRepository(Entity).update(...);
  };

  // Can be called standalone
  await updateEntity({ con: dataSource });

  // Or within a transaction
  await dataSource.transaction(async (manager) => {
    await updateEntity({ con: manager });
    await anotherUpdate({ con: manager });
  });
  ```
- **For cron jobs and batch operations**: Keep read-only queries outside the transaction, then wrap all writes in a single transaction.

**Using queryReadReplica Helper:**
- Use `queryReadReplica` helper from `src/common/queryReadReplica.ts` for read-only queries in common functions and cron jobs.
- **Example pattern**:
  ```typescript
  import { queryReadReplica } from '../common/queryReadReplica';

  const result = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(Entity).find({ where: {...} })
  );
  ```
- **Exception**: Queries during write operations that need immediate consistency should use primary.

**Materialized View Tests:**
- For integration tests that depend on materialized views, assume schema setup is handled by migrations (`db:migrate:latest` / test reset flow).
- In tests, refresh the materialized view before assertions; do not recreate the materialized view definition inside test files.

**State Checking Patterns:**
- **Prefer negative checks over listing states** when checking for "non-draft" or similar conditions.
- Use `state: Not(OpportunityState.DRAFT)` instead of `state: In([IN_REVIEW, LIVE, CLOSED])`.
- This is more maintainable as new states are added.

**JSONB Key Removal with null vs undefined:**
- **Use `null` to remove JSONB keys** - `undefined` will not be sent to PostgreSQL.
- **Example pattern**:
  ```typescript
  // BAD: undefined won't remove the key
  const flags = { ...existingFlags, keyToRemove: undefined };

  // GOOD: null removes the key from JSONB
  const flags = { ...existingFlags, keyToRemove: null };
  ```
- **Hard-code keys for removal** instead of using `Object.keys()` dynamically - it's clearer and safer.

**Boolean Coercion Bug with `||` Operator:**
- **Never use `||` to provide default values for boolean parameters** - it incorrectly converts `false` to the default value.
- Use nullish coalescing (`??`) or explicit conditionals instead.
- **Example pattern**:
  ```typescript
  // BAD: false || null = null (loses the false value!)
  const variables = {
    unreadOnly: unreadOnly || null,  // When unreadOnly is false, this becomes null
  };

  // GOOD: Explicit conditional preserves boolean semantics
  const variables = {
    unreadOnly: unreadOnly ? true : null,  // Only send true when explicitly true
  };

  // GOOD: Use ?? for optional string/number parameters
  const variables = {
    cursor: cursor ?? null,  // Empty string is preserved, only undefined/null becomes null
    listId: listId ?? null,
  };
  ```
- **Rule of thumb**: Use `??` for optional parameters where empty string or `0` are valid values. Use explicit conditionals for boolean flags where you only want to send `true`.

**Public API Development:**
- The public REST API (`src/routes/public/`) has its own development patterns documented in `src/routes/public/AGENTS.md`.
- Key patterns include:
  - Use `executeGraphql()` from `./graphqlExecutor` for direct GraphQL execution
  - Import shared constants and utilities from `./common.ts` (`parseLimit`, `ensureDbConnection`, `MAX_LIMIT`, `DEFAULT_LIMIT`)
  - Update `skill.md` when adding/changing endpoints (versioned with semver)
  - Fastify route type parameters should be defined inline for single-use types

## Pre-Commit Checks

Before creating any commit, ensure the following pass:
- `pnpm run build` - TypeScript compilation must succeed with no errors
- `pnpm run lint` - ESLint must pass with 0 warnings

Do not commit code that fails either check.

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
