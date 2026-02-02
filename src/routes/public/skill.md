# daily.dev API for AI Agents

Connect to daily.dev to access personalized developer content feeds.

## Setup

1. **Requires Plus subscription** - Get one at https://daily.dev/plus
2. **Create a token** at https://app.daily.dev/settings/api
3. **Keep your token secret** - Never share it or commit it to code

## Authentication

```
Authorization: Bearer dda_your_token_here
```

## Base URL

```
https://api.daily.dev/public/v1
```

## Endpoints

### Get Your Feed

```
GET /feed?limit=20&cursor=<optional>
```

Returns your personalized feed of developer content.

**Parameters:**
- `limit` (1-50, default 20) - Number of posts to return
- `cursor` (optional) - From previous response for pagination

**Example Response:**
```json
{
  "data": [
    {
      "id": "abc123",
      "title": "Understanding React Server Components",
      "url": "https://example.com/article",
      "image": "https://...",
      "publishedAt": "2024-01-15T10:00:00Z",
      "createdAt": "2024-01-15T10:00:00Z",
      "source": {"id": "devto", "name": "Dev.to", "image": "..."},
      "tags": ["react", "javascript"],
      "readTime": 5,
      "upvotes": 142,
      "comments": 23,
      "author": {"name": "Jane Doe", "image": "..."}
    }
  ],
  "pagination": {"hasNextPage": true, "cursor": "xyz"}
}
```

### Get Post Details

```
GET /posts/:id
```

Returns full details for a specific post, including your interaction state.

**Example Response:**
```json
{
  "data": {
    "id": "abc123",
    "title": "Understanding React Server Components",
    "url": "https://example.com/article",
    "image": "https://...",
    "summary": "A deep dive into RSC...",
    "publishedAt": "2024-01-15T10:00:00Z",
    "createdAt": "2024-01-15T10:00:00Z",
    "source": {"id": "devto", "name": "Dev.to", "image": "...", "url": "https://app.daily.dev/sources/devto"},
    "author": {"id": "u1", "name": "Jane Doe", "image": "...", "username": "janedoe"},
    "tags": ["react", "javascript"],
    "readTime": 5,
    "upvotes": 142,
    "comments": 23,
    "bookmarked": false,
    "userState": {"vote": 1}
  }
}
```

## Rate Limits

* **60 requests per minute**
* **1,000 requests per day**

Check headers: `X-RateLimit-Remaining`, `X-RateLimit-Limit`

## Errors

| Code | Meaning |
|------|---------|
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

## Full Documentation

* Docs: https://docs.daily.dev/api
