# GraphORM

GraphORM turns a GraphQL query into a single PostgreSQL query (JSON aggregation via `jsonb_agg()`/`to_jsonb()`), eliminating N+1s. It parses `resolveInfo`, reads TypeORM entity metadata, applies the config in `src/graphorm/index.ts`, and runs JavaScript `transform` functions on the fetched rows.

**It is the default for all GraphQL query resolvers.** Use TypeORM repositories only for mutations/writes, non-GraphQL endpoints, external data, or access patterns GraphORM genuinely can't express.

## Methods

| Method | Returns |
|--------|---------|
| `query<T>()` | `Promise<T[]>` |
| `queryOne<T>()` | `Promise<T \| null>` |
| `queryOneOrFail<T>()` | `Promise<T>` (throws NotFound) |
| `queryPaginated<T>()` | Relay `Connection<T>` (takes hasPrevious/hasNext/nodeToCursor callbacks + builder) |
| `queryByHierarchy<T>()` | Query a nested field of the resolve tree (pass the path, e.g. `['posts', 'edges', 'node']`) |
| `queryPaginatedIntegration<T>()` | Relay pagination over non-DB data (external APIs) |

- The builder callback receives `{ queryBuilder, alias }` and **must return the builder**. Filter/sort/limit there — at the database level, never in JS after fetching.
- The optional last boolean argument routes the query to the **read replica** — use it for pure reads; skip it when read-after-write consistency matters.

## Configuration (`src/graphorm/index.ts`)

Per GraphQL type:

- `requiredColumns` — columns always selected even if not requested. Entries can be strings or `{ column, columnAs, isJson }` for JSONB paths. **Keep minimal**: only columns needed by transforms, custom relations, or permission logic. Mirroring commonly requested fields here hides real dependencies and widens every query.
- `anonymousRestrictedColumns` — fields hidden from unauthenticated users.
- Per-field options: `select` (custom SQL selection), `alias` (map to another column, supports `{ field, type: 'jsonb' }`), `jsonType: true` (JSONB column), `transform(value, ctx, parent)` (post-fetch: permissions, formatting, computed values — keep lightweight, never call the DB inside), `relation.customRelation(ctx, parentAlias, childAlias, qb)` (custom join, with `isMany`), `pagination` (Relay config).
- Reuse shared permission transforms (e.g. `nullIfNotSameUser`, `nullIfNotLoggedIn`) instead of re-implementing visibility rules per resolver.

## Example

```typescript
return graphorm.queryOne<GQLPost>(ctx, info, (builder) => {
  builder.queryBuilder.where(`${builder.alias}.id = :id`, { id });
  return builder;
}, true); // read replica
```

More usage: `src/schema/posts.ts`, `src/schema/users.ts`, `src/common/feedGenerator.ts`. Core implementation: `src/graphorm/graphorm.ts`.
