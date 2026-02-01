# Public API Development Guide

This directory contains the public REST API for daily.dev, accessible via Personal Access Tokens.

## Architecture

- **Base path:** `/public/v1`
- **Authentication:** Bearer token (Personal Access Tokens)
- **Rate limiting:** Uses `@fastify/rate-limit` with Redis store

## Adding New Endpoints

### 1. Create Route File

Create a new file in `src/routes/public/` (e.g., `bookmarks.ts`):

```typescript
import { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';

export default async function (
  fastify: FastifyInstance,
  con: DataSource,
): Promise<void> {
  fastify.get('/bookmarks', async (request, reply) => {
    const userId = request.apiUserId;
    // Implementation
    return reply.send({ data: [] });
  });
}
```

### 2. Register Route

In `src/routes/public/index.ts`, register your route module.

### 3. Response Format

All endpoints must return:

```typescript
// Success (list)
{ data: [...], pagination: { hasNextPage, cursor } }

// Success (single item)
{ data: { ... } }

// Error
{ error: 'error_code', message: 'Human readable' }
```

## Rate Limiting

Rate limits are configured in `src/routes/public/index.ts`.
Current limits: 60/min, 1000/day per user.

## Authentication

All routes require a valid Personal Access Token in the Authorization header:
```
Authorization: Bearer dda_xxx...
```

The middleware validates the token and attaches:
- `request.apiUserId` - The user ID associated with the token
- `request.apiTokenId` - The token ID for tracking

Plus subscription is verified on every request.

## Testing

Add tests in `__tests__/routes/public/`.
