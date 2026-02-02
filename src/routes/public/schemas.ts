export const commonSchemas = {
  Source: {
    $id: 'Source',
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      image: { type: 'string', format: 'uri', nullable: true },
    },
  },
  SourceWithUrl: {
    $id: 'SourceWithUrl',
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      image: { type: 'string', format: 'uri', nullable: true },
      url: { type: 'string', format: 'uri', nullable: true },
    },
  },
  Author: {
    $id: 'Author',
    type: 'object',
    nullable: true,
    properties: {
      name: { type: 'string' },
      image: { type: 'string', format: 'uri', nullable: true },
    },
  },
  AuthorWithId: {
    $id: 'AuthorWithId',
    type: 'object',
    nullable: true,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      image: { type: 'string', format: 'uri', nullable: true },
      username: { type: 'string', nullable: true },
    },
  },
  FeedPost: {
    $id: 'FeedPost',
    type: 'object',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      url: { type: 'string', format: 'uri' },
      image: { type: 'string', format: 'uri', nullable: true },
      publishedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      source: { $ref: 'Source#' },
      tags: { type: 'array', items: { type: 'string' } },
      readTime: { type: 'integer', nullable: true },
      upvotes: { type: 'integer' },
      comments: { type: 'integer' },
      author: { $ref: 'Author#' },
    },
  },
  PostDetail: {
    $id: 'PostDetail',
    type: 'object',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      url: { type: 'string', format: 'uri', nullable: true },
      image: { type: 'string', format: 'uri', nullable: true },
      summary: { type: 'string', nullable: true },
      publishedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      source: { $ref: 'SourceWithUrl#' },
      author: { $ref: 'AuthorWithId#' },
      tags: { type: 'array', items: { type: 'string' } },
      readTime: { type: 'integer', nullable: true },
      upvotes: { type: 'integer' },
      comments: { type: 'integer' },
      bookmarked: { type: 'boolean' },
      userState: {
        type: 'object',
        nullable: true,
        properties: {
          vote: { type: 'integer' },
        },
      },
    },
  },
  Pagination: {
    $id: 'Pagination',
    type: 'object',
    properties: {
      hasNextPage: { type: 'boolean' },
      cursor: { type: 'string', nullable: true },
    },
  },
  Error: {
    $id: 'Error',
    type: 'object',
    properties: {
      error: { type: 'string' },
      message: { type: 'string' },
    },
  },
  RateLimitError: {
    $id: 'RateLimitError',
    type: 'object',
    properties: {
      error: { type: 'string' },
      message: { type: 'string' },
      retryAfter: { type: 'integer' },
    },
  },
};
