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
 * @param maxLimit - The maximum limit allowed for this endpoint
 * @returns A valid limit between 1 and maxLimit
 */
export const parseLimit = (
  limitParam?: string,
  maxLimit: number = MAX_LIMIT,
): number => {
  const parsed = parseInt(limitParam || '', 10) || DEFAULT_LIMIT;
  return Math.min(Math.max(1, parsed), maxLimit);
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

// ============================================================================
// Custom Feed GraphQL Fields
// ============================================================================

/**
 * Custom feed fields for feed list and CRUD operations.
 */
export const CUSTOM_FEED_FIELDS = `
  id
  userId
  slug
  createdAt
  flags {
    name
    icon
    orderBy
    minDayRange
    minUpvotes
    minViews
    disableEngagementFilter
  }
`;

/**
 * Feed settings fields.
 */
export const FEED_SETTINGS_FIELDS = `
  id
  userId
  includeTags
  blockedTags
  includeSources {
    id
    name
    handle
    image
  }
  excludeSources {
    id
    name
    handle
    image
  }
  advancedSettings {
    id
    enabled
  }
`;

/**
 * Advanced settings fields for available settings list.
 */
export const ADVANCED_SETTINGS_FIELDS = `
  id
  title
  description
  defaultEnabledState
  group
`;

// ============================================================================
// Notification GraphQL Fields
// ============================================================================

/**
 * Notification avatar fields.
 */
export const NOTIFICATION_AVATAR_FIELDS = `
  referenceId
  type
  image
  name
  targetUrl
`;

/**
 * Notification attachment fields.
 */
export const NOTIFICATION_ATTACHMENT_FIELDS = `
  type
  image
  title
`;

/**
 * Notification fields for notification list.
 */
export const NOTIFICATION_FIELDS = `
  id
  createdAt
  readAt
  icon
  title
  type
  description
  referenceId
  targetUrl
  numTotalAvatars
  avatars {
    ${NOTIFICATION_AVATAR_FIELDS}
  }
  attachments {
    ${NOTIFICATION_ATTACHMENT_FIELDS}
  }
`;

// ============================================================================
// Profile GraphQL Fields
// ============================================================================

/**
 * Profile fields for user profile endpoints.
 */
export const PROFILE_FIELDS = `
  id
  name
  username
  bio
  readme
  readmeHtml
  image
  cover
  createdAt
  reputation
  permalink
  isPlus
  experienceLevel
  socialLinks {
    platform
    url
  }
`;

// ============================================================================
// User Stack GraphQL Fields
// ============================================================================

/**
 * Tool fields for stack and search.
 */
export const TOOL_FIELDS = `
  id
  title
  faviconUrl
`;

/**
 * User stack item fields.
 */
export const STACK_ITEM_FIELDS = `
  id
  section
  position
  startedAt
  icon
  title
  createdAt
  tool {
    ${TOOL_FIELDS}
  }
`;

// ============================================================================
// Custom Feed Types
// ============================================================================

/**
 * Custom feed flags.
 */
export interface CustomFeedFlags {
  name?: string | null;
  icon?: string | null;
  orderBy?: string | null;
  minDayRange?: number | null;
  minUpvotes?: number | null;
  minViews?: number | null;
  disableEngagementFilter?: boolean | null;
}

/**
 * Custom feed.
 */
export interface CustomFeed {
  id: string;
  userId?: string | null;
  slug?: string | null;
  createdAt?: string | null;
  flags?: CustomFeedFlags | null;
}

/**
 * Feed connection for custom feeds.
 */
export interface CustomFeedConnection {
  edges: { node: CustomFeed }[];
  pageInfo: PageInfo;
}

// ============================================================================
// Feed Settings Types
// ============================================================================

/**
 * Feed advanced settings.
 */
export interface FeedAdvancedSettings {
  id: number;
  enabled: boolean;
}

/**
 * Available advanced setting definition.
 */
export interface AdvancedSettingsType {
  id: number;
  title: string;
  description: string;
  defaultEnabledState: boolean;
  group: string;
}

/**
 * Feed settings.
 */
export interface FeedSettingsType {
  id?: string | null;
  userId?: string | null;
  includeTags?: string[] | null;
  blockedTags?: string[] | null;
  includeSources?: SourceInfo[] | null;
  excludeSources?: SourceInfo[] | null;
  advancedSettings?: FeedAdvancedSettings[] | null;
}

// ============================================================================
// Notification Types
// ============================================================================

/**
 * Notification avatar.
 */
export interface NotificationAvatar {
  referenceId: string;
  type: string;
  image?: string | null;
  name: string;
  targetUrl: string;
}

/**
 * Notification attachment.
 */
export interface NotificationAttachment {
  type: string;
  image?: string | null;
  title: string;
}

/**
 * Notification.
 */
export interface NotificationType {
  id: string;
  createdAt: string;
  readAt?: string | null;
  icon: string;
  title: string;
  type: string;
  description?: string | null;
  referenceId: string;
  targetUrl: string;
  numTotalAvatars?: number | null;
  avatars?: NotificationAvatar[] | null;
  attachments?: NotificationAttachment[] | null;
}

/**
 * Notification connection.
 */
export interface NotificationConnection {
  edges: { node: NotificationType }[];
  pageInfo: PageInfo;
}

// ============================================================================
// Profile Types
// ============================================================================

/**
 * Social link.
 */
export interface SocialLink {
  platform: string;
  url: string;
}

/**
 * User profile.
 */
export interface ProfileType {
  id: string;
  name?: string | null;
  username?: string | null;
  bio?: string | null;
  readme?: string | null;
  readmeHtml?: string | null;
  image?: string | null;
  cover?: string | null;
  createdAt: string;
  reputation: number;
  permalink: string;
  isPlus?: boolean | null;
  experienceLevel?: string | null;
  socialLinks: SocialLink[];
}

// ============================================================================
// User Stack Types
// ============================================================================

/**
 * Tool (DatasetTool).
 */
export interface ToolType {
  id: string;
  title: string;
  faviconUrl?: string | null;
}

/**
 * User stack item.
 */
export interface StackItemType {
  id: string;
  section: string;
  position: number;
  startedAt?: string | null;
  icon?: string | null;
  title?: string | null;
  createdAt: string;
  tool: ToolType;
}

/**
 * User stack connection.
 */
export interface StackConnection {
  edges: { node: StackItemType }[];
  pageInfo: PageInfo;
}

// ============================================================================
// User Experience GraphQL Fields
// ============================================================================

/**
 * User experience fields for experience list and CRUD operations.
 * Matches the USER_EXPERIENCE_FRAGMENT from apps repo.
 */
export const USER_EXPERIENCE_FIELDS = `
  id
  type
  title
  subtitle
  grade
  description
  createdAt
  startedAt
  endedAt
  customCompanyName
  customDomain
  image
  employmentType {
    value
  }
  locationType {
    value
  }
  verified
  url
  isOwner
  skills {
    value
  }
  company {
    id
    name
    image
  }
  customLocation {
    city
    subdivision
    country
  }
  repository {
    id
    owner
    name
    url
    image
  }
`;

// ============================================================================
// User Experience Types
// ============================================================================

/**
 * Company info embedded in experiences.
 */
export interface UserExperienceCompany {
  id: string;
  name: string;
  image?: string | null;
}

/**
 * Custom location info.
 */
export interface UserExperienceCustomLocation {
  city?: string | null;
  subdivision?: string | null;
  country?: string | null;
}

/**
 * Skill info.
 */
export interface UserExperienceSkill {
  value: string;
}

/**
 * Repository info for open source experiences.
 */
export interface UserExperienceRepository {
  id?: string | null;
  owner?: string | null;
  name: string;
  url: string;
  image?: string | null;
}

/**
 * Proto enum value wrapper.
 */
export interface ProtoEnumValue {
  value: string;
}

/**
 * User experience.
 */
export interface UserExperienceType {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  grade?: string | null;
  description?: string | null;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  customCompanyName?: string | null;
  customDomain?: string | null;
  image?: string | null;
  employmentType?: ProtoEnumValue | null;
  locationType?: ProtoEnumValue | null;
  verified?: boolean | null;
  url?: string | null;
  isOwner?: boolean | null;
  skills?: UserExperienceSkill[] | null;
  company?: UserExperienceCompany | null;
  customLocation?: UserExperienceCustomLocation | null;
  repository?: UserExperienceRepository | null;
}

/**
 * User experience connection.
 */
export interface UserExperienceConnection {
  edges: { node: UserExperienceType }[];
  pageInfo: PageInfo;
}
