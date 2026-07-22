# Public API (`/public/v1`)

Public REST API authenticated via Personal Access Tokens (Plus users only). Routes execute GraphQL directly through `executeGraphql()` (`./graphqlExecutor`), which builds a GraphQL Context from the authenticated request, runs the query in-process, maps GraphQL errors to HTTP status codes, and applies a response transform. OpenAPI docs auto-generate at `/public/v1/docs/json|yaml`.

## Cross-Repo Requirement

When adding or changing endpoints, update the AI-agent skill doc served at `/public/v1/skill.md`, which lives in the **"daily" repository**: `https://github.com/dailydotdev/daily/blob/master/.claude-plugin/plugins/daily.dev/skills/daily.dev/SKILL.md`. Version it with semver (major = breaking, minor = new endpoints/fields, patch = doc fixes).

## Rules & Lessons

- **Don't reimplement auth or rate limiting** — `index.ts` already handles both. Middleware sets `request.apiUserId`, `request.userId`, `request.isPlus`; tokens only exist for Plus users (auto-revoked on cancellation). No per-route 401 checks or Plus validation.
- Rate limiting is two-layer: IP-based 300/min before auth (DoS protection, generous to spare shared IPs), user-based 60/min after auth (quota). Headers: `X-RateLimit-*` (IP), `X-RateLimit-*-User` (user), `Retry-After` on 429.
- **Reuse everything in `./common.ts`** before writing anything new: utilities (`parseLimit`, `ensureDbConnection`, `MAX_LIMIT`, `DEFAULT_LIMIT`), GraphQL field strings (`POST_NODE_FIELDS`, `BOOKMARKED_POST_EXTRA_FIELDS`, `PAGE_INFO_FIELDS`), and shared types (`PostNode`, `BookmarkedPostNode`, `FeedConnection<T>`, `PageInfo`, `SourceInfo`, `AuthorInfo`). Never duplicate field lists or redefine equivalent interfaces. Same for response schemas — check `schemas.ts` for an existing `$ref` before adding one.
- When the GraphQL node shape already matches the REST response, pass it through (`edges.map(({ node }) => node)`) — no field-by-field mapping.
- **Don't skip tests claiming "requires external service" without verifying** — `executeGraphql()` runs against the in-process schema and needs no external services. A test was once skipped for this false reason; check how similar tests run first.
- Don't expose query parameters that are already controlled by stored settings (e.g. a feed's ranking lives in its configuration — accepting it as a parameter creates conflicting sources of truth).
- Scope exposed fields to the API's use case (automation/AI agents): keep complex UI-centric fields (rich markdown readme, etc.) out of the public API.
- Group endpoints by resource, not by helper concept — e.g. a tool-search used only for stack management belongs under the stack routes, not a separate `/tools` prefix.
- Fastify route generics: define `Querystring`/`Params`/`Body` types inline for single-use routes.
- Document defaults and jargon in schema field descriptions (e.g. "defaults to algorithmic ranking if not provided") — API consumers don't know internal terms.

## Response Format

```typescript
{ data: [...], pagination: { hasNextPage, cursor } }  // list
{ data: { ... } }                                     // single item
{ error: 'error_code', message: 'Human readable' }    // error
```

## Adding an Endpoint

Create a route file in this directory following an existing one (e.g. `bookmarks.ts`), register it with a prefix in `index.ts`. Tests live in `__tests__/routes/public/` — use `setupPublicApiTests()` and `createTokenForUser` from its `helpers.ts` with supertest.
