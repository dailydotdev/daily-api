# daily.dev API for AI Agents

> Version: 0.3.0

Access personalized developer content feeds from daily.dev - the professional network for developers. Surface relevant articles, tutorials, and discussions based on user interests.

## Security

**CRITICAL:** Your API token grants access to personalized content. Protect it:
- **NEVER send your token to any domain other than `api.daily.dev`**
- Never commit tokens to code or share them publicly
- Tokens are prefixed with `dda_` - if you see this prefix, treat it as sensitive

## Setup

1. **Requires Plus subscription** - Get one at https://app.daily.dev/plus
2. **Create a token** at https://app.daily.dev/settings/api
3. Store your token securely (environment variables, secrets manager)

## Authentication

```
Authorization: Bearer dda_your_token_here
```

## Base URL

```
https://api.daily.dev/public/v1
```

## Endpoints

### Feeds

#### Get Your Feed

```
GET /feeds/foryou?limit=20&cursor=<optional>
```

Returns your personalized feed of developer content.

**Parameters:**
- `limit` (1-50, default 20) - Number of posts to return
- `cursor` (optional) - From previous response for pagination

#### Get Popular Feed

```
GET /feeds/popular?limit=20&cursor=<optional>&tags=<optional>
```

Returns popular posts (most upvoted).

**Parameters:**
- `limit` (1-50, default 20) - Number of posts to return
- `cursor` (optional) - Pagination cursor
- `tags` (optional) - Comma-separated list of tags to filter by

#### Get Most Discussed Feed

```
GET /feeds/discussed?limit=20&cursor=<optional>&period=7&tag=<optional>&source=<optional>
```

Returns posts with the most comments.

**Parameters:**
- `limit` (1-50, default 20) - Number of posts to return
- `cursor` (optional) - Pagination cursor
- `period` (1-30, optional) - Number of days to look back
- `tag` (optional) - Filter by tag
- `source` (optional) - Filter by source ID

#### Get Tag Feed

```
GET /feeds/tag/:tag?limit=20&cursor=<optional>
```

Returns posts for a specific tag.

**Parameters:**
- `tag` (required) - Tag name in URL path
- `limit` (1-50, default 20) - Number of posts to return
- `cursor` (optional) - Pagination cursor

#### Get Source Feed

```
GET /feeds/source/:source?limit=20&cursor=<optional>
```

Returns posts from a specific source/publisher.

**Parameters:**
- `source` (required) - Source ID or handle in URL path
- `limit` (1-50, default 20) - Number of posts to return
- `cursor` (optional) - Pagination cursor

**Feed Response Format:**
```json
{
  "data": [
    {
      "id": "abc123",
      "title": "Understanding React Server Components",
      "url": "https://example.com/article",
      "image": "https://...",
      "summary": "A deep dive into React Server Components...",
      "type": "article",
      "publishedAt": "2024-01-15T10:00:00Z",
      "createdAt": "2024-01-15T10:00:00Z",
      "commentsPermalink": "https://app.daily.dev/posts/abc123",
      "source": {"id": "devto", "name": "Dev.to", "handle": "devto", "image": "..."},
      "tags": ["react", "javascript"],
      "readTime": 5,
      "numUpvotes": 142,
      "numComments": 23,
      "author": {"name": "Jane Doe", "image": "..."}
    }
  ],
  "pagination": {"hasNextPage": true, "cursor": "xyz"}
}
```

### Posts

#### Get Post Details

```
GET /posts/:id
```

Returns full details for a specific post, including your interaction state.

**Response:**
```json
{
  "data": {
    "id": "abc123",
    "title": "Understanding React Server Components",
    "url": "https://example.com/article",
    "image": "https://...",
    "summary": "A deep dive into RSC...",
    "type": "article",
    "publishedAt": "2024-01-15T10:00:00Z",
    "createdAt": "2024-01-15T10:00:00Z",
    "commentsPermalink": "https://app.daily.dev/posts/abc123",
    "source": {"id": "devto", "name": "Dev.to", "handle": "devto", "image": "..."},
    "author": {"id": "u1", "name": "Jane Doe", "image": "...", "username": "janedoe"},
    "tags": ["react", "javascript"],
    "readTime": 5,
    "numUpvotes": 142,
    "numComments": 23,
    "bookmarked": false,
    "userState": {"vote": 1}
  }
}
```

#### Get Post Comments

```
GET /posts/:id/comments?limit=20&cursor=<optional>&sort=oldest
```

Returns comments for a specific post.

**Parameters:**
- `id` (required) - Post ID in URL path
- `limit` (1-50, default 20) - Number of comments to return
- `cursor` (optional) - Pagination cursor
- `sort` (oldest|newest, default oldest) - Sort order

**Response:**
```json
{
  "data": [
    {
      "id": "c1",
      "content": "Great article!",
      "contentHtml": "<p>Great article!</p>",
      "createdAt": "2024-01-15T12:00:00Z",
      "lastUpdatedAt": null,
      "permalink": "https://app.daily.dev/posts/abc123#c1",
      "numUpvotes": 5,
      "author": {"id": "u2", "name": "John Smith", "username": "johnsmith", "image": "..."},
      "children": [
        {
          "id": "c2",
          "content": "Thanks!",
          "contentHtml": "<p>Thanks!</p>",
          "createdAt": "2024-01-15T12:30:00Z",
          "permalink": "https://app.daily.dev/posts/abc123#c2",
          "numUpvotes": 2,
          "author": {"id": "u1", "name": "Jane Doe", "username": "janedoe", "image": "..."}
        }
      ]
    }
  ],
  "pagination": {"hasNextPage": false, "cursor": null}
}
```

