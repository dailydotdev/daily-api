# Public API Development Guide

This directory contains the public REST API for daily.dev, accessible via Personal Access Tokens.

## AI Agent Documentation

The API includes agent-friendly documentation:

- **`skill.md`** - Concise API reference designed for AI agents (served at `/public/v1/skill.md`)
- **OpenAPI spec** - Machine-readable API definition at `/public/v1/docs/json` and `/public/v1/docs/yaml`

When updating endpoints, keep `skill.md` in sync. It should remain concise and focused on what agents need to know.

### Versioning

The `skill.md` file includes a version number at the top. Update it when making changes:

- **Major** (1.x.x → 2.0.0): Breaking changes (removed endpoints, changed response structure)
- **Minor** (1.0.x → 1.1.0): New endpoints or fields (backward compatible)
- **Patch** (1.0.0 → 1.0.1): Documentation fixes, clarifications

## Architecture

- **Base path:** `/public/v1`
- **Authentication:** Bearer token (Personal Access Tokens)
- **Rate limiting:** Two-layer system (see below)
- **OpenAPI:** Auto-generated via `@fastify/swagger`
- **GraphQL Injection:** Routes use `injectGraphql()` to leverage existing GraphQL resolvers

## Key Principles

### 1. Rate Limiting is Already Configured
**Do NOT implement custom rate limiting.** The two-layer rate limiting system in `index.ts` handles:
- IP-based DoS protection (300/min) via `@fastify/rate-limit`
- Per-user API quota (60/min) via Redis

The order is critical: IP rate limiting → Auth → User rate limiting. This prevents DoS via token validation flooding while still enforcing per-user quotas.

### 2. Trust the Auth Middleware
**Do NOT add redundant authentication checks in route handlers.** The auth middleware in `index.ts` already:
- Validates the Personal Access Token
- Sets `request.apiUserId`, `request.userId`, and `request.isPlus`
- Returns 401 for invalid/expired/revoked tokens

Route handlers can assume the user is authenticated. Do not add redundant checks like:
```typescript
// BAD - redundant check
if (!userId) {
  return reply.status(401).send({ ... });
}
```

### 3. Plus Subscription Validation
**Do NOT check Plus subscription status in the auth hook.** Tokens are:
- Only created for Plus users (enforced in `createPersonalAccessToken` mutation)
- Automatically revoked when Plus is cancelled

The token being valid is sufficient proof of Plus access.

### 4. Use Personalized Feeds
For authenticated users, use the personalized `feed` query (For You feed), not `anonymousFeed`:
```graphql
# GOOD - personalized feed for authenticated users
feed(first: $first, after: $after, ranking: TIME, version: 1) { ... }

# BAD - anonymous feed doesn't respect user preferences
anonymousFeed(first: $first, after: $after, ...) { ... }
```

### 5. Simplify Response Transformations
When the GraphQL response structure matches the REST API response, just return the node directly:
```typescript
// GOOD - simple passthrough
(json) => ({
  data: feed.edges.map(({ node }) => node),
  pagination: { ... },
})

// BAD - unnecessary mapping when fields match
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
import { injectGraphql } from '../../compatibility/utils';

const BOOKMARKS_QUERY = `
  query PublicApiBookmarks($first: Int, $after: String) {
    bookmarksFeed(first: $first, after: $after) {
      edges { node { id title url } }
      pageInfo { hasNextPage endCursor }
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
      // Auth middleware guarantees apiUserId is set - no need to check
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
          data: json.data.bookmarksFeed.edges.map((edge) => edge.node),
          pagination: {
            hasNextPage: json.data.bookmarksFeed.pageInfo.hasNextPage,
            cursor: json.data.bookmarksFeed.pageInfo.endCursor,
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
await fastify.register(bookmarksRoutes, { prefix: '/bookmarks' });
```

### 3. Add Schemas (Optional)

If your endpoint uses new data types, add them to `schemas.ts`.

**Important:** When updating schemas, also update `skill.md` to keep the example responses in sync. Bump the version number following semver (see Versioning section above).

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
- `Source` - Source info (id, name, handle, image)
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

### How Authentication Works

The public API auth hook validates the PAT and sets `request.userId` and `request.isPlus`.

The `injectGraphql()` utility then uses the service-to-service authentication pattern to pass the authenticated user to the GraphQL endpoint. It sets:
- `Authorization: Service ${ACCESS_SECRET}` - Service auth header
- `user-id` header - The authenticated user's ID
- `logged-in: true` header - Indicates a logged-in user
- `is-plus` header - Whether the user has Plus

This allows the GraphQL resolver to have full user context without needing to understand PATs.

## Rate Limiting

Rate limiting uses a two-layer approach for security:

### Layer 1: IP-based (DoS Protection)
- **Limit:** 300 requests/min per IP
- **Runs:** BEFORE authentication
- **Purpose:** Prevents DoS attacks via token validation flooding

### Layer 2: User-based (API Quota)
- **Limit:** 60 requests/min per user
- **Runs:** AFTER authentication
- **Purpose:** Enforces actual API usage quota per authenticated user

### Why Two Layers?

Rate limiting MUST run before auth to prevent attackers from flooding the database with invalid token validation requests. However, IP-based limits alone aren't sufficient because:
- Multiple users may share an IP (offices, VPNs)
- A single user could abuse the API from multiple IPs

The IP limit is generous (300/min) to avoid blocking legitimate shared IPs, while the per-user limit (60/min) enforces the actual quota.

### Headers Returned

**IP-based limits:**
- `X-RateLimit-Limit` - Maximum requests per minute (IP)
- `X-RateLimit-Remaining` - Remaining requests this minute (IP)
- `X-RateLimit-Reset` - Unix timestamp when the limit resets

**User-based limits:**
- `X-RateLimit-Limit-User` - Maximum requests per minute (user)
- `X-RateLimit-Remaining-User` - Remaining requests this minute (user)

**On 429 response:**
- `Retry-After` - Seconds until rate limit resets

## Authentication

All routes (except `/docs/*`) require a valid Personal Access Token:

```
Authorization: Bearer dda_xxx...
```

The middleware validates the token and sets:
- `request.apiUserId` - The user ID associated with the token
- `request.apiTokenId` - The token ID for tracking
- `request.userId` - Same as apiUserId (for GraphQL compatibility)
- `request.isPlus` - Always true (Plus verified when token is created)

## Testing

Tests are in `__tests__/routes/public/`, organized by route group in separate files:

- `helpers.ts` - Shared test setup and utilities
- `auth.ts` - Authentication tests (Authorization header validation, Plus subscription access)
- `rateLimit.ts` - Rate limiting tests
- `feed.ts` - Feed endpoint tests (`GET /public/v1/feed`)
- `posts.ts` - Posts endpoint tests (`GET /public/v1/posts/:id`)

### Test Setup

All test files use the shared `setupPublicApiTests()` helper from `helpers.ts` which handles app initialization, database connection, and fixture loading.

Example test structure:

```typescript
import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('GET /public/v1/your-endpoint', () => {
  it('should return data for authenticated user', async () => {
    const token = await createTokenForUser(state.con, '5'); // Plus user

    const { body } = await request(state.app.server)
      .get('/public/v1/your-endpoint')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toBeDefined();
  });
});
```

### Adding Tests for New Endpoints

When adding a new endpoint, create a new test file (e.g., `bookmarks.ts`) and use the shared helpers:

```typescript
import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('GET /public/v1/bookmarks', () => {
  // ... your tests
});
```
