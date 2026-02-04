/**
 * Shared constants and utilities for the public API routes.
 */

export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 20;

// ============================================================================
// Shared GraphQL Field Strings
// ============================================================================
// These are reusable field strings for GraphQL queries. Use them to maintain
// consistency across all feed/post endpoints and avoid duplication.

/**
 * Standard post fields used in all feed endpoints.
 * Do NOT duplicate these fields - import and use this constant.
 */
export const POST_NODE_FIELDS = `
  id
  title
  url
  image
  summary
  type
  publishedAt
  createdAt
  commentsPermalink
  source {
    id
    name
    handle
    image
  }
  tags
  readTime
  numUpvotes
  numComments
  author {
    name
    image
  }
`;

/**
 * Additional field for bookmarked posts.
 * Use with POST_NODE_FIELDS for bookmark endpoints.
 */
export const BOOKMARKED_POST_EXTRA_FIELDS = `
  bookmarkedAt
`;

/**
 * Standard pageInfo fields for paginated responses.
 */
export const PAGE_INFO_FIELDS = `
  pageInfo {
    hasNextPage
    endCursor
  }
`;

// ============================================================================
// Shared TypeScript Types
// ============================================================================
// These types correspond to the GraphQL field strings above.

/**
 * Source/publisher info embedded in posts.
 */
export interface SourceInfo {
  id: string;
  name: string;
  handle: string;
  image: string | null;
}

/**
 * Author info embedded in posts.
 */
export interface AuthorInfo {
  name: string;
  image: string | null;
}

/**
 * Standard post node returned by feed queries.
 * Corresponds to POST_NODE_FIELDS.
 */
export interface PostNode {
  id: string;
  title: string;
  url: string;
  image: string | null;
  summary: string | null;
  type: string;
  publishedAt: string | null;
  createdAt: string;
  commentsPermalink: string;
  source: SourceInfo;
  tags: string[];
  readTime: number | null;
  numUpvotes: number;
  numComments: number;
  author: AuthorInfo | null;
}

/**
 * Post node with bookmark timestamp.
 * Corresponds to POST_NODE_FIELDS + BOOKMARKED_POST_EXTRA_FIELDS.
 */
export interface BookmarkedPostNode extends PostNode {
  bookmarkedAt: string;
}

/**
 * Pagination info from GraphQL connection.
 */
export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

/**
 * Generic feed connection response type.
 * Use with specific node types: FeedConnection<PostNode>, FeedConnection<BookmarkedPostNode>
 */
export interface FeedConnection<T> {
  edges: { node: T }[];
  pageInfo: PageInfo;
}

/**
 * Parse and validate a limit query parameter.
 * @param limitParam - The limit query string parameter
 * @returns A valid limit between 1 and MAX_LIMIT
 */
export const parseLimit = (limitParam?: string): number => {
  const parsed = parseInt(limitParam || '', 10) || DEFAULT_LIMIT;
  return Math.min(Math.max(1, parsed), MAX_LIMIT);
};

/**
 * Ensure the database connection is initialized.
 * @param con - The database connection from fastify
 * @throws Error if connection is not initialized
 */
export const ensureDbConnection = <T>(con: T | undefined): T => {
  if (!con) {
    throw new Error('Database connection not initialized');
  }
  return con;
};
