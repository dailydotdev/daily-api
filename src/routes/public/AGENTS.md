# Public API Development Guide

This directory contains the public REST API for daily.dev, accessible via Personal Access Tokens.

## Architecture

- **Base path:** `/public/v1`
- **Authentication:** Bearer token (Personal Access Tokens)
- **Rate limiting:** Two-layer system (IP + user-based)
- **OpenAPI:** Auto-generated at `/public/v1/docs/json` and `/public/v1/docs/yaml`
- **GraphQL Execution:** Routes use `executeGraphql()` to directly execute GraphQL queries

### AI Agent Documentation

- **`skill.md`** - Concise API reference for AI agents (served at `/public/v1/skill.md`)
- Update `skill.md` when changing endpoints. Version using semver:
  - **Major**: Breaking changes
  - **Minor**: New endpoints/fields (backward compatible)
  - **Patch**: Documentation fixes

## Key Principles

### 1. Don't Reimplement What's Already Done

**Rate limiting and auth are handled in `index.ts`.** Don't add:
- Custom rate limiting (two-layer system already configured)
- Redundant auth checks (middleware sets `request.apiUserId`, `request.userId`, `request.isPlus`)
- Plus subscription validation (tokens only exist for Plus users, auto-revoked on cancellation)

```typescript
// BAD - redundant check
if (!userId) {
  return reply.status(401).send({ ... });
}
```

### 2. Simplify Response Transformations

When GraphQL response matches REST response, return the node directly:
```typescript
// GOOD - simple passthrough
(json) => ({
  data: feed.edges.map(({ node }) => node),
  pagination: { ... },
})

// BAD - unnecessary field-by-field mapping
(json) => ({
  data: feed.edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    // ... all the same fields
  })),
})
```

### 3. Use Shared Utilities and Types

Import shared constants, utilities, and types from `./common.ts`:
```typescript
import type { FeedConnection, PostNode, BookmarkedPostNode } from './common';
import {
  parseLimit,
  ensureDbConnection,
  POST_NODE_FIELDS,
  BOOKMARKED_POST_EXTRA_FIELDS,
  PAGE_INFO_FIELDS,
} from './common';

// Use parseLimit for query parameter parsing
const limit = parseLimit(request.query.limit);

// Use ensureDbConnection to validate connection
const con = ensureDbConnection(fastify.con);
```

### 4. Reuse GraphQL Field Strings

**CRITICAL: Never duplicate GraphQL fields.** Use the shared field strings from `common.ts`:

