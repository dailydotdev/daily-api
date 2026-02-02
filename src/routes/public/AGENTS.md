# Public API Development Guide

This directory contains the public REST API for daily.dev, accessible via Personal Access Tokens.

## Architecture

- **Base path:** `/public/v1`
- **Authentication:** Bearer token (Personal Access Tokens)
- **Rate limiting:** Custom Redis-based rate limiting (60/min, 1000/day)
- **OpenAPI:** Auto-generated via `@fastify/swagger`
- **GraphQL Injection:** Routes use `injectGraphql()` to leverage existing GraphQL resolvers

## Adding New Endpoints

### 1. Create Route File

Create a new file in `src/routes/public/` (e.g., `bookmarks.ts`):

```typescript
import type { FastifyInstance } from 'fastify';
import { injectGraphql } from '../../compatibility/utils';

const BOOKMARKS_QUERY = `
  query PublicApiBookmarks($first: Int, $after: String) {
    bookmarks(first: $first, after: $after) {
      edges {
        node {
          id
          title
          url
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export default async function (fastify: FastifyInstance): Promise<void> {
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
      const userId = request.apiUserId;
      if (!userId) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'User not authenticated',
        });
      }

      return injectGraphql(
        fastify,
        {
          query: BOOKMARKS_QUERY,
          variables: {
            first: request.query.limit || 20,
            after: request.query.cursor || null,
          },
        },
        (json) => ({
          data: json.data.bookmarks.edges.map((edge) => edge.node),
          pagination: {
            hasNextPage: json.data.bookmarks.pageInfo.hasNextPage,
            cursor: json.data.bookmarks.pageInfo.endCursor,
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

In `src/routes/public/index.ts`, register your route module:

```typescript
import bookmarksRoutes from './bookmarks';

// Inside the default export function:
await fastify.register(
  async (instance) => {
    await bookmarksRoutes(instance);
  },
  { prefix: '/bookmarks' },
);
```

### 3. Add Schemas (Optional)

If your endpoint uses new data types, add them to `schemas.ts`:

```typescript
export const commonSchemas = {
  // ... existing schemas
  YourNewSchema: {
    $id: 'YourNewSchema',
    type: 'object',
    properties: {
      id: { type: 'string' },
      // ... other properties
    },
  },
};
```

Reference schemas in route definitions using `{ $ref: 'YourNewSchema#' }`.

## Response Format

All endpoints must return consistent formats:

```typescript
// Success (list)
{ data: [...], pagination: { hasNextPage, cursor } }

// Success (single item)
{ data: { ... } }

// Error
{ error: 'error_code', message: 'Human readable' }
```

## OpenAPI Documentation

OpenAPI spec is auto-generated from route schemas:

- **JSON:** `GET /public/v1/docs/json`
- **YAML:** `GET /public/v1/docs/yaml`

These endpoints are publicly accessible (no auth required).

### Schema References

Use `$ref` syntax to reference shared schemas:

```typescript
response: {
  200: {
    type: 'object',
    properties: {
      data: { $ref: 'PostDetail#' },  // References PostDetail schema
    },
  },
  401: { $ref: 'Error#' },  // References Error schema
}
```

Available schemas defined in `schemas.ts`:
- `Source` - Basic source info (id, name, image)
- `SourceWithUrl` - Source with URL
- `Author` - Basic author info (name, image)
- `AuthorWithId` - Author with id and username
- `FeedPost` - Post in feed list
- `PostDetail` - Full post details with user state
- `Pagination` - Pagination info (hasNextPage, cursor)
- `Error` - Error response (error, message)
- `RateLimitError` - Rate limit error with retryAfter

## GraphQL Injection

Routes use `injectGraphql()` from `src/compatibility/utils.ts` to:
- Reuse existing GraphQL resolver logic
- Benefit from GraphQL caching (mercurius-cache)
- Ensure consistent authorization checks
- Avoid duplicating business logic

The auth hook sets `request.userId` and `request.isPlus` for GraphQL compatibility.

## Rate Limiting

Rate limits are configured in `src/routes/public/index.ts`:
- **Per-minute:** 60 requests
- **Per-day:** 1000 requests

Headers returned:
- `X-RateLimit-Limit` - Maximum requests per minute
- `X-RateLimit-Remaining` - Remaining requests this minute
- `Retry-After` - Seconds until rate limit resets (only on 429)

## Authentication

All routes (except `/docs/*`) require a valid Personal Access Token:

```
Authorization: Bearer dda_xxx...
```

The middleware validates the token and sets:
- `request.apiUserId` - The user ID associated with the token
- `request.apiTokenId` - The token ID for tracking
- `request.userId` - Same as apiUserId (for GraphQL compatibility)
- `request.isPlus` - Always true (Plus verified on auth)

Plus subscription is verified on every request.

## Testing

Add tests in `__tests__/routes/public/`:

```typescript
describe('GET /public/v1/your-endpoint', () => {
  it('should return data for authenticated user', async () => {
    const token = await createTokenForUser('5'); // Plus user

    const { body } = await request(app.server)
      .get('/public/v1/your-endpoint')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toBeDefined();
  });
});
```

## AI Agent Documentation

The `skill.md` file contains documentation for AI agents to connect to the API.
This should be deployed to `https://daily.dev/skill.md` for agent discovery.
