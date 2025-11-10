# GraphORM Documentation

## Overview

GraphORM is a custom-built tool that solves the classic N+1 query problem in GraphQL by transforming GraphQL queries into optimized single PostgreSQL queries. Instead of executing multiple database queries (one per field resolution), GraphORM analyzes the GraphQL query structure, TypeORM entity metadata, and a configuration object to generate a single SQL query using PostgreSQL's JSON aggregation functions.

**GraphORM is the default and preferred method for GraphQL query responses in this codebase.** It should be used instead of direct TypeORM repository queries whenever possible, as it enforces best practices and prevents common performance issues.

## The Problem: N+1 Queries

In traditional GraphQL resolvers, each field might trigger a separate database query:

```graphql
query {
  posts(first: 10) {
    id
    title
    author {
      id
      name
      profile {
        avatar
      }
    }
    comments {
      id
      content
      user {
        name
      }
    }
  }
}
```

Without GraphORM, this could result in:
- 1 query for posts
- 10 queries for authors (one per post)
- 10 queries for profiles (one per author)
- 10 queries for comments (one per post)
- N queries for comment users (one per comment)

**Total: 1 + 10 + 10 + 10 + N = potentially 30+ queries**

With GraphORM, this becomes **1 optimized SQL query** that uses JSON aggregation to return all nested data in a single result set.

## How GraphORM Works

### Architecture Overview

1. **Query Parsing**: GraphORM receives the GraphQL `resolveInfo` object and parses it into a resolve tree using `graphql-parse-resolve-info`.

2. **Metadata Scanning**: It scans TypeORM entity metadata in real-time to understand:
   - Table names and column mappings
   - Entity relationships (one-to-many, many-to-one)
   - Foreign key relationships

3. **Configuration Lookup**: It checks the GraphORM configuration object (`src/graphorm/index.ts`) for:
   - Custom field mappings
   - Transform functions
   - Custom relations
   - Required columns
   - Field aliases

4. **SQL Generation**: It builds a TypeORM `QueryBuilder` that:
   - Uses subqueries with `jsonb_agg()` for one-to-many relations
   - Uses `to_jsonb()` for one-to-one relations
   - Aggregates nested data into JSON structures
   - Applies filters, sorting, and pagination

5. **Post-Processing**: After fetching raw results, it applies JavaScript transform functions to:
   - Reshape nested JSON data
   - Apply business logic
   - Handle permissions and visibility
   - Format dates and other types

### Key Concepts

#### 1. GraphORM Mappings

The configuration object (`src/graphorm/index.ts`) defines how GraphQL types map to database entities and how fields should be resolved:

```typescript
const obj = new GraphORM({
  Post: {
    requiredColumns: ['id', 'title', 'createdAt'],
    fields: {
      // Field configurations here
    }
  }
});
```

#### 2. Field Configuration

Each field can have:
- **`select`**: Custom SQL selection (string or function)
- **`transform`**: Post-processing function
- **`relation`**: Custom relation definition
- **`alias`**: Map to another field
- **`jsonType`**: Mark as JSON column
- **`pagination`**: Relay-style pagination config

#### 3. Relations

GraphORM automatically detects TypeORM relations, but you can override them:

```typescript
fields: {
  comments: {
    relation: {
      isMany: true,
      customRelation: (ctx, parentAlias, childAlias, qb) => {
        return qb
          .where(`${childAlias}."postId" = ${parentAlias}.id`)
          .andWhere(`${childAlias}."deleted" = false`);
      }
    }
  }
}
```

#### 4. Transforms

Transform functions run after data is fetched, allowing you to:
- Apply business logic
- Check permissions
- Format data
- Compute derived values

```typescript
fields: {
  views: {
    transform: (value: number, ctx, parent): number | null => {
      const post = parent as Post;
      const isAuthor = post?.authorId && ctx.userId === post.authorId;
      return isAuthor ? value : null; // Only show views to author
    }
  }
}
```

## When to Use GraphORM

**GraphORM should be the default choice for all GraphQL query responses over direct TypeORM queries when possible.** This architectural decision enforces best practices including N+1 query prevention, consistent data fetching patterns, and optimized database access.

### ✅ Use GraphORM (Default Choice):

1. **All GraphQL queries fetching entities** - Posts, users, sources, comments, etc.
2. **Fetching entities with nested relations** - Posts with authors, comments, etc.
3. **Need to avoid N+1 queries** - Multiple related entities in one query
4. **Complex filtering/sorting** - When you need to filter at the database level
5. **Pagination** - Relay-style pagination with cursor-based navigation
6. **Read-heavy operations** - Queries that don't modify data

**Prefer GraphORM over TypeORM repositories for GraphQL resolvers** because it:
- Automatically prevents N+1 queries
- Enforces consistent query patterns
- Leverages PostgreSQL JSON aggregation for efficiency
- Provides built-in support for transforms and business logic
- Supports read replica routing

### ❌ Don't Use GraphORM When:

1. **Mutations** - GraphORM is read-only (use TypeORM repositories for writes)
2. **External API calls** - Data not in PostgreSQL
3. **Complex aggregations requiring raw SQL** - Better handled with raw SQL queries
4. **Real-time subscriptions** - Use standard resolvers
5. **Non-GraphQL endpoints** - REST endpoints or internal services can use TypeORM directly

**Note**: Even for simple queries without relations, prefer GraphORM for consistency and to benefit from future optimizations. The overhead is minimal and the consistency benefits are significant.

## Usage Examples

### Basic Query

```typescript
import { graphorm } from '../graphorm';

export const resolvers = {
  Query: {
    post: async (_, { id }: { id: string }, ctx: Context, info) => {
      return graphorm.queryOne<GQLPost>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where(`${builder.alias}.id = :id`, { id });
          return builder;
        }
      );
    }
  }
};
```