```typescript
// GOOD: Use shared field strings
const MY_FEED_QUERY = `
  query MyFeed($first: Int) {
    myFeed(first: $first) {
      edges {
        node {
          ${POST_NODE_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

// For bookmark feeds, add the extra bookmark fields:
const BOOKMARKS_QUERY = `
  query Bookmarks($first: Int) {
    bookmarksFeed(first: $first) {
      edges {
        node {
          ${POST_NODE_FIELDS}
          ${BOOKMARKED_POST_EXTRA_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

// BAD: Duplicating fields inline (DO NOT DO THIS)
const MY_FEED_QUERY = `
  query MyFeed($first: Int) {
    myFeed(first: $first) {
      edges {
        node {
          id
          title
          url
          image
          summary
          ...  // Don't duplicate - use POST_NODE_FIELDS
        }
      }
    }
  }
`;
```

### 5. Reuse TypeScript Types

**CRITICAL: Never define duplicate interfaces.** Use the shared types from `common.ts`:

```typescript
// GOOD: Use shared types
import type { FeedConnection, PostNode, BookmarkedPostNode, PageInfo } from './common';

interface MyFeedResponse {
  myFeed: FeedConnection<PostNode>;
}

interface BookmarksFeedResponse {
  bookmarksFeed: FeedConnection<BookmarkedPostNode>;
}

// BAD: Defining duplicate interfaces (DO NOT DO THIS)
interface MyPostNode {
  id: string;
  title: string;
  // ... same fields as PostNode - DON'T DUPLICATE!
}
```

**Available shared types:**

| Type | Description |
|------|-------------|
| `PostNode` | Standard post fields (id, title, url, source, author, etc.) |
| `BookmarkedPostNode` | PostNode + bookmarkedAt timestamp |
| `SourceInfo` | Source/publisher info (id, name, handle, image) |
| `AuthorInfo` | Author info (name, image) |
| `PageInfo` | Pagination info (hasNextPage, endCursor) |
| `FeedConnection<T>` | Generic connection wrapper (edges, pageInfo) |

**Available GraphQL field strings:**

| Constant | Description |
|----------|-------------|
| `POST_NODE_FIELDS` | All standard post fields |
| `BOOKMARKED_POST_EXTRA_FIELDS` | Extra fields for bookmarked posts (bookmarkedAt) |
| `PAGE_INFO_FIELDS` | Pagination fields (pageInfo { hasNextPage, endCursor }) |

## Adding New Endpoints

### 1. Create Route File

Create a new file in `src/routes/public/` (e.g., `bookmarks.ts`):

```typescript
import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import { parseLimit, ensureDbConnection } from './common';

const BOOKMARKS_QUERY = `
  query PublicApiBookmarks($first: Int, $after: String) {
    bookmarksFeed(first: $first, after: $after) {
      edges { node { id title url } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { limit?: string; cursor?: string } }>(
    '/',
    {
      schema: {
        description: 'Get user bookmarks',
        tags: ['bookmarks'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 20, maximum: 50, minimum: 1 },
            cursor: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'FeedPost#' } },
              pagination: { $ref: 'Pagination#' },
            },
          },
          401: { $ref: 'Error#' },
          403: { $ref: 'Error#' },
        },
      },
    },
    async (request, reply) => {
      const limit = parseLimit(request.query.limit);
      const { cursor } = request.query;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: BOOKMARKS_QUERY,
          variables: {
            first: limit,
            after: cursor ?? null,
          },
        },
        (json) => {
          const result = json as { bookmarksFeed: { edges: { node: unknown }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } };
          return {
            data: result.bookmarksFeed.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.bookmarksFeed.pageInfo.hasNextPage,
              cursor: result.bookmarksFeed.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );
}
```

### 2. Register Route

In `src/routes/public/index.ts`:

```typescript
import bookmarksRoutes from './bookmarks';

// Inside the default export function:
await fastify.register(bookmarksRoutes, { prefix: '/bookmarks' });
```

### 3. Add Schemas (Optional)

Add new data types to `schemas.ts` and reference with `{ $ref: 'SchemaName#' }`.

**IMPORTANT:** Before creating new schemas, check `schemas.ts` for existing ones that might fit your needs.

**Important:** Update `skill.md` when changing schemas.

Available schemas:
- `Source`, `Author`, `AuthorWithId`, `CommentAuthor` - Entity types
- `FeedPost`, `PostDetail`, `BookmarkedPost` - Post types
- `BookmarkList` - Bookmark list type
- `Comment` - Comment type with nested children
- `Tag`, `SourceSummary` - Search result types
- `Pagination`, `Error`, `RateLimitError` - Common types

## Response Format

```typescript
// Success (list)
{ data: [...], pagination: { hasNextPage, cursor } }

// Success (single item)
{ data: { ... } }

// Error
{ error: 'error_code', message: 'Human readable' }
```

## How It Works

### Authentication Flow

1. Auth middleware validates PAT and sets `request.userId`, `request.isPlus`
2. `executeGraphql()` creates a GraphQL Context from the authenticated request
3. GraphQL resolvers receive the user context and execute queries/mutations

### Direct GraphQL Execution

The `executeGraphql()` function in `graphqlExecutor.ts`:
- Creates a GraphQL Context directly from the authenticated Fastify request
- Executes GraphQL queries using the schema's `execute()` function
- Maps GraphQL errors to appropriate HTTP status codes (401, 403, 404, etc.)
- Caches parsed queries for performance

```typescript
// executeGraphql handles all the complexity:
// - Context creation from authenticated request
// - Query execution
// - Error mapping to HTTP status codes
// - Response transformation
return executeGraphql(con, { query, variables }, transformFn, request, reply);
```

### Rate Limiting

Two layers protect the API:

| Layer | Limit | Runs | Purpose |
|-------|-------|------|---------|
| IP-based | 300/min | Before auth | DoS protection |
| User-based | 60/min | After auth | API quota |

IP limiting runs first to prevent token validation flooding. The generous IP limit (300/min) avoids blocking shared IPs (offices, VPNs).

**Response headers:**
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (IP)
- `X-RateLimit-Limit-User`, `X-RateLimit-Remaining-User` (user)
- `Retry-After` (on 429)

## Common Pitfalls

### Boolean Parameter Handling

**Never use `||` to provide null defaults for boolean parameters** - it incorrectly converts `false` to `null`:

```typescript
// BAD: false || null = null (loses the boolean value!)
const variables = {
  unreadOnly: unreadOnly || null,
};

// GOOD: Only send true when explicitly true, otherwise null
const variables = {
  unreadOnly: unreadOnly ? true : null,
};
```

### Nullish Coalescing for Optional Parameters

Use `??` instead of `||` for optional string parameters where empty string is a valid (but unlikely) value:

```typescript
// GOOD: Use ?? for optional parameters
const variables = {
  cursor: cursor ?? null,
  listId: listId ?? null,
};
```

### Inline Type Parameters

Define route type parameters inline instead of creating separate interfaces for single-use types:

```typescript
// GOOD: Inline type parameters
fastify.get<{ Querystring: { limit?: string; cursor?: string } }>(
  '/',
  { schema: { ... } },
  async (request, reply) => { ... }
);

// AVOID: Separate interface for single-use type
interface BookmarksQuery {
  limit?: string;
  cursor?: string;
}
fastify.get<{ Querystring: BookmarksQuery }>(...)
```

### Shared Utilities in `common.ts`

Always use the shared utilities, types, and GraphQL field strings instead of duplicating code:

**Utilities:**

| Utility | Purpose |
|---------|---------|
| `parseLimit(limit?)` | Parse and validate limit parameter (1-50, default 20) |
| `ensureDbConnection(con)` | Validate database connection, throw if undefined |
| `MAX_LIMIT` | Maximum allowed limit (50) |
| `DEFAULT_LIMIT` | Default limit value (20) |

**GraphQL Field Strings:**

| Constant | Purpose |
|----------|---------|
| `POST_NODE_FIELDS` | All standard post fields for feed queries |
| `BOOKMARKED_POST_EXTRA_FIELDS` | Extra fields for bookmarked posts (bookmarkedAt) |
| `PAGE_INFO_FIELDS` | Pagination fields (pageInfo { hasNextPage, endCursor }) |

**TypeScript Types:**

| Type | Purpose |
|------|---------|
| `PostNode` | Standard post interface (use instead of defining local post types) |
| `BookmarkedPostNode` | PostNode extended with bookmarkedAt |
| `SourceInfo` | Source/publisher info interface |
| `AuthorInfo` | Author info interface |
| `PageInfo` | Pagination info interface |
| `FeedConnection<T>` | Generic feed connection (edges + pageInfo) |

## Testing

Tests are in `__tests__/routes/public/`, organized by route group:
- `helpers.ts` - Shared setup utilities
- `auth.ts`, `rateLimit.ts`, `feeds.ts`, `posts.ts` - Route-specific tests

```typescript
import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('GET /public/v1/your-endpoint', () => {
  it('should return data for authenticated user', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/your-endpoint')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toBeDefined();
  });
});
```
