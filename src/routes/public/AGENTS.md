# Public API Development Guide

This directory contains the public REST API for daily.dev, accessible via Personal Access Tokens.

## Architecture

- **Base path:** `/public/v1`
- **Authentication:** Bearer token (Personal Access Tokens)
- **Rate limiting:** Two-layer system (IP + user-based)
- **OpenAPI:** Auto-generated at `/public/v1/docs/json` and `/public/v1/docs/yaml`
- **GraphQL Execution:** Routes use `executeGraphql()` to leverage existing resolvers directly

### AI Agent Documentation

- **`SKILL.md`** - Concise API reference for AI agents (served at `/public/v1/skill.md`)
- Update https://github.com/dailydotdev/daily/blob/master/.claude-plugin/plugins/daily.dev/skills/daily.dev/SKILL.md when changing endpoints, it is in our "daily" repository. Version using semver:
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

## Adding New Endpoints

### 1. Create Route File

Create a new file in `src/routes/public/` (e.g., `bookmarks.ts`):

```typescript
import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { executeGraphql } from './graphqlExecutor';

const BOOKMARKS_QUERY = `
  query PublicApiBookmarks($first: Int, $after: String) {
    bookmarksFeed(first: $first, after: $after) {
      edges { node { id title url } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export default async function (fastify: FastifyInstance, con: DataSource): Promise<void> {
  fastify.get(
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
      return executeGraphql(
        con,
        {
          query: BOOKMARKS_QUERY,
          variables: {
            first: request.query.limit || 20,
            after: request.query.cursor || null,
          },
        },
        (json) => ({
          data: json.bookmarksFeed.edges.map((edge) => edge.node),
          pagination: {
            hasNextPage: json.bookmarksFeed.pageInfo.hasNextPage,
            cursor: json.bookmarksFeed.pageInfo.endCursor,
          },
        }),
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

**Important:** Update https://github.com/dailydotdev/daily/blob/master/.claude-plugin/plugins/daily.dev/skills/daily.dev/SKILL.md when changing endpoints, it is in our "daily" repository

Available schemas:
- `Source`, `Author`, `AuthorWithId` - Entity types
- `FeedPost`, `PostDetail` - Post types
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
2. `executeGraphql()` creates a GraphQL context directly from the request (no HTTP round-trip)

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

## Testing

Tests are in `__tests__/routes/public/`, organized by route group:
- `helpers.ts` - Shared setup utilities
- `auth.ts`, `rateLimit.ts`, `feed.ts`, `posts.ts` - Route-specific tests

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