### Paginated Query

```typescript
import { graphorm } from '../graphorm';
import { offsetPageGenerator } from './common';

export const resolvers = {
  Query: {
    posts: async (_, args: ConnectionArguments, ctx: Context, info) => {
      const pageGenerator = offsetPageGenerator<GQLPost>(10, 100);
      const page = pageGenerator.connArgsToPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => pageGenerator.hasNextPage(page, nodeSize),
        (node, index) => pageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder
            .limit(page.limit)
            .offset(page.offset)
            .orderBy(`${builder.alias}."createdAt"`, 'DESC');
          return builder;
        }
      );
    }
  }
};
```

### Query with Custom Filtering

```typescript
export const resolvers = {
  Query: {
    keyword: async (_, { value }: { value: string }, ctx: Context, info) => {
      return graphorm.queryOne<GQLKeyword>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .andWhere(`${builder.alias}.value = :value`, { value })
            .limit(1);
          return builder;
        },
        true // Use read replica
      );
    }
  }
};
```

### Query One or Fail

```typescript
export const resolvers = {
  Query: {
    campaignById: async (_, { id }: { id: string }, ctx: Context, info) => {
      return graphorm.queryOneOrFail<GQLCampaign>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where({ id });
          return builder;
        }
      );
    }
  }
};
```

## Configuration Patterns

### Required Columns

Always select certain columns, even if not requested:

```typescript
Post: {
  requiredColumns: [
    'id',
    'createdAt',
    {
      column: `"contentMeta"->'alt_title'->'translations'`,
      columnAs: 'smartTitle',
      isJson: true
    }
  ]
}
```

### Anonymous Restrictions

Hide sensitive fields from unauthenticated users:

```typescript
UserExperience: {
  anonymousRestrictedColumns: [
    'user',
    'subtitle',
    'description',
    'startedAt',
    'endedAt'
  ]
}
```

### Custom Field Selection

Select from related tables or computed values:

```typescript
fields: {
  numUpvotes: {
    select: 'upvotes' // Maps to 'upvotes' column
  },
  isPlus: {
    alias: { field: 'subscriptionFlags', type: 'jsonb' },
    transform: (subscriptionFlags: UserSubscriptionFlags) =>
      isPlusMember(subscriptionFlags?.cycle)
  }
}
```

### Complex Relations

Define custom joins and filters:

```typescript
fields: {
  bookmark: {
    relation: {
      isMany: false,
      customRelation: ({ userId }, parentAlias, childAlias, qb) =>
        qb
          .where(`${parentAlias}.id = ${childAlias}."postId"`)
          .andWhere(`${childAlias}."userId" = :userId`, { userId })
    }
  }
}
```

### JSON Field Handling

Handle JSONB columns:

```typescript
fields: {
  flags: {
    jsonType: true,
    transform: (value: PostFlagsPublic): PostFlagsPublic => ({
      ...value,
      generatedAt: transformDate(value.generatedAt)
    })
  }
}
```

## Best Practices

### 1. Always Use `beforeQuery` for Filtering

Don't fetch all data and filter in JavaScript. Filter at the database level:

```typescript
(builder) => {
  builder.queryBuilder
    .andWhere(`${builder.alias}."userId" = :userId`, { userId: ctx.userId })
    .andWhere(`${builder.alias}."deleted" = false`);
  return builder;
}
```

### 2. Use Transforms for Business Logic

Keep SQL queries focused on data fetching. Use transforms for:
- Permission checks
- Data formatting
- Computed values
- Conditional field visibility

### 3. Leverage Required Columns

If a transform function needs data that might not be requested, add it to `requiredColumns`:

```typescript
requiredColumns: [
  'id',
  'authorId', // Needed for permission checks in transforms
  'scoutId'
]
```

### 4. Use Pagination for Large Datasets

Always paginate lists to avoid fetching too much data:

```typescript
graphorm.queryPaginated(
  ctx,
  info,
  hasPreviousPage,
  hasNextPage,
  nodeToCursor,
  beforeQuery
);
```

## Common Patterns

### Conditional Field Visibility

Show fields only to specific users:

```typescript
fields: {
  email: {
    transform: nullIfNotSameUser // Only show to the user themselves
  }
}
```

### Date Transformations

Consistently transform dates:

```typescript
fields: {
  createdAt: {
    transform: transformDate
  }
}
```

### Nested JSON Queries

Query nested JSON structures:

```typescript
requiredColumns: [
  {
    column: `"contentMeta"->'alt_title'->'translations'`,
    columnAs: 'smartTitle',
    isJson: true
  }
]
```

## Performance Considerations

1. **Indexes**: Ensure foreign keys and frequently filtered columns are indexed
2. **JSON Aggregation**: Large nested arrays can be expensive - consider pagination
3. **Read Replicas**: Use read replicas for all read queries when available
4. **Required Columns**: Only add truly required columns to avoid unnecessary data fetching
5. **Transform Functions**: Keep transforms lightweight - avoid database calls in transforms

## Related Files

- **Core Implementation**: `src/graphorm/graphorm.ts`
- **Configuration**: `src/graphorm/index.ts`
- **Usage Examples**: 
  - `src/schema/posts.ts`
  - `src/schema/users.ts`
  - `src/schema/sources.ts`
  - `src/common/feedGenerator.ts`

## Further Reading

- [TypeORM Query Builder Documentation](https://typeorm.io/select-query-builder)
- [PostgreSQL JSON Functions](https://www.postgresql.org/docs/current/functions-json.html)
- [GraphQL Resolve Info](https://graphql.org/graphql-js/type/#graphqlobjecttype)

