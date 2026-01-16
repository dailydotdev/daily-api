# Request Flow Documentation

This document explains how requests flow through the Daily API from initialization to response.

## Table of Contents
- [High-Level Architecture](#high-level-architecture)
- [Server Initialization](#server-initialization)
- [Request Processing](#request-processing)
- [Concrete Example: whoami Query](#concrete-example-whoami-query)
- [Background Processing](#background-processing)
- [Key Design Patterns](#key-design-patterns)

---

## High-Level Architecture

The application is built with:
- **Fastify** - Web framework with plugins for CORS, helmet, cookies, rate limiting
- **Mercurius** - GraphQL server with caching, upload support, and subscriptions
- **TypeORM** - Database ORM with entity-based modeling and migrations
- **PostgreSQL** - Primary database with master/replica replication setup
- **Redis** - Caching and pub/sub via ioRedisPool
- **Temporal** - Workflow orchestration for background jobs
- **ClickHouse** - Analytics and metrics storage

---

## Server Initialization

### Entry Point: `bin/cli.ts`

When you run `pnpm run dev`, the CLI dispatcher starts:

```typescript
// bin/cli.ts:15-26
switch (positionals[0]) {
  case 'api':
    tracer('api').start();              // Start OpenTelemetry tracing
    await startMetrics('api');          // Start Prometheus metrics
    await initGeoReader();              // Load GeoIP database

    const app = await api();            // Creates Fastify app
    await app.listen({                  // Starts listening
      port: parseInt(process.env.PORT) || 3000,
      host: '0.0.0.0',
    });
    break;
}
```

**Available modes:**
- `api` - Start Fastify server (default port 5000 in dev)
- `websocket` - Start server with WebSocket subscriptions
- `background` - Start Pub/Sub worker listener
- `temporal` - Start Temporal worker
- `cron` - Run specific cron job

### Fastify Application Setup: `src/index.ts`

The `api()` function in `src/index.ts:61` creates and configures the Fastify server:

```typescript
export default async function app(): Promise<FastifyInstance> {
  // 1. Initialize database connection
  const connection = await createOrGetConnection();  // src/index.ts:66

  // 2. Create Fastify instance
  const app = fastify({
    logger: loggerConfig,
    trustProxy: true,
  });  // src/index.ts:71-76

  // 3. Load GrowthBook feature flags
  await loadFeatures(app.log);  // src/index.ts:79

  // 4. Setup graceful shutdown handlers
  process.on('SIGINT', gracefulShutdown);   // src/index.ts:96
  process.on('SIGTERM', gracefulShutdown);  // src/index.ts:97
```

### Middleware Registration Order

**CRITICAL:** Middleware executes in registration order. This order matters!

```typescript
// Security & CORS
app.register(helmet);                    // [1] Security headers (line 99)
app.register(cors, { ... });             // [2] CORS validation (line 104)
app.register(cookie, { ... });           // [3] Cookie parsing (line 127)

// Authentication & Tracking
app.register(auth, { ... });             // [4] Authentication (line 130)
app.register(tracking);                  // [5] Tracking IDs (line 131)

// Utilities
app.register(fastifyRawBody, { ... });   // [6] Raw body for webhooks (line 132)
```

### GraphQL Setup

```typescript
// src/index.ts:163-257
app.register(mercurius, {
  schema,                                 // Combined GraphQL schema from src/graphql.ts
  context: (request) => new Context(request, connection),  // Context creation
  queryDepth: 10,                         // Limit query depth for security
  subscription: getSubscriptionSettings(connection),
  graphiql: !isProd,                      // Disable in production
  validationRules: isProd ? [NoSchemaIntrospectionCustomRule] : undefined,
  errorFormatter: ...                     // Custom error handling
});
```

### GraphQL Caching (Production Only)

```typescript
// src/index.ts:259-336
if (isProd) {
  app.register(MercuriusCache, {
    ttl: 10,  // 10-second default TTL
    policy: {
      Query: {
        searchBookmarks: {
          extendKey: userExtendKey  // Cache key includes user ID
        },
        advancedSettings: {
          extendKey: trackingExtendKey  // Cache key includes tracking ID
        }
      }
    }
  });
}
```

---

## Request Processing

### Middleware Chain Execution

Every incoming request flows through this sequence:

#### 1. Helmet Security (`src/index.ts:99`)
- Adds security headers (CSP, X-Frame-Options, etc.)
- Protects against common web vulnerabilities

#### 2. CORS Validation (`src/index.ts:104-126`)

```typescript
app.register(cors, {
  origin: async (origin?: string) => {
    if (!isProd) return true;  // Dev: allow all origins

    // Production: check against allowlist
    if (remoteConfig.vars.origins?.includes(originString)) return true;
    if (originRegex.test(originString)) return true;  // Matches *.daily.dev

    return [false];  // Reject
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
});
```

#### 3. Cookie Parsing (`src/index.ts:127-129`)

```typescript
app.register(cookie, {
  secret: process.env.COOKIES_KEY,  // For signing/unsigning cookies
});
```

Parses cookies from request headers into `req.cookies` object.

#### 4. Authentication Hook (`src/auth.ts:96-137`)

**This is where user authentication happens.**

```typescript
fastify.addHook('preHandler', async (req) => {
  // [A] Check for machine-to-machine authentication
  if (req.headers['authorization'] === `Service ${opts.secret}`) {
    req.service = true;
    if (req.headers['user-id'] && req.headers['logged-in'] === 'true') {
      req.userId = req.headers['user-id'] as string;
      req.isPlus = req.headers['is-plus'] === 'true';
      req.isTeamMember = req.headers['is-team-member'] === 'true';
      req.roles = ((req.headers['roles'] as string)?.split(',') as Roles[]) ?? [];
    }
  }

  // [B] Check for JWT cookie authentication
  const authCookie = req.cookies[cookies.auth.key];  // 'da3.auth'
  if (!req.userId && authCookie) {
    try {
      // Unsign cookie using COOKIES_KEY secret
      const unsigned = req.unsignCookie(authCookie);
      if (unsigned.valid) {
        // Verify JWT signature using RS256 algorithm
        const payload = await verifyJwt(unsigned.value);  // src/auth.ts:24-40
        if (payload) {
          req.userId = payload.userId;
          req.roles = payload.roles;
          req.isTeamMember = payload.isTeamMember;
          req.isPlus = payload.isPlus;
          req.accessToken = { token: unsigned.value, expiresIn: new Date(payload.exp * 1000) };
        }
      }
    } catch (err) {
      // Invalid JWT - user remains unauthenticated
    }
  }
});
```

**JWT Verification (`src/auth.ts:24-40`):**
- Uses RS256 algorithm with RSA public key
- Validates `audience` and `issuer` claims
- Returns payload with: `userId`, `roles`, `isTeamMember`, `isPlus`, `exp`

**Request Decorations:**
After this hook, the request object has:
- `req.userId?: string` - User ID if authenticated
- `req.roles?: Roles[]` - User roles (e.g., ["moderator"])
- `req.isTeamMember?: boolean` - Daily team member flag
- `req.isPlus?: boolean` - Plus subscription status
- `req.accessToken?: AccessToken` - JWT token and expiration
- `req.service?: boolean` - M2M authentication flag

#### 5. Tracking Hook (`src/tracking.ts:35`)

**This is where tracking and session IDs are assigned.**

```typescript
fastify.addHook('preHandler', async (req, reply) => {
  // [A] Detect if request is from a bot
  req.isBot = isbot(req.headers['user-agent']);

  // [B] Get or generate session ID
  let sessionId = req.cookies.session;
  if (!sessionId) {
    sessionId = randomUUID();
    reply.setCookie('session', sessionId, {
      maxAge: 30 * 24 * 60 * 60,  // 30 days
      path: '/',
      httpOnly: true,
      sameSite: 'lax'
    });
  }
  req.sessionId = sessionId;

  // [C] Determine tracking ID
  if (req.userId) {
    // Authenticated users: use userId as trackingId
    req.trackingId = req.userId;
  } else if (req.cookies.tracking) {
    // Anonymous users with existing tracking cookie
    req.trackingId = req.cookies.tracking;
  } else if (!req.isBot && !req.service) {
    // New anonymous user (not bot, not service)
    req.trackingId = generateTrackingId();
    reply.setCookie('tracking', req.trackingId, { ... });
  }
});
```

**Request Decorations:**
After this hook, the request object has:
- `req.isBot: boolean` - Bot detection result
- `req.sessionId: string` - Session identifier
- `req.trackingId: string` - Tracking identifier (userId or anonymous ID)

### GraphQL Context Creation (`src/Context.ts`)

Before resolvers execute, Mercurius creates a Context object:

```typescript
// src/index.ts:165-166
context: (request): Context => new Context(request, connection)
```

**Context Class (`src/Context.ts`):**

```typescript
export class Context {
  constructor(
    public readonly request: FastifyRequest,
    protected connection: DataSource,
  ) {}

  // User identity from auth hook
  get userId(): string | undefined {
    return this.request.userId;
  }

  get roles(): Roles[] {
    return this.request.roles ?? [];
  }

  get isPlus(): boolean {
    return this.request.isPlus ?? false;
  }

  get isTeamMember(): boolean {
    return this.request.isTeamMember ?? false;
  }

  // Tracking from tracking hook
  get trackingId(): string {
    return this.request.trackingId;
  }

  get sessionId(): string {
    return this.request.sessionId;
  }

  get isBot(): boolean {
    return this.request.isBot;
  }

  // Database connection
  get con(): DataSource {
    return this.connection;  // TypeORM DataSource
  }

  // GraphORM loader for N+1 prevention
  get loader(): GraphQLDatabaseLoader {
    if (!this._loader) {
      this._loader = new GraphQLDatabaseLoader(this.con);
    }
    return this._loader;
  }

  // DataLoader service for batching queries
  get dataLoader(): DataLoaderService {
    if (!this._dataLoaderService) {
      this._dataLoaderService = new DataLoaderService(this);
    }
    return this._dataLoaderService;
  }

  // Request metadata
  get log(): FastifyBaseLogger {
    return this.request.log;
  }

  get span() {
    return this.request.span;  // OpenTelemetry span
  }

  get region(): string | undefined {
    return this.request.headers['x-client-region'] as string;
  }

  get contentLanguage(): ContentLanguage {
    return (this.request.headers['content-language'] as ContentLanguage) || 'en';
  }

  // Helper methods
  getRepository<T>(entity: EntityTarget<T>): Repository<T> {
    return this.con.getRepository(entity);
  }
}
```

**Context provides:**
- ✅ User authentication state (userId, roles, isPlus)
- ✅ Tracking identifiers (trackingId, sessionId)
- ✅ Database access (connection, repositories)
- ✅ Efficient data loading (GraphORM, DataLoader)
- ✅ Logging and tracing (logger, OpenTelemetry span)
- ✅ Request metadata (headers, region, language)

### GraphQL Schema Directive Pipeline

Before resolvers execute, GraphQL directives apply cross-cutting concerns:

**Directive Execution Order** (nested transformers, innermost executes first):

1. **Rate Limit Transformers** (`src/directive/rateLimit.ts`)
2. **Auth Directive Transformer** (`src/directive/auth.ts`)
3. **Rate Limit Counter Directive** (`src/directive/rateLimit.ts`)
4. **Feed Plus Directive** (`src/directive/feedPlus.ts`)
5. **URL Directive Transformer** (`src/directive/url.ts`)

#### Auth Directive (`src/directive/auth.ts`)

**Applied with:** `@auth(requires: [Role])`

```typescript
const authDirective = (next, source, args, ctx: AuthContext, info) => {
  // Check authentication
  if (!ctx.userId) {
    if (info.parentType.name === 'Query' || info.parentType.name === 'Mutation') {
      throw new AuthenticationError('Unauthorized');
    }
    return null;  // Return null for object fields
  }

  // Check role requirements
  if (requires.length > 0) {
    if (!ctx.roles?.some(role => requires.includes(role))) {
      throw new ForbiddenError('Forbidden');
    }
  }

  return next();  // Continue to resolver
};
```

**Example usage:**
```graphql
type Query {
  whoami: User! @auth(requires: [])          # Requires authentication, no specific role
  deleteUser(id: ID!): EmptyResponse! @auth(requires: [MODERATOR])  # Requires moderator role
}
```

#### Rate Limit Directive (`src/directive/rateLimit.ts`)

**Applied with:** `@rateLimit(limit: Int, duration: Int)`

```typescript
const rateLimitDirective = async (next, source, args, ctx: Context) => {
  const key = generateRateLimitKey(ctx.userId || ctx.trackingId, fieldName);

  try {
    await rateLimiter.consume(key, 1);  // Consume 1 point
    return next();
  } catch (err) {
    throw new RateLimitError(`Take a break. You already posted enough in the last 1 hour`);
  }
};
```

Uses `rate-limiter-flexible` with Redis backend.

#### URL Directive (`src/directive/url.ts`)

**Applied with:** `@url` on scalar types

Validates URL inputs using `validate.js` during scalar parsing.

### Resolver Execution

Resolvers are organized by domain in `src/schema/`:

**Schema Structure:**
```
src/schema/
├── posts.ts          # Post queries and mutations
├── users.ts          # User queries and mutations
├── comments.ts       # Comment operations
├── feeds.ts          # Feed queries
├── squads.ts         # Squad management
└── ... (30+ domain files)
```

**Resolver Pattern:**

```typescript
// src/schema/users.ts
export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers({
  Query: {
    whoami: async (
      source,                        // Parent object (null for Query)
      args,                          // Query arguments
      ctx: AuthContext,              // Context object
      info: GraphQLResolveInfo       // Query metadata
    ) => {
      // 1. Authentication already checked by @auth directive

      // 2. Use GraphORM for efficient querying
      const res = await graphorm.query<GQLUser>(
        ctx,
        info,
        (builder) => {
          // Apply filters
          builder.queryBuilder = builder.queryBuilder
            .andWhere(`${builder.alias}.id = :id`, { id: ctx.userId })
            .limit(1);
          return builder;
        },
        true,  // Use loader
      );

      if (!res[0]) {
        throw new NotFoundError('user not found');
      }

      return res[0];
    }
  },

  Mutation: {
    updateUserProfile: async (source, args, ctx, info) => {
      // 1. Validate input with Zod
      const input = updateUserSchema.parse(args.data);

      // 2. Check permissions
      if (ctx.userId !== args.id && !ctx.roles.includes('MODERATOR')) {
        throw new ForbiddenError('Cannot update other users');
      }

      // 3. Execute business logic
      const user = await ctx.getRepository(User).findOneByOrFail({ id: args.id });
      Object.assign(user, input);
      await ctx.getRepository(User).save(user);

      // 4. Fire background jobs (if needed)
      await pubsub.topic(StorageTopic.UserUpdated).publish(
        Message.encode(new UserUpdatedMessage({ userId: user.id }))
      );

      return user;
    }
  },

  User: {
    // Field resolver for nested data
    settings: async (user, args, ctx) => {
      // Use DataLoader for efficient batching
      return ctx.dataLoader.userSettings.load({ userId: user.id });
    }
  }
});
```

### Data Loading & N+1 Prevention

Two mechanisms prevent N+1 queries:

#### 1. GraphORM (`src/graphorm/`)

**Automatic optimization based on GraphQL query structure:**

```typescript
// Analyzes GraphQL query to determine which fields are requested
const res = await graphorm.query<GQLUser>(ctx, info, (builder) => {
  builder.queryBuilder = builder.queryBuilder
    .andWhere(`${builder.alias}.id = :id`, { id: ctx.userId });
  return builder;
});
```

**GraphORM:**
- Analyzes `GraphQLResolveInfo` to see which fields are requested
- Eagerly loads related entities using TypeORM joins
- Only fetches requested fields (no over-fetching)
- Prevents N+1 queries at the ORM level

See `src/graphorm/AGENTS.md` for comprehensive guide.

#### 2. DataLoader Service (`src/dataLoaderService.ts`)

**Manual batching for specific use cases:**

```typescript
// In DataLoaderService class
get userSettings() {
  return this.getLoader<{ userId: string }, Settings>({
    type: 'userSettings',
    loadFn: async ({ userId }) => {
      return this.ctx.con.getRepository(Settings).findOneBy({ userId });
    },
    options: { maxBatchSize: 30 }
  });
}

// In field resolver
User: {
  settings: async (user, args, ctx) => {
    return ctx.dataLoader.userSettings.load({ userId: user.id });
  }
}
```

**DataLoader:**
- Batches multiple `load()` calls into single query
- Caches results within a single request
- Configurable batch size (default: 30)

### Database Access Patterns

#### Master/Replica Configuration

```typescript
// src/data-source.ts
export const AppDataSource = new DataSource({
  type: 'postgres',
  replication: {
    master: {
      host: process.env.POSTGRES_HOST,
      // ... master config
    },
    slaves: [{
      host: process.env.POSTGRES_REPLICA_HOST,
      // ... replica config
    }]
  }
});
```

#### Read Replica Usage

```typescript
// src/common/queryReadReplica.ts
import { queryReadReplica } from '../common/queryReadReplica';

// Use replica for eventually-consistent reads
const posts = await queryReadReplica(
  ctx.con,
  (con) => con.getRepository(Post).find({ where: { ... } })
);
```

**Guidelines:**
- Use **master** for: writes, critical reads, real-time data
- Use **replica** for: analytics, lists, search results, eventually-consistent data

### Error Handling

**Error Formatter (`src/index.ts:172-242`):**

```typescript
errorFormatter(execution, ctx) {
  if (execution.errors?.length > 0) {
    return {
      statusCode: 200,  // GraphQL always returns 200
      response: {
        data: execution.data,
        errors: execution.errors.map((error): GraphQLError => {
          const newError = error as Mutable<GraphQLError>;

          // Map error types to codes
          if (error.originalError?.name === 'EntityNotFoundError') {
            newError.message = 'Entity not found';
            newError.extensions = { code: 'NOT_FOUND' };
          } else if (error.originalError instanceof BrokenCircuitError) {
            newError.message = 'Garmr broken error';
            newError.extensions = { code: 'GARMR_BROKEN_ERROR' };
          } else if (error.originalError instanceof ZodError) {
            newError.message = 'Validation error';
            newError.extensions = {
              code: 'ZOD_VALIDATION_ERROR',
              issues: error.originalError.issues
            };
          } else {
            newError.message = 'Unexpected error';
            newError.extensions = { code: 'UNEXPECTED' };
          }

          // Hide sensitive details in production
          if (isProd) {
            newError.originalError = undefined;
          }

          return newError;
        })
      }
    };
  }
}
```

**Custom Error Types:**
- `AuthenticationError` → `UNAUTHENTICATED`
- `ForbiddenError` → `FORBIDDEN`
- `ValidationError` → `BAD_USER_INPUT`
- `NotFoundError` → `NOT_FOUND`
- `ZodError` → `ZOD_VALIDATION_ERROR` (with issues array)
- `BrokenCircuitError` → `GARMR_BROKEN_ERROR`

---

## Concrete Example: whoami Query

Let's trace a complete request through the system.

### Request

```http
POST http://localhost:5000/graphql
Content-Type: application/json
Cookie: da3.auth=s%3Aeyabc123...xyz
Content-Language: en

{
  "query": "{ whoami { id name email username } }"
}
```

### Step-by-Step Execution

#### Step 1: Entry Point (`bin/cli.ts:22`)

```bash
$ pnpm run dev
# Runs: node bin/cli.ts api
```

Calls `api()` function from `src/index.ts`.

#### Step 2: Server Initialization (`src/index.ts:66-79`)

- Create PostgreSQL connection
- Create Fastify instance with logger
- Load GrowthBook feature flags
- Register middleware (in order)
- Register GraphQL endpoint
- Start listening on port 5000

**Server is ready!** ✅

#### Step 3: Request Arrives

HTTP request hits port 5000, route: `POST /graphql`

#### Step 4: Middleware Chain

**[A] Helmet Security** (`src/index.ts:99`)
- Adds: `X-Frame-Options`, `X-Content-Type-Options`, etc.
- ✅ Continue

**[B] CORS Validation** (`src/index.ts:104-126`)
- Origin: `http://localhost:3000`
- Dev mode: Allow all origins
- Add CORS headers to response
- ✅ Continue

**[C] Cookie Parsing** (`src/index.ts:127-129`)
- Parse `Cookie: da3.auth=s%3Aeyabc123...xyz`
- Store in `req.cookies['da3.auth']`
- ✅ Continue

**[D] Authentication Hook** (`src/auth.ts:96-137`)

```typescript
// Check for M2M auth
if (req.headers['authorization'] === `Service ${secret}`) {
  // Not present in this request
}

// Check for JWT cookie
const authCookie = req.cookies['da3.auth'];  // Found!
if (!req.userId && authCookie) {
  // Unsign cookie
  const unsigned = req.unsignCookie(authCookie);
  // unsigned.value = "eyJhbGciOiJSUzI1NiIs..."

  // Verify JWT
  const payload = await verifyJwt(unsigned.value);
  // Verifies signature with RSA public key
  // Checks audience and issuer

  // Decode payload
  // {
  //   "userId": "user123",
  //   "roles": ["moderator"],
  //   "isTeamMember": false,
  //   "isPlus": true,
  //   "exp": 1735689600
  // }

  // Decorate request
  req.userId = "user123";
  req.roles = ["moderator"];
  req.isTeamMember = false;
  req.isPlus = true;
  req.accessToken = { token: unsigned.value, expiresIn: new Date(1735689600 * 1000) };
}
```

**Request now has:**
- ✅ `req.userId = "user123"`
- ✅ `req.roles = ["moderator"]`
- ✅ `req.isPlus = true`

**[E] Tracking Hook** (`src/tracking.ts:35`)

```typescript
// Detect bot
req.isBot = isbot(req.headers['user-agent']);  // false

// Session ID (from cookie or generate new)
req.sessionId = req.cookies.session || randomUUID();

// Tracking ID
if (req.userId) {
  req.trackingId = req.userId;  // "user123" (authenticated user)
} else if (req.cookies.tracking) {
  req.trackingId = req.cookies.tracking;
} else {
  req.trackingId = generateTrackingId();
}
```

**Request now has:**
- ✅ `req.isBot = false`
- ✅ `req.sessionId = "abc-def-ghi-jkl"`
- ✅ `req.trackingId = "user123"`

#### Step 5: GraphQL Processing

**[A] Context Creation** (`src/index.ts:165-166`)

```typescript
context: (request): Context => new Context(request, connection)
```

Creates Context object with:
- ✅ `ctx.userId = "user123"`
- ✅ `ctx.roles = ["moderator"]`
- ✅ `ctx.isPlus = true`
- ✅ `ctx.trackingId = "user123"`
- ✅ `ctx.con` = Database connection
- ✅ `ctx.loader` = GraphORM loader
- ✅ `ctx.dataLoader` = DataLoader service
- ✅ `ctx.log` = Logger
- ✅ `ctx.contentLanguage = "en"`

**[B] Query Parsing**

Mercurius parses GraphQL query:
```graphql
{
  whoami {
    id
    name
    email
    username
  }
}
```

**AST:**
- Operation: Query
- Field: `whoami`
- Selections: `id`, `name`, `email`, `username`

**[C] Schema Directive Check**

```graphql
type Query {
  whoami: User! @auth(requires: [])
}
```

**Auth Directive Execution** (`src/directive/auth.ts`):
```typescript
if (!ctx.userId) {
  throw new AuthenticationError('Unauthorized');  // Would throw here
}
// ctx.userId = "user123" ✅

if (requires.length > 0 && !ctx.roles?.some(r => requires.includes(r))) {
  throw new ForbiddenError('Forbidden');
}
// requires = [] (no specific role needed) ✅

// Proceed to resolver
```

**[D] Resolver Execution** (`src/schema/users.ts:1672-1687`)

```typescript
whoami: async (_, __, ctx: AuthContext, info: GraphQLResolveInfo) => {
  // Use GraphORM to fetch user
  const res = await graphorm.query<GQLUser>(
    ctx,
    info,
    (builder) => {
      builder.queryBuilder = builder.queryBuilder
        .andWhere(`${builder.alias}.id = :id`, { id: ctx.userId })  // WHERE id = 'user123'
        .limit(1);
      return builder;
    },
    true,
  );

  if (!res[0]) {
    throw new NotFoundError('user not found');
  }

  return res[0];
}
```

**GraphORM Analysis:**
- Requested fields: `id`, `name`, `email`, `username`
- Entity: `User`
- Generates optimized SQL

**Generated SQL:**
```sql
SELECT
  u.id,
  u.name,
  u.email,
  u.username
FROM users u
WHERE u.id = 'user123'
LIMIT 1
```

**Query executes:**
- Database: PostgreSQL master
- Returns: 1 row

**Result:**
```typescript
{
  id: "user123",
  name: "John Doe",
  email: "john@example.com",
  username: "johndoe"
}
```

#### Step 6: Response Formatting

**[A] Error Formatting** (none in this case)

**[B] JSON Serialization**

```json
{
  "data": {
    "whoami": {
      "id": "user123",
      "name": "John Doe",
      "email": "john@example.com",
      "username": "johndoe"
    }
  }
}
```

**[C] Caching Check**

`whoami` is not in cache policy → not cached (intentional, user-specific data)

#### Step 7: HTTP Response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Set-Cookie: session=abc-def-ghi-jkl; Path=/; HttpOnly; SameSite=Lax
Vary: content-language

{
  "data": {
    "whoami": {
      "id": "user123",
      "name": "John Doe",
      "email": "john@example.com",
      "username": "johndoe"
    }
  }
}
```

**Total time:** ~50-150ms ⚡

### Execution Summary

| Step | File | Line | Action |
|------|------|------|--------|
| **0** | `bin/cli.ts` | 22 | `const app = await api()` |
| **1** | `src/index.ts` | 66 | Create DB connection |
| **2** | `src/index.ts` | 71 | Create Fastify instance |
| **3** | `src/index.ts` | 99 | Register Helmet |
| **4** | `src/index.ts` | 104 | Register CORS |
| **5** | `src/index.ts` | 127 | Register Cookie parser |
| **6** | `src/index.ts` | 130 | Register Auth plugin |
| **7** | `src/index.ts` | 131 | Register Tracking plugin |
| **8** | `src/index.ts` | 163 | Register Mercurius (GraphQL) |
| **9** | `bin/cli.ts` | 23-26 | Start listening on port 5000 |
| | | | **🎉 SERVER READY** |
| **10** | - | - | Request arrives → CORS check |
| **11** | `src/auth.ts` | 96 | Auth hook - verify JWT |
| **12** | `src/tracking.ts` | 35 | Tracking hook - set IDs |
| **13** | `src/index.ts` | 165 | Create Context |
| **14** | `src/directive/auth.ts` | - | Auth directive - check auth |
| **15** | `src/schema/users.ts` | 1672 | Execute `whoami` resolver |
| **16** | `src/graphorm/*` | - | Execute optimized SQL |
| **17** | `src/index.ts` | 172 | Format errors (if any) |
| **18** | - | - | Serialize & send response |

---

## Background Processing

The application has multiple background processing paths:

### 1. Pub/Sub Workers (`src/background.ts`)

**Startup:** `pnpm run cli background`

**Process:**
1. Creates Google Cloud Pub/Sub client
2. Subscribes to all registered worker subscriptions
3. Listens for messages indefinitely
4. Parses message (JSON or Protobuf)
5. Calls handler with parsed data + context

**Example Workers** (`src/workers/index.ts`):
- `postUpvotedRep` - Calculate reputation when post upvoted
- `newNotificationMail` - Send email notifications
- `postCommentedSlackMessage` - Send Slack notifications
- `postFreeformImages` - Process post images

**Worker Pattern:**

```typescript
// src/workers/postUpvoted.ts
export const postUpvotedRep: TypedWorker = {
  subscription: 'post-upvoted-rep',

  handler: async (message: PostUpvotedMessage, con, log, pubsub) => {
    // 1. Fetch data
    const post = await con.getRepository(Post).findOneBy({ id: message.postId });

    // 2. Business logic
    const reputationChange = calculateReputation(post);

    // 3. Update database
    await con.getRepository(UserReputation).increment(
      { userId: post.authorId },
      'reputation',
      reputationChange
    );

    // 4. Fire additional events if needed
    await pubsub.topic(StorageTopic.ReputationUpdated).publish(...);
  }
};
```

See `src/workers/AGENTS.md` for comprehensive guide.

### 2. CDC Workers (Change Data Capture)

**Source:** Debezium capturing PostgreSQL Write-Ahead Log (WAL)

**Pattern:** Listen to `cdc` topic for database changes

**Workers:**
- `cdc/primary` - Primary change processing
- `cdc/notifications` - Notification-specific CDC handling

**Example:** When user updates profile, CDC worker sends notification to followers.

### 3. Temporal Workflows (`src/temporal/`)

**Startup:** `pnpm run dev:temporal-worker`

**Purpose:** Long-running, stateful async workflows

**Example:** Personalized digest generation with retry logic

```typescript
// src/temporal/notifications.ts
export async function personalizedDigestWorkflow(userId: string) {
  // Workflow with retries, timeouts, and state management
  const userPrefs = await activities.getUserPreferences(userId);
  const posts = await activities.getRecommendedPosts(userId, userPrefs);
  await activities.sendDigestEmail(userId, posts);
}
```

### 4. Cron Jobs (`src/cron/`)

**Startup:** Deployed via Pulumi config in `.infra/crons.ts`

**Run Locally:** `pnpm run cli cron <name>`

**Pattern:** One file per cron, registered in `src/cron/index.ts`

**Cron Structure:**

```typescript
// src/cron/updateViewCounts.ts
export const updateViewCounts: Cron = {
  name: 'update-view-counts',
  handler: async (con: DataSource, logger: FastifyBaseLogger, pubsub: PubSub) => {
    // Scheduled task logic
    const posts = await con.getRepository(Post).find({ ... });
    // Update view counts
    // ...
  }
};
```

See `src/cron/AGENTS.md` for comprehensive guide.

---

## Key Design Patterns

### 1. Type Safety

- **TypeScript everywhere** - Compile-time type checking
- **Zod schemas** - Runtime validation at boundaries (API inputs, external data)
- **GraphQL schema** - Single source of truth for API contracts

**Example:**
```typescript
import { z } from 'zod';

const updateUserSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  bio: z.string().max(200).optional(),
  email: z.string().email().optional(),
});

updateUserProfile: async (source, args, ctx) => {
  const input = updateUserSchema.parse(args.data);  // Runtime validation
  // ...
}
```

### 2. Context Injection

- Context object passed through entire request lifecycle
- Centralized access to:
  - Database connection
  - User authentication state
  - Data loaders
  - Logger and tracing
  - Request metadata

### 3. Separation of Concerns

**Directives** handle cross-cutting concerns:
- Authentication (`@auth`)
- Authorization (`@auth(requires: [ROLE])`)
- Rate limiting (`@rateLimit`)
- Input validation (`@url`)

**Resolvers** handle business logic:
- Data fetching
- Validation
- Business rules
- Database operations

**Workers** handle async processing:
- Notifications
- Reputation calculation
- External integrations
- Data processing

**Crons** handle scheduled tasks:
- Cleanup
- Aggregation
- Batch operations

### 4. Efficiency

**N+1 Query Prevention:**
- GraphORM for automatic optimization
- DataLoader for manual batching

**Database Optimization:**
- Read replicas for eventually-consistent reads
- Connection pooling
- Prepared statements

**Caching:**
- Redis for rate limiting, session storage
- Mercurius cache for query results (production)
- DataLoader request-scoped cache

### 5. Error Handling

**Structured error responses:**
- Custom error types with specific codes
- Zod validation errors with detailed issues
- Sensitive details hidden in production

**Error tracking:**
- OpenTelemetry integration
- Detailed logging with context
- Error monitoring and alerting

### 6. Observability

**Logging:**
- Pino logger with structured JSON output
- Request-scoped context
- Log levels based on environment

**Tracing:**
- OpenTelemetry distributed tracing
- Span creation for key operations
- Trace context propagation

**Metrics:**
- Prometheus metrics export
- Custom business metrics
- Performance monitoring

---

## Production Considerations

1. **Introspection disabled** - `NoSchemaIntrospectionCustomRule` in production
2. **GraphQL caching enabled** - 10-second TTL for specific queries
3. **Error details hidden** - Sensitive information removed from responses
4. **Rate limiting enforced** - Redis-backed rate limiter per user/trackingId
5. **CORS validation** - Allowlist + regex pattern for `*.daily.dev`
6. **Helmet security headers** - Protection against common vulnerabilities
7. **Graceful shutdown** - 9-second window for in-flight requests to complete
8. **Connection pooling** - Efficient database connection management
9. **Read replicas** - Offload read traffic from master database
10. **Telemetry** - Distributed tracing and metrics collection

---

## Key File Locations

| File | Purpose |
|------|---------|
| `bin/cli.ts` | CLI dispatcher (entry point) |
| `src/index.ts` | Main Fastify setup, plugin registration |
| `src/auth.ts` | JWT/cookie authentication hook |
| `src/tracking.ts` | Session & tracking ID management |
| `src/Context.ts` | Request context object |
| `src/graphql.ts` | GraphQL schema composition |
| `src/schema/*.ts` | Domain-specific resolvers (30+ files) |
| `src/directive/*.ts` | Auth, rate limiting, validation (5 files) |
| `src/graphorm/` | GraphORM implementation for N+1 prevention |
| `src/dataLoaderService.ts` | Batch data loading service |
| `src/background.ts` | Pub/Sub worker startup |
| `src/workers/*.ts` | Individual background job handlers (50+ files) |
| `src/temporal/` | Temporal workflow definitions |
| `src/cron/` | Scheduled cron jobs |
| `src/routes/*.ts` | REST endpoints (boot, whoami, webhooks) |
| `src/entity/*.ts` | TypeORM entity definitions |
| `src/migration/*.ts` | Database migrations |

---

## Additional Resources

- **GraphORM Guide:** `src/graphorm/AGENTS.md`
- **Workers Guide:** `src/workers/AGENTS.md`
- **Cron Guide:** `src/cron/AGENTS.md`
- **Project Instructions:** `CLAUDE.md`