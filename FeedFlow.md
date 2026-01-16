# Feed Flow Documentation

This document explains how feed requests flow through the Daily API, from GraphQL query to personalized, ranked results.

## Table of Contents
- [Overview](#overview)
- [Feed Data Model](#feed-data-model)
- [Feed Types](#feed-types)
- [Request Flow Architecture](#request-flow-architecture)
- [Personalization System](#personalization-system)
- [Ranking & Scoring](#ranking--scoring)
- [Pagination](#pagination)
- [Complete Example](#complete-example-personalized-feed-request)
- [Key Files](#key-files)

---

## Overview

The feed system is the core of the Daily API, delivering personalized content to users. It combines:

- **Multiple feed types** (personal, custom, source, tag, etc.)
- **Dual-path architecture** (V1 local SQL vs V2+ external feed service)
- **Rich personalization** (followed tags/sources, blocked content, user preferences)
- **ML-powered ranking** (via Lofn service and external feed service)
- **Efficient pagination** (cursor-based with score/time ranking)

### Key Concepts

**Feed Entity:** Each user has a main feed (id = userId) and can create custom feeds with different preferences.

**Content Preferences:** Unified system for following/blocking sources, tags, users, and words.

**Feed Versions:**
- **V1 (version < 2 or TIME ranking):** Local database queries with TypeORM
- **V2+ (version >= 2 and POPULARITY ranking):** External feed service provides ranked post IDs

**Ranking Types:**
- **TIME:** Sort by `createdAt DESC` (newest first)
- **POPULARITY:** Sort by `score DESC` (ML-computed engagement score)

---

## Feed Data Model

### Feed Entity (`src/entity/Feed.ts`)

```typescript
@Entity()
export class Feed {
  @PrimaryColumn({ type: 'text' })
  id: string;  // Main feed: id = userId, Custom feed: generated ID

  @Column({ type: 'text' })
  @Index()
  userId: string;  // Owner of the feed

  @Column({ default: () => 'now()', update: false })
  createdAt: Date;

  @Column({ type: 'jsonb', default: {} })
  flags: FeedFlags = {};  // Feed configuration

  // Computed column: 'main' if id = userId, else 'custom'
  @Column({ generatedType: 'STORED' })
  type: FeedType;  // 'main' | 'custom'
}
```

### Feed Flags (Configuration)

```typescript
export type FeedFlags = Partial<{
  name: string;                      // Display name
  orderBy: FeedOrderBy;             // 'date' | 'upvotes' | 'downvotes' | 'comments' | 'clicks'
  minDayRange: number;              // Only posts from last N days
  minUpvotes: number;               // Minimum upvotes required
  minViews: number;                 // Minimum views required
  disableEngagementFilter: boolean; // Bypass engagement thresholds
  icon: string;                     // Emoji icon
}>;
```

### Content Preference System

The unified preference system (`src/entity/contentPreference/`) allows per-feed customization:

```typescript
// Base preference table
@Entity()
export class ContentPreference {
  @PrimaryColumn({ type: 'text' })
  feedId: string;  // Which feed (allows per-feed preferences)

  @PrimaryColumn({ type: 'text' })
  userId: string;  // Who set the preference

  @PrimaryColumn({ type: 'text' })
  referenceId: string;  // source-id, tag-name, user-id, or word

  @Column({ type: 'text' })
  type: ContentPreferenceType;  // 'source' | 'keyword' | 'user' | 'word'

  @Column({ type: 'text' })
  status: ContentPreferenceStatus;  // 'follow' | 'blocked' | 'subscribed'

  @Column({ default: () => 'now()' })
  createdAt: Date;
}
```

**Specific Preference Types:**

1. **ContentPreferenceSource** - Follow/block sources
   - Maps to: `referenceId` = source ID, `type` = 'source'
   - Status: 'follow' (include) or 'blocked' (exclude)

2. **ContentPreferenceKeyword** - Follow/block tags
   - Maps to: `referenceId` = tag name, `type` = 'keyword'
   - Status: 'follow' (include) or 'blocked' (exclude)

3. **ContentPreferenceUser** - Follow/block users
   - Maps to: `referenceId` = user ID, `type` = 'user'
   - Status: 'follow' (include) or 'blocked' (exclude)

4. **ContentPreferenceWord** - Block words in titles
   - Maps to: `referenceId` = word, `type` = 'word'
   - Status: always 'blocked'

### Advanced Settings

```typescript
@Entity()
export class FeedAdvancedSettings {
  @Column({ type: 'text' })
  feedId: string;

  @Column({ type: 'text' })
  advancedSettingsId: string;  // Links to AdvancedSettings (content types)

  @Column({ default: true })
  enabled: boolean;  // Whether this content type is enabled
}
```

**Content Types (AdvancedSettings):**
- News articles
- Opinion pieces
- Tutorials
- Product launches
- Collection posts
- Case studies
- Comparisons

---

## Feed Types

### Available GraphQL Queries

| Query | Auth Required | Description | Key Features |
|-------|---------------|-------------|--------------|
| `feed` | Yes | User's personalized main feed | ML-powered, unreadOnly option |
| `anonymousFeed` | No | Ad-hoc feed with inline filters | Accepts FiltersInput |
| `customFeed` | Yes | User's custom feed | Premium feature, custom config |
| `followingFeed` | Yes | Content from follows | Sources + users, ML-personalized |
| `sourceFeed` | No | Single source posts | Supports pinned posts |
| `tagFeed` | No | Posts with specific tag | Public feed |
| `keywordFeed` | No | Full-text search in titles/content | Public feed |
| `mostUpvotedFeed` | No | Trending posts | Period: 7/30/365 days |
| `mostDiscussedFeed` | No | Most commented posts | Period-based |
| `userUpvotedFeed` | No | User's upvoted posts | Ordered by votedAt |
| `similarPostsFeed` | No | Similar to specific post | ML-based ranking |
| `authorFeed` | No | Author's posts | Includes scouts |

### Query Parameters

**Common Parameters:**
- `first: Int` - Number of posts to fetch (pagination)
- `after: String` - Cursor for next page
- `ranking: Ranking` - `TIME` or `POPULARITY`
- `version: Int` - Feed version (affects routing to V1 vs V2+)

**Feed-Specific Parameters:**
- `unreadOnly: Boolean` - Filter to only unread posts (feed query)
- `filters: FiltersInput` - Inline filters (anonymousFeed)
- `period: Int` - Time period in days (mostUpvotedFeed, mostDiscussedFeed)
- `post: String` - Post ID for similarity (similarPostsFeed)

---

## Request Flow Architecture

### High-Level Flow Diagram

```
GraphQL Query
    ↓
Resolver (src/schema/feeds.ts:1435+)
    ↓
Version & Ranking Check
    ├─ V1 Path (version < 2 OR ranking = TIME)
    │   ↓
    │   feedResolverV1
    │   ↓
    │   feedToFilters (get user preferences)
    │   ↓
    │   Feed Builder Selection
    │   ├─ anonymousFeedBuilder (custom/anonymous)
    │   ├─ configuredFeedBuilder (main feed)
    │   ├─ sourceFeedBuilder (source feed)
    │   ├─ tagFeedBuilder (tag feed)
    │   └─ fixedIdsFeedBuilder (when IDs provided)
    │   ↓
    │   Build SQL Query
    │   ↓
    │   Apply Universal Filters (applyFeedWhere)
    │   ↓
    │   Execute Query & Paginate (feedPageGenerator)
    │   ↓
    │   GraphORM Resolution
    │
    └─ V2+ Path (version >= 2 AND ranking = POPULARITY)
        ↓
        feedResolverCursor
        ↓
        FeedConfigGenerator Selection
        ├─ FeedLofnConfigGenerator (ML-powered)
        ├─ FeedPreferencesConfigGenerator (DB preferences)
        └─ SimpleFeedConfigGenerator (static config)
        ↓
        Generate FeedConfig
        ↓
        Call External Feed Service (FeedClient.fetchFeed)
        ↓
        Receive Ranked Post IDs + Cursor
        ↓
        fixedIdsFeedBuilder (fetch by IDs)
        ↓
        Apply Universal Filters (applyFeedWhere)
        ↓
        GraphORM Resolution
        ↓
        Attach Cursor (feedCursorPageGenerator)
```

### V1 Path (Local Database Queries)

**When Used:**
- `version < 2`
- `ranking = TIME`
- Feed types without ML support

**Process:**

#### 1. Preference Lookup (`src/common/feed.ts:feedToFilters`)

```typescript
// src/common/feedGenerator.ts:109-167
const getRawFiltersData = async (
  con: DataSource,
  feedId: string,
  userId: string,
): Promise<RawFiltersData> => {
  // Parallel queries for all preference types
  const result = await con.query(`
    SELECT
      (SELECT jsonb_agg(res) FROM (
        SELECT id, "defaultEnabledState", "group", options
        FROM advanced_settings
      ) res) as settings,

      (SELECT jsonb_agg(res) FROM (
        SELECT "advancedSettingsId", enabled
        FROM feed_advanced_settings
        WHERE "feedId" = $1
      ) res) as "feedAdvancedSettings",

      (SELECT jsonb_agg(res) FROM (
        SELECT "keywordId", status
        FROM content_preference
        WHERE "feedId" = $1 AND "userId" = $2 AND type = 'keyword'
      ) res) as tags,

      (SELECT jsonb_agg(res) FROM (
        SELECT "sourceId", status
        FROM content_preference
        WHERE "feedId" = $1 AND "userId" = $2 AND type = 'source'
      ) res) as sources,

      (SELECT jsonb_agg(res) FROM (
        SELECT "referenceId", status
        FROM content_preference
        WHERE "feedId" = $1 AND "userId" = $2 AND type = 'user'
      ) res) as users,

      (SELECT jsonb_agg(res) FROM (
        SELECT "referenceId"
        FROM content_preference
        WHERE "feedId" = $1 AND "userId" = $2 AND type = 'word'
      ) res) as words
  `, [feedId, userId]);

  return result[0];
};
```

#### 2. Convert to Filter Object

```typescript
export const feedToFilters = async (
  con: DataSource,
  feedId: string,
  userId: string,
): Promise<AnonymousFeedFilters> => {
  const data = await getRawFiltersData(con, feedId, userId);

  return {
    includeTags: data.tags?.filter(t => t.status === 'follow').map(t => t.keywordId) || [],
    blockedTags: data.tags?.filter(t => t.status === 'blocked').map(t => t.keywordId) || [],
    includeSources: data.sources?.filter(s => s.status === 'follow').map(s => s.sourceId) || [],
    excludeSources: data.sources?.filter(s => s.status === 'blocked').map(s => s.sourceId) || [],
    followingUsers: data.users?.filter(u => u.status === 'follow').map(u => u.referenceId) || [],
    excludeUsers: data.users?.filter(u => u.status === 'blocked').map(u => u.referenceId) || [],
    blockedWords: data.words?.map(w => w.referenceId) || [],
    excludeTypes: getDisabledContentTypes(data.settings, data.feedAdvancedSettings),
    flags: data.feeds?.[0]?.flags || {},
  };
};
```

#### 3. Build Query (`src/common/feedGenerator.ts:anonymousFeedBuilder`)

```typescript
export const anonymousFeedBuilder = (
  con: DataSource,
  filters: AnonymousFeedFilters,
  // ...other params
): SelectQueryBuilder<Post> => {
  const builder = con
    .getRepository(Post)
    .createQueryBuilder('post')
    .innerJoin('post.source', 'source');

  // Include specific sources
  if (filters.includeSources?.length > 0) {
    builder.andWhere('post.sourceId IN (:...includedSources)', {
      includedSources: filters.includeSources,
    });
  }

  // Exclude blocked sources
  if (filters.excludeSources?.length > 0) {
    builder.andWhere('post.sourceId NOT IN (:...excludedSources)', {
      excludedSources: filters.excludeSources,
    });
  }

  // Include specific tags (via post_keyword junction table)
  if (filters.includeTags?.length > 0) {
    builder.andWhere(
      whereTags(filters.includeTags, builder, 'post')
    );
  }

  // Exclude blocked tags
  if (filters.blockedTags?.length > 0) {
    builder.andWhere(
      whereNotTags(filters.blockedTags, builder, 'post')
    );
  }

  // Exclude blocked users
  if (filters.excludeUsers?.length > 0) {
    builder.andWhere('post.authorId NOT IN (:...excludedUsers)', {
      excludedUsers: filters.excludeUsers,
    });
  }

  // Block words in title
  if (filters.blockedWords?.length > 0) {
    filters.blockedWords.forEach((word, i) => {
      builder.andWhere(`post.title NOT ILIKE :word${i}`, {
        [`word${i}`]: `%${word}%`,
      });
    });
  }

  // Exclude content types (via metadata->>'type')
  if (filters.excludeTypes?.length > 0) {
    builder.andWhere(`post.metadata->>'type' NOT IN (:...excludeTypes)`, {
      excludeTypes: filters.excludeTypes,
    });
  }

  return builder;
};
```

**Helper Functions:**

```typescript
// Include posts with any of these tags
export const whereTags = (
  tags: string[],
  builder: SelectQueryBuilder<Post>,
  alias: string,
): string => {
  const query = builder
    .subQuery()
    .select('1')
    .from(PostKeyword, 'pk')
    .where(`pk.keyword IN (:...tags)`, { tags })
    .andWhere(`pk.postId = ${alias}.id`)
    .getQuery();
  return `EXISTS${query}`;
};

// Exclude posts with any of these tags
export const whereNotTags = (
  tags: string[],
  builder: SelectQueryBuilder<Post>,
  alias: string,
): string => {
  return `NOT ${whereTags(tags, builder, alias, 'blockedTags')}`;
};
```

#### 4. Apply Universal Filters (`src/common/feedGenerator.ts:applyFeedWhere`)

```typescript
export const applyFeedWhere = (
  ctx: Context,
  builder: SelectQueryBuilder<Post>,
  alias: string,
  postTypes: PostType[],
): SelectQueryBuilder<Post> => {
  // Only specific post types
  builder.andWhere(`${alias}.type IN (:...postTypes)`, { postTypes });

  // Skip private posts
  builder.andWhere(`${alias}.private = false`);

  // Skip banned posts
  builder.andWhere(`${alias}.banned = false`);

  // Only posts marked for feed
  builder.andWhere(`${alias}.showOnFeed = true`);

  // Exclude user-hidden posts
  if (ctx.userId) {
    builder.andWhere(`NOT EXISTS (
      SELECT 1 FROM user_post
      WHERE "userId" = :userId
      AND "postId" = ${alias}.id
      AND hidden = true
    )`, { userId: ctx.userId });
  }

  // Squad visibility checks
  builder.andWhere(
    new Brackets((qb) => {
      qb.where(`source.type NOT IN ('squad', 'user')`)
        .orWhere(`source.flags->>'publicThreshold' IS NOT NULL`);
    })
  );

  return builder;
};
```

#### 5. Pagination (`feedPageGenerator`)

```typescript
const feedPageGenerator = <T>(
  ctx: Context,
  builder: SelectQueryBuilder<T>,
  ranking: Ranking,
): PageGenerator<GQLPost, ConnectionArguments> => {
  return createDatePageGenerator({
    builder,
    limit: (args) => args.first || 30,
    // TIME ranking: use createdAt
    // POPULARITY ranking: use score
    key: ranking === Ranking.TIME ? 'createdAt' : 'score',
    ...
  });
};
```

**Cursor Format:**
- TIME: `base64("time:" + timestamp)`
- POPULARITY: `base64("score:" + score)`

**SQL Example (TIME ranking):**
```sql
SELECT post.*
FROM post
INNER JOIN source ON post.sourceId = source.id
WHERE post.sourceId IN ('source1', 'source2')
  AND EXISTS (
    SELECT 1 FROM post_keyword pk
    WHERE pk.keyword IN ('typescript', 'javascript')
    AND pk.postId = post.id
  )
  AND post.type = 'article'
  AND post.private = false
  AND post.banned = false
  AND post.showOnFeed = true
  AND post.createdAt < :cursor_timestamp
ORDER BY post.createdAt DESC
LIMIT 31  -- +1 to detect hasNextPage
```

### V2+ Path (External Feed Service)

**When Used:**
- `version >= 2`
- `ranking = POPULARITY`
- ML-powered personalization

**Process:**

#### 1. Config Generator Selection (`src/schema/feeds.ts:1441`)

```typescript
const generator = versionToFeedGenerator(args.version);
```

**Available Generators:**

1. **FeedLofnConfigGenerator** (`src/integrations/feed/configs.ts`)
   - Calls ML service (Lofn) for personalized config
   - Merges ML config with stored user preferences
   - Used for: personal feed, following feed

2. **FeedPreferencesConfigGenerator**
   - Uses only database preferences
   - No ML involvement
   - Used for: custom feeds with custom sorting

3. **SimpleFeedConfigGenerator**
   - Static configuration
   - Used for: post similarity, fixed feeds

#### 2. Generate FeedConfig (`FeedLofnConfigGenerator.generate`)

```typescript
// src/integrations/feed/configs.ts
export class FeedLofnConfigGenerator implements FeedConfigGenerator {
  async generate(
    ctx: Context,
    opts: DynamicConfig,
  ): Promise<FeedConfigGeneratorResult> {
    // [A] Fetch ML config from Lofn service
    const lofnResponse = await lofnClient.fetchConfig(ctx, {
      user_id: ctx.userId,
      feed_id: opts.feedId,
      feed_version: opts.feed_version,  // '2', '29', '30', 'f1'
      cursor: opts.cursor,
    });

    // [B] Fetch user preferences from database
    const preferences = await new FeedPreferencesConfigGenerator().generate(ctx, opts);

    // [C] Merge configs (preferences override ML suggestions)
    const config: FeedConfig = {
      ...baseFeedConfig,
      feed_config_name: FeedConfigName.PersonaliseV27,
      user_id: ctx.userId,
      page_size: opts.page_size,
      total_pages: 1,
      cursor: opts.cursor,

      // From Lofn ML service
      providers: lofnResponse.providers,
      config: lofnResponse.config,

      // From user preferences (overrides)
      allowed_tags: preferences.config.allowed_tags,
      blocked_tags: preferences.config.blocked_tags,
      allowed_sources: preferences.config.allowed_sources,
      blocked_sources: preferences.config.blocked_sources,
      followed_user_ids: preferences.config.followed_user_ids,
      blocked_author_ids: preferences.config.blocked_author_ids,
      blocked_title_words: preferences.config.blocked_title_words,
      allowed_content_curations: preferences.config.allowed_content_curations,

      // Feed flags
      order_by: opts.order_by,
      min_day_range: opts.min_day_range,
      min_thresholds: opts.min_thresholds,
      disable_engagement_filter: opts.disable_engagement_filter,
    };

    return {
      config,
      extraMetadata: lofnResponse.metadata,  // Multi-Armed Bandit data
    };
  }
}
```

#### 3. Call Feed Service (`FeedClient.fetchFeed`)

```typescript
// src/integrations/feed/clients.ts
export class FeedClient implements IFeedClient {
  async fetchFeed(
    ctx: Context,
    feedId: string,
    config: FeedConfig,
    extraMetadata?: GenericMetadata,
  ): Promise<FeedResponse> {
    // POST to external feed service
    const response = await fetch(process.env.INTERNAL_FEED, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': ctx.trackingId,
      },
      body: JSON.stringify({
        feed_config_name: config.feed_config_name,  // 'personalise_v27'
        page_size: config.page_size,
        user_id: config.user_id,
        cursor: config.cursor,

        // Filters
        allowed_tags: config.allowed_tags,
        blocked_tags: config.blocked_tags,
        allowed_sources: config.allowed_sources,
        blocked_sources: config.blocked_sources,
        followed_user_ids: config.followed_user_ids,
        blocked_author_ids: config.blocked_author_ids,
        blocked_title_words: config.blocked_title_words,
        allowed_content_curations: config.allowed_content_curations,

        // Thresholds
        min_day_range: config.min_day_range,
        min_thresholds: config.min_thresholds,
        disable_engagement_filter: config.disable_engagement_filter,

        // ML config
        providers: config.providers,
        config: config.config,
      }),
    });

    const data = await response.json();

    // Returns: { data: [['post-id-1', null], ['post-id-2', null], ...], cursor: 'xyz' }
    return {
      data: data.data,
      cursor: data.cursor,
    };
  }
}
```

**Feed Service Response:**
```json
{
  "data": [
    ["post-id-1", null],
    ["post-id-2", null],
    ["post-id-3", null],
    ...20 items
  ],
  "cursor": "encoded_next_page_token"
}
```

#### 4. Fetch Posts by IDs (`fixedIdsFeedBuilder`)

```typescript
// src/common/feedGenerator.ts
export const fixedIdsFeedBuilder = (
  con: DataSource,
  postIds: string[],
): SelectQueryBuilder<Post> => {
  const builder = con
    .getRepository(Post)
    .createQueryBuilder('post')
    .innerJoin('post.source', 'source')
    .where('post.id IN (:...postIds)', { postIds })
    // Preserve order from feed service
    .orderBy(`array_position(array[:...postIds], post.id)`, 'ASC')
    .setParameter('postIds', postIds);

  return builder;
};
```

**Generated SQL:**
```sql
SELECT post.*
FROM post
INNER JOIN source ON post.sourceId = source.id
WHERE post.id IN ('post-id-1', 'post-id-2', 'post-id-3', ...)
ORDER BY array_position(
  array['post-id-1', 'post-id-2', 'post-id-3', ...],
  post.id
) ASC
```

This preserves the ranking order from the feed service.

#### 5. Apply Universal Filters

Same as V1 path - apply `applyFeedWhere` for privacy, bans, etc.

#### 6. Attach Cursor (`feedCursorPageGenerator`)

```typescript
const feedCursorPageGenerator = <T>(
  feedResponse: FeedResponse,
  postIds: string[],
): CursorPage<T> => {
  return {
    edges: postIds.map((id, index) => ({
      node: posts[index],
      cursor: feedResponse.cursor,  // Same cursor for all items
    })),
    pageInfo: {
      hasNextPage: feedResponse.data.length >= pageSize,
      hasPreviousPage: !!feedResponse.cursor,
      startCursor: feedResponse.cursor,
      endCursor: feedResponse.cursor,
    },
  };
};
```

---

## Personalization System

### Preference Storage

Users can customize their feeds through the `ContentPreference` system:

**Database Schema:**
```sql
CREATE TABLE content_preference (
  "feedId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'source' | 'keyword' | 'user' | 'word'
  status TEXT NOT NULL,  -- 'follow' | 'blocked' | 'subscribed'
  "createdAt" TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY ("feedId", "userId", "referenceId", type)
);
```

**Per-Feed Customization:**
- Main feed (feedId = userId): Default preferences
- Custom feeds: Independent preference sets
- Allows different sources/tags per custom feed

### Preference Mutations

#### Adding Filters (`addFiltersToFeed`)

```graphql
mutation {
  addFiltersToFeed(
    feedId: "user-123"
    filters: {
      includeSources: ["source-1", "source-2"]
      includeTags: ["typescript", "javascript"]
      excludeSources: ["source-3"]
      blockedTags: ["python"]
    }
  ) {
    id
  }
}
```

**Implementation:**
```typescript
// src/schema/feeds.ts
addFiltersToFeed: async (source, { feedId, filters }, ctx: AuthContext) => {
  await ctx.con.transaction(async (manager) => {
    // Add followed sources
    for (const sourceId of filters.includeSources || []) {
      await manager.upsert(ContentPreferenceSource, {
        feedId,
        userId: ctx.userId,
        sourceId,
        status: ContentPreferenceStatus.Follow,
      }, ['feedId', 'userId', 'sourceId']);
    }

    // Add blocked sources
    for (const sourceId of filters.excludeSources || []) {
      await manager.upsert(ContentPreferenceSource, {
        feedId,
        userId: ctx.userId,
        sourceId,
        status: ContentPreferenceStatus.Blocked,
      }, ['feedId', 'userId', 'sourceId']);
    }

    // Add followed tags
    for (const tag of filters.includeTags || []) {
      await manager.upsert(ContentPreferenceKeyword, {
        feedId,
        userId: ctx.userId,
        keywordId: tag,
        status: ContentPreferenceStatus.Follow,
      }, ['feedId', 'userId', 'keywordId']);
    }

    // Add blocked tags
    for (const tag of filters.blockedTags || []) {
      await manager.upsert(ContentPreferenceKeyword, {
        feedId,
        userId: ctx.userId,
        keywordId: tag,
        status: ContentPreferenceStatus.Blocked,
      }, ['feedId', 'userId', 'keywordId']);
    }
  });

  return feed;
};
```

#### Removing Filters (`removeFiltersFromFeed`)

```graphql
mutation {
  removeFiltersFromFeed(
    feedId: "user-123"
    filters: {
      excludeSources: ["source-1"]
      blockedTags: ["python"]
    }
  ) {
    id
  }
}
```

**Implementation:**
```typescript
removeFiltersFromFeed: async (source, { feedId, filters }, ctx: AuthContext) => {
  await ctx.con.transaction(async (manager) => {
    // Remove sources
    if (filters.excludeSources?.length) {
      await manager.delete(ContentPreferenceSource, {
        feedId,
        userId: ctx.userId,
        sourceId: In(filters.excludeSources),
      });
    }

    // Remove tags
    if (filters.blockedTags?.length) {
      await manager.delete(ContentPreferenceKeyword, {
        feedId,
        userId: ctx.userId,
        keywordId: In(filters.blockedTags),
      });
    }
  });

  return feed;
};
```

### Advanced Settings (Content Types)

Users can disable specific content types:

```graphql
mutation {
  updateFeedAdvancedSettings(
    feedId: "user-123"
    settings: [
      { id: "news", enabled: true }
      { id: "tutorials", enabled: false }
      { id: "opinions", enabled: false }
    ]
  )
}
```

**Effect:** Posts with `metadata->>'type'` matching disabled types are excluded.

---

## Ranking & Scoring

### Score Calculation

Posts have a `score` field (indexed integer):

```typescript
@Entity()
export class Post {
  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_score')
  score: number;
}
```

**Score is computed externally** (likely by background workers on engagement events like upvotes, comments, views).

### Ranking Types

#### TIME Ranking

```sql
ORDER BY post.createdAt DESC
WHERE post.createdAt < :cursor_timestamp
LIMIT 31
```

**Use Cases:**
- Latest news
- Real-time updates
- Source/tag feeds

**Pagination:** Cursor = `base64("time:" + createdAt.getTime())`

#### POPULARITY Ranking

```sql
ORDER BY post.score DESC
WHERE post.score < :cursor_score
LIMIT 31
```

**Use Cases:**
- Main personalized feed
- Trending content
- Most upvoted/discussed feeds

**Pagination:** Cursor = `base64("score:" + score)`

### Feed Flags Thresholds

Applied in feed service configuration:

```typescript
{
  min_day_range: 7,          // Only posts from last 7 days
  min_thresholds: {
    upvotes: 10,             // Minimum 10 upvotes
    views: 100,              // Minimum 100 views
  },
  disable_engagement_filter: false,  // Enforce thresholds
}
```

**Custom Feed Example:**
```graphql
mutation {
  updateFeed(
    id: "custom-feed-id"
    name: "High Quality JS"
    flags: {
      orderBy: UPVOTES
      minDayRange: 30
      minUpvotes: 50
    }
  )
}
```

Results in feed showing only highly-upvoted JavaScript posts from last 30 days.

---

## Pagination

### Cursor Encoding

**V1 TIME ranking:**
```
cursor = base64("time:1700000000000")
```

**V1 POPULARITY ranking:**
```
cursor = base64("score:12345")
```

**V2+ (from feed service):**
```
cursor = "opaque_service_token_xyz"
```

### HasNextPage Detection

**V1:**
- Fetch `limit + 1` posts
- If we got exactly `limit + 1`, set `hasNextPage = true`
- Return only `limit` posts to client

**V2+:**
- Feed service returns `data.length`
- `hasNextPage = data.length >= limit`

### Pagination Example

**Request:**
```graphql
query {
  feed(first: 20, after: "dGltZToxNzAwMDAwMDAwMDAw") {
    edges {
      node { id title }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "feed": {
      "edges": [
        { "node": { "id": "post-1", "title": "..." }, "cursor": "dGltZToxNjk5OTk5OTk5OTk5" },
        { "node": { "id": "post-2", "title": "..." }, "cursor": "dGltZToxNjk5OTk5OTk4ODg4" },
        ...
      ],
      "pageInfo": {
        "hasNextPage": true,
        "endCursor": "dGltZToxNjk5OTk5OTAwMDAw"
      }
    }
  }
}
```

**Next Page Request:**
```graphql
query {
  feed(first: 20, after: "dGltZToxNjk5OTk5OTAwMDAw") {
    # ...
  }
}
```

---

## Complete Example: Personalized Feed Request

Let's trace a complete request through the system.

### Request

```graphql
query {
  feed(first: 20, ranking: POPULARITY, version: 2) {
    edges {
      node {
        id
        title
        source { id name }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

**User Context:**
- userId: "user-123"
- Followed tags: ["typescript", "javascript"]
- Blocked sources: ["source-xyz"]
- Main feed (feedId = userId)

### Execution Flow

#### Step 1: Resolver Selection (`src/schema/feeds.ts:1435`)

```typescript
feed: (source, args: ConfiguredFeedArgs, ctx: Context, info) => {
  if (args.version >= 2 && args.ranking === Ranking.POPULARITY) {
    return feedResolverCursor(source, {
      ...args,
      generator: versionToFeedGenerator(args.version),  // FeedLofnConfigGenerator
    }, ctx, info);
  }
  return feedResolverV1(source, args, ctx, info);
}
```

**Route:** V2+ path (version=2, ranking=POPULARITY)

#### Step 2: Config Generation

**A. Call ML Service (Lofn):**
```typescript
const lofnResponse = await lofnClient.fetchConfig(ctx, {
  user_id: "user-123",
  feed_id: "user-123",
  feed_version: '2',
  cursor: undefined,
});
```

**Lofn Response:**
```json
{
  "providers": {
    "personalized": {
      "page_size_fraction": 0.8,
      "content_factor": {
        "tag_rank": true,
        "source_rank": true
      }
    },
    "popular": {
      "page_size_fraction": 0.2
    }
  },
  "config": {
    "diversity_threshold": 0.7
  },
  "metadata": {
    "experiment_id": "exp-456",
    "variant": "treatment"
  }
}
```

**B. Fetch User Preferences:**
```sql
-- Get followed/blocked tags
SELECT "keywordId", status
FROM content_preference
WHERE "feedId" = 'user-123' AND "userId" = 'user-123' AND type = 'keyword';

-- Result:
-- keywordId='typescript', status='follow'
-- keywordId='javascript', status='follow'

-- Get followed/blocked sources
SELECT "sourceId", status
FROM content_preference
WHERE "feedId" = 'user-123' AND "userId" = 'user-123' AND type = 'source';

-- Result:
-- sourceId='source-xyz', status='blocked'
```

**C. Merge into FeedConfig:**
```json
{
  "feed_config_name": "personalise_v27",
  "user_id": "user-123",
  "page_size": 20,
  "total_pages": 1,
  "cursor": null,

  "allowed_tags": ["typescript", "javascript"],
  "blocked_tags": [],
  "allowed_sources": [],
  "blocked_sources": ["source-xyz"],
  "followed_user_ids": [],
  "blocked_author_ids": [],
  "blocked_title_words": [],

  "providers": {
    "personalized": { "page_size_fraction": 0.8, ... },
    "popular": { "page_size_fraction": 0.2 }
  },
  "config": {
    "diversity_threshold": 0.7
  },

  "source_types": ["machine", "squad", "user"],
  "allowed_languages": ["en"]
}
```

#### Step 3: Call Feed Service

```typescript
const response = await fetch('http://feed-service:5000', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(feedConfig),
});
```

**Feed Service Processing:**
1. Applies ML ranking using providers
2. Filters by allowed_tags, blocked_sources
3. Applies engagement thresholds
4. Returns ranked post IDs

**Feed Service Response:**
```json
{
  "data": [
    ["post-a1b2", null],
    ["post-c3d4", null],
    ["post-e5f6", null],
    ...20 items
  ],
  "cursor": "eyJwYWdlIjoyLCJvZmZzZXQiOjIwfQ"
}
```

#### Step 4: Fetch Posts by IDs

```typescript
const postIds = feedResponse.data.map(([id]) => id);
// ['post-a1b2', 'post-c3d4', 'post-e5f6', ...]

const builder = fixedIdsFeedBuilder(ctx.con, postIds);
```

**Generated SQL:**
```sql
SELECT
  post.id,
  post.title,
  post.sourceId,
  post.createdAt,
  post.score,
  post.type,
  post.private,
  post.banned,
  post.showOnFeed
FROM post
INNER JOIN source ON post.sourceId = source.id
WHERE post.id IN ('post-a1b2', 'post-c3d4', 'post-e5f6', ...)
  AND post.type = 'article'
  AND post.private = false
  AND post.banned = false
  AND post.showOnFeed = true
  AND NOT EXISTS (
    SELECT 1 FROM user_post
    WHERE "userId" = 'user-123' AND "postId" = post.id AND hidden = true
  )
ORDER BY array_position(
  array['post-a1b2', 'post-c3d4', 'post-e5f6', ...],
  post.id
) ASC;
```

**Query Result:** 20 posts in feed service order

#### Step 5: GraphORM Resolution

```typescript
const posts = await graphorm.query<GQLPost>(
  ctx,
  info,  // Contains requested fields: id, title, source.id, source.name
  (builder) => {
    builder.queryBuilder = feedBuilder;
    return builder;
  }
);
```

**GraphORM analyzes GraphQL query:**
- Requested: `post.id`, `post.title`, `source.id`, `source.name`
- Automatically joins `source` table
- Batch loads related data

**Optimized SQL:**
```sql
SELECT
  post.id,
  post.title,
  source.id AS source_id,
  source.name AS source_name
FROM post
INNER JOIN source ON post.sourceId = source.id
WHERE post.id IN (...)
ORDER BY array_position(...);
```

#### Step 6: Format Response

```typescript
const edges = posts.map((post) => ({
  node: {
    id: post.id,
    title: post.title,
    source: {
      id: post.source.id,
      name: post.source.name,
    },
  },
  cursor: feedResponse.cursor,
}));

const pageInfo = {
  hasNextPage: feedResponse.data.length >= 20,
  hasPreviousPage: false,
  startCursor: feedResponse.cursor,
  endCursor: feedResponse.cursor,
};
```

#### Step 7: GraphQL Response

```json
{
  "data": {
    "feed": {
      "edges": [
        {
          "node": {
            "id": "post-a1b2",
            "title": "Advanced TypeScript Patterns",
            "source": {
              "id": "source-123",
              "name": "TypeScript Weekly"
            }
          },
          "cursor": "eyJwYWdlIjoyLCJvZmZzZXQiOjIwfQ"
        },
        {
          "node": {
            "id": "post-c3d4",
            "title": "JavaScript Performance Tips",
            "source": {
              "id": "source-456",
              "name": "JS Daily"
            }
          },
          "cursor": "eyJwYWdlIjoyLCJvZmZzZXQiOjIwfQ"
        },
        ...18 more items
      ],
      "pageInfo": {
        "hasNextPage": true,
        "endCursor": "eyJwYWdlIjoyLCJvZmZzZXQiOjIwfQ"
      }
    }
  }
}
```

**Total Time:** ~100-300ms
- ML service call: ~50-100ms
- Feed service call: ~50-150ms
- Database query: ~10-30ms
- GraphORM resolution: ~10-20ms

---

## Filter Application Priority

Filters are applied in this order:

1. **Feed Flags** (minDayRange, minUpvotes, minViews)
   - Applied in feed service configuration
   - Enforced before ranking

2. **User Preferences** (followed/blocked tags/sources)
   - Merged into feed service config
   - Applied during feed generation

3. **Content Curation** (disabled content types)
   - Applied in feed service config
   - Filters by `metadata->>'type'`

4. **Post Type Filter** (article, share, freeform, etc.)
   - Applied in database via `applyFeedWhere`
   - WHERE `post.type IN (:...postTypes)`

5. **Privacy/Ban Filters** (private, banned, showOnFeed)
   - Applied in database via `applyFeedWhere`
   - Ensures only public, non-banned posts

6. **Squad Filters** (visibility rules)
   - Applied in database via `applyFeedWhere`
   - Checks `source.flags->>'publicThreshold'`

7. **User's Hidden Posts**
   - Applied in database via `applyFeedWhere`
   - Excludes posts from `user_post` where `hidden = true`

---

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/schema/feeds.ts` | GraphQL resolvers for all feed queries | 1900+ |
| `src/common/feedGenerator.ts` | Feed builders (anonymous, configured, source, tag, fixed) | 500+ |
| `src/common/feed.ts` | feedToFilters conversion, preference lookup | 400+ |
| `src/integrations/feed/generators.ts` | FeedGenerator class, versionToFeedGenerator | 200+ |
| `src/integrations/feed/configs.ts` | FeedConfigGenerator implementations (Lofn, Preferences, Simple) | 300+ |
| `src/integrations/feed/clients.ts` | FeedClient HTTP wrapper | 100+ |
| `src/integrations/feed/types.ts` | Type definitions (FeedConfig, FeedResponse, etc.) | 140 |
| `src/entity/Feed.ts` | Feed entity, FeedFlags, FeedOrderBy enum | 83 |
| `src/entity/contentPreference/*.ts` | Preference system (6 files) | 300+ |
| `src/entity/FeedSource.ts` | Legacy filter entity | 50 |
| `src/entity/FeedTag.ts` | Legacy filter entity | 50 |
| `src/entity/FeedAdvancedSettings.ts` | Content curation settings | 50 |

---

## Caching & Optimization

### Feed Service Caching

The external feed service caches responses internally based on:
- User ID
- Feed config hash
- Cursor position

**Cache TTL:** ~5-10 minutes (configurable)

### GraphORM DataLoader

Prevents N+1 queries when resolving nested fields:

```typescript
// Without GraphORM: N+1 query problem
Post: {
  source: async (post) => {
    return await db.getRepository(Source).findOneBy({ id: post.sourceId });
    // This runs once per post! (N+1)
  }
}

// With GraphORM: Single batch query
const posts = await graphorm.query<GQLPost>(ctx, info, builder);
// GraphORM analyzes info to see that 'source' is requested
// Automatically joins source table in single query
```

### Database Indexes

Key indexes for feed performance:

```sql
CREATE INDEX "IDX_post_score" ON post (score DESC);
CREATE INDEX "IDX_post_createdAt" ON post ("createdAt" DESC);
CREATE INDEX "IDX_post_sourceId" ON post ("sourceId");
CREATE INDEX "IDX_post_keyword_postId_keyword" ON post_keyword ("postId", keyword);
CREATE INDEX "IDX_content_preference_feedId_userId_type" ON content_preference ("feedId", "userId", type);
```

### Circuit Breaker (Garmr)

Handles feed service failures gracefully:

```typescript
try {
  const response = await feedClient.fetchFeed(ctx, feedId, config);
} catch (err) {
  if (err instanceof BrokenCircuitError) {
    // Fallback to V1 path or cached results
    ctx.log.warn('Feed service circuit broken, using fallback');
    return feedResolverV1(source, args, ctx, info);
  }
  throw err;
}
```

---

## Extension Points

### Adding a New Feed Type

1. **Define GraphQL resolver** in `src/schema/feeds.ts`:
```typescript
newFeedType: async (source, args, ctx, info) => {
  return feedResolverV1(source, {
    ...args,
    builder: customFeedBuilder(ctx.con, args.filters),
  }, ctx, info);
}
```

2. **Create feed builder** in `src/common/feedGenerator.ts`:
```typescript
export const customFeedBuilder = (
  con: DataSource,
  filters: CustomFilters,
): SelectQueryBuilder<Post> => {
  const builder = con.getRepository(Post).createQueryBuilder('post');
  // Apply custom filters
  return builder;
};
```

3. **Add to schema** in `src/schema/feeds.ts`:
```graphql
type Query {
  newFeedType(first: Int, after: String): PostConnection!
}
```

### Adding a New Filter

1. **Update AnonymousFeedFilters** in `src/common/feedGenerator.ts`:
```typescript
export type AnonymousFeedFilters = {
  // ... existing filters
  customFilter?: string[];
};
```

2. **Update feedToFilters** in `src/common/feed.ts`:
```typescript
export const feedToFilters = async (...) => {
  // Query new filter from database
  const customData = await con.query(`SELECT ...`);

  return {
    // ... existing filters
    customFilter: customData.map(d => d.value),
  };
};
```

3. **Apply in builder** in `src/common/feedGenerator.ts`:
```typescript
export const anonymousFeedBuilder = (...) => {
  // ... existing code

  if (filters.customFilter?.length > 0) {
    builder.andWhere('post.customField IN (:...customFilter)', {
      customFilter: filters.customFilter,
    });
  }

  return builder;
};
```

### Adding a New Ranking Algorithm

1. **Update FeedOrderBy enum** in `src/entity/Feed.ts`:
```typescript
export enum FeedOrderBy {
  Date = 'date',
  Upvotes = 'upvotes',
  CustomRanking = 'custom_ranking',  // New
}
```

2. **Update feed service config** to support new ranking

3. **Update pagination** to handle new cursor format

---

## Performance Characteristics

### V1 Path (Local Database)

**Pros:**
- ✅ No external service dependency
- ✅ Predictable latency (~50-100ms)
- ✅ Simple debugging and monitoring
- ✅ Works for TIME ranking

**Cons:**
- ❌ Limited ranking sophistication
- ❌ No ML personalization
- ❌ Higher database load for complex filters

**Best For:**
- Source feeds
- Tag feeds
- TIME-ranked feeds
- Simple queries

### V2+ Path (External Feed Service)

**Pros:**
- ✅ ML-powered personalization
- ✅ Sophisticated ranking algorithms
- ✅ Offloads computation from API
- ✅ Centralized feed logic
- ✅ A/B testing via Lofn

**Cons:**
- ❌ External service dependency
- ❌ Higher latency (~100-200ms)
- ❌ More complex debugging
- ❌ Requires cursor management

**Best For:**
- Main personalized feed
- Following feed
- POPULARITY-ranked feeds
- ML-optimized recommendations

---

## Summary

The Daily API feed system is a sophisticated, dual-path architecture that balances:

1. **Flexibility** - Multiple feed types, customizable filters, per-feed preferences
2. **Performance** - V1 for simple queries, V2+ for ML-powered ranking
3. **Personalization** - Rich preference system with follows, blocks, content types
4. **Scalability** - External feed service offloads ranking computation
5. **Reliability** - Circuit breakers, fallbacks, caching layers

**Key Takeaways:**
- V1 path: Local SQL queries, simple ranking, TIME mode
- V2+ path: External service, ML ranking, POPULARITY mode
- Preferences stored per-feed for maximum customization
- GraphORM prevents N+1 queries during resolution
- Universal filters ensure privacy, bans, and visibility rules

This architecture enables Daily to deliver highly personalized content feeds at scale while maintaining flexibility for various feed types and user preferences.