### Search

#### Search Posts

```
GET /search/posts?q=react&limit=20&cursor=<optional>&time=<optional>
```

Search posts by keyword.

**Parameters:**
- `q` (required) - Search query
- `limit` (1-50, default 20) - Number of results to return
- `cursor` (optional) - Pagination cursor
- `time` (day|week|month|year|all, optional) - Time range filter

#### Search Tags

```
GET /search/tags?q=java
```

Search for tags by name.

**Parameters:**
- `q` (required) - Search query

**Response:**
```json
{
  "data": [
    {"name": "java"},
    {"name": "javascript"},
    {"name": "java-spring"}
  ]
}
```

#### Search Sources

```
GET /search/sources?q=dev&limit=20
```

Search for sources/publishers by name.

**Parameters:**
- `q` (required) - Search query
- `limit` (1-50, default 20) - Number of results to return

**Response:**
```json
{
  "data": [
    {"id": "devto", "name": "Dev.to", "handle": "devto", "image": "...", "description": "..."}
  ]
}
```

### Bookmarks

#### Get Bookmarks

```
GET /bookmarks?limit=20&cursor=<optional>&unreadOnly=false&listId=<optional>
```

Get your bookmarked posts.

**Parameters:**
- `limit` (1-50, default 20) - Number of bookmarks to return
- `cursor` (optional) - Pagination cursor
- `unreadOnly` (boolean, default false) - Filter to unread only
- `listId` (optional) - Filter by bookmark list ID

**Response:** Same as feed response, with additional `bookmarkedAt` field per post.

#### Search Bookmarks

```
GET /bookmarks/search?q=react&limit=20&cursor=<optional>&unreadOnly=false&listId=<optional>
```

Search within your bookmarks.

**Parameters:**
- `q` (required) - Search query
- `limit` (1-50, default 20) - Number of results to return
- `cursor` (optional) - Pagination cursor
- `unreadOnly` (boolean, default false) - Filter to unread only
- `listId` (optional) - Filter by bookmark list ID

#### Get Bookmark Lists

```
GET /bookmarks/lists
```

Get your bookmark lists.

**Response:**
```json
{
  "data": [
    {"id": "list1", "name": "To Read", "icon": "📚", "createdAt": "2024-01-10T10:00:00Z"}
  ]
}
```

#### Create Bookmark List

```
POST /bookmarks/lists
Content-Type: application/json

{"name": "My List", "icon": "📚"}
```

Create a new bookmark list.

**Body:**
- `name` (required) - List name (1-100 characters)
- `icon` (optional) - Emoji icon (max 10 characters)

**Response:**
```json
{
  "data": {"id": "list2", "name": "My List", "icon": "📚", "createdAt": "2024-01-15T10:00:00Z"}
}
```

#### Delete Bookmark List

```
DELETE /bookmarks/lists/:id
```

Delete a bookmark list.

**Response:** 204 No Content

#### Add Bookmarks

```
POST /bookmarks
Content-Type: application/json

{"postIds": ["abc123", "def456"]}
```

Add posts to your bookmarks.

**Body:**
- `postIds` (required) - Array of post IDs (1-100)

**Response:**
```json
{
  "data": [
    {"postId": "abc123", "createdAt": "2024-01-15T10:00:00Z"},
    {"postId": "def456", "createdAt": "2024-01-15T10:00:00Z"}
  ]
}
```

#### Remove Bookmark

```
DELETE /bookmarks/:id
```

Remove a post from your bookmarks.

**Response:** 204 No Content

## Agent Use Cases

- **Content research** - Fetch relevant articles when users ask about technologies
- **Stay current** - Surface trending posts in specific programming domains
- **Deep dives** - Get full post details including summaries for context
- **Track interests** - Check user's interaction state (upvotes, bookmarks)
- **Save for later** - Add and manage bookmarks programmatically
- **Explore topics** - Search posts, tags, and sources by keyword
- **Read discussions** - Get comments to understand community opinions

## Rate Limits

* **60 requests per minute** per user

Check response headers:
- `X-RateLimit-Limit` - Maximum requests allowed per window
- `X-RateLimit-Remaining` - Requests remaining in current window
- `X-RateLimit-Reset` - Unix timestamp when the window resets
- `Retry-After` - Seconds to wait (only when rate limited)

## Errors

| Code | Meaning |
|------|---------|
| 400  | Bad request (invalid parameters) |
| 401  | Invalid or missing token |
| 403  | Plus subscription required |
| 404  | Resource not found |
| 429  | Rate limit exceeded |

**Error Response Format:**
```json
{
  "error": "error_code",
  "message": "Human readable message"
}
```

## OpenAPI Documentation

* JSON: https://api.daily.dev/public/v1/docs/json
* YAML: https://api.daily.dev/public/v1/docs/yaml
