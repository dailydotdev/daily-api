import {
  Connection as ConnectionRelay,
  ConnectionArguments,
  cursorToOffset,
  offsetToCursor,
} from 'graphql-relay';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import { DataSource, In, MoreThan, type QueryBuilder } from 'typeorm';
import {
  canModeratePosts,
  canPostToSquad,
  ensureSourcePermissions,
  ensureUserSourceExists,
  GQLSource,
  isPrivilegedMember,
  SourcePermissions,
  sourceTypesWithMembers,
} from './sources';
import { AuthContext, BaseContext, Context } from '../Context';
import { traceResolvers } from './trace';
import {
  createFreeformPost,
  CreateMultipleSourcePostProps,
  createPollPost,
  type CreatePollPostProps,
  CreatePostArgs,
  createSourcePostModeration,
  CreateSourcePostModerationArgs,
  DEFAULT_POST_TITLE,
  EditablePost,
  EditPostArgs,
  ensurePostAnalyticsPermissions,
  fetchLinkPreview,
  findPostByUrl,
  getAllModerationItemsAsAdmin,
  getDiscussionLink,
  getLimit,
  getModerationItemsAsAdminForSource,
  getModerationItemsByUserForSource,
  getPostSmartTitle,
  getPostTranslatedTitle,
  getTranslationRecord,
  type GQLSourcePostModeration,
  isValidHttpUrl,
  mapCloudinaryUrl,
  multipleSourcePostArgsSchema,
  notifyView,
  ONE_MINUTE_IN_SECONDS,
  parseBigInt,
  pickImageUrl,
  type SourcePostModerationArgs,
  standardizeURL,
  systemUser,
  toGQLEnum,
  updateFlagsStatement,
  uploadPostFile,
  UploadPreset,
  validatePost,
  validateSourcePostModeration,
} from '../common';
import {
  Campaign,
  CampaignPost,
  CampaignState,
  ContentImage,
  createExternalLink,
  createSharePost,
  deletePost,
  determineSharedPostId,
  ExternalLinkPreview,
  FreeformPost,
  Post,
  PostFlagsPublic,
  PostMention,
  PostQuestion,
  PostRelation,
  PostRelationType,
  type PostTranslation,
  PostType,
  preparePostForUpdate,
  Settings,
  SharePost,
  Source,
  SourceMember,
  SourceType,
  SquadSource,
  SubmitExternalLinkArgs,
  Toc,
  updateSharePost,
  User,
  UserActionType,
  UserPost,
  UserPostFlagsPublic,
  View,
  WelcomePost,
} from '../entity';
import { PollOption } from '../entity/polls/PollOption';
import { GQLEmptyResponse, offsetPageGenerator } from './common';
import {
  ConflictError,
  NotFoundError,
  SubmissionFailErrorMessage,
  TransferError,
  TypeOrmError,
  TypeORMQueryFailedError,
} from '../errors';
import { GQLBookmarkList } from './bookmarks';
import { getMentions } from './comments';
import { GQLUser } from './users';
import {
  getRedisObject,
  redisPubSub,
  setRedisObjectWithExpiry,
} from '../redis';
import {
  GQLDatePageGeneratorConfig,
  queryPaginatedByDate,
} from '../common/datePageGenerator';
import { GraphQLResolveInfo } from 'graphql';
import { Roles } from '../roles';
import { markdown, saveMentions } from '../common/markdown';
// @ts-expect-error - no types
import { FileUpload } from 'graphql-upload/GraphQLUpload';
import { insertOrIgnoreAction } from './actions';
import { generateShortId, generateUUID } from '../ids';
import { generateStorageKey, StorageTopic } from '../config';
import { isBefore, subDays } from 'date-fns';
import { ReportReason } from '../entity/common';
import { reportPost, saveHiddenPost } from '../common/reporting';
import { PostCodeSnippetLanguage, UserVote } from '../types';
import { PostCodeSnippet } from '../entity/posts/PostCodeSnippet';
import {
  SourcePostModeration,
  SourcePostModerationStatus,
} from '../entity/SourcePostModeration';
import { logger } from '../logger';
import { queryReadReplica } from '../common/queryReadReplica';
import { remoteConfig } from '../remoteConfig';
import { ensurePostRateLimit } from '../common/rateLimit';
import { whereNotUserBlocked } from '../common/contentPreference';
import type {
  BoostedPostConnection,
  CampaignForV1,
  GQLBoostedPost,
} from '../common/campaign/post';
import {
  checkPostAlreadyBoosted,
  getAdjustedReach,
  getFormattedBoostedPost,
  startCampaignPost,
  stopCampaignPost,
  validatePostBoostPermissions,
} from '../common/campaign/post';
import {
  type GetBalanceResult,
  throwUserTransactionError,
  type TransactionCreated,
  transferCores,
} from '../common/njord';
import { randomUUID } from 'crypto';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../entity/user/UserTransaction';
import { skadiApiClientV1 } from '../integrations/skadi/api/v1/clients';
import type { CampaignReach } from '../integrations/skadi/api/common';
import graphorm from '../graphorm';
import { BriefingType } from '../integrations/feed';
import { coresToUsd } from '../common/number';
import {
  getUserCampaignStats,
  type StartCampaignArgs,
  validateCampaignArgs,
} from '../common/campaign/common';
import type { PostAnalytics } from '../entity/posts/PostAnalytics';
import type { PostAnalyticsHistory } from '../entity/posts/PostAnalyticsHistory';
import {
  getBriefGenerationCost,
  requestBriefGeneration,
} from '../common/brief';
import { pollCreationSchema } from '../common/schema/polls';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { PollPost } from '../entity/posts/PollPost';

export interface GQLPollOption {
  id: string;
  text: string;
  numVotes: number;
  order: number;
}

export interface GQLPost {
  id: string;
  type: PostType;
  shortId: string;
  publishedAt?: Date;
  pinnedAt?: Date;
  createdAt: Date;
  url: string;
  title?: string;
  image?: string;
  readTime?: number;
  source?: GQLSource;
  tags?: string[];
  read?: boolean;
  bookmarked?: boolean;
  upvoted?: boolean;
  commented?: boolean;
  bookmarkList?: GQLBookmarkList;
  numUpvotes: number;
  numComments: number;
  numAwards: number;
  deleted?: boolean;
  private: boolean;
  // Used only for pagination (not part of the schema)
  score: number;
  bookmarkedAt?: Date;
  votedAt?: Date;
  author?: GQLUser;
  scout?: GQLUser;
  views?: number;
  discussionScore?: number;
  description?: string;
  toc?: Toc;
  summary?: string;
  isScout?: number;
  isAuthor?: number;
  sharedPost?: GQLPost;
  feedMeta?: string;
  content?: string;
  contentHtml?: string;
  downvoted?: boolean;
  flags?: PostFlagsPublic;
  userState?: GQLUserPost;
  slug?: string;
  translation?: Partial<Record<keyof PostTranslation, boolean>>;
  permalink?: string;
  endsAt?: Date;
  pollOptions?: GQLPollOption[];
  numPollVotes?: number;
}

interface PinPostArgs {
  id: string;
  pinned: boolean;
}

interface SwapPinnedPostArgs {
  id: Post['id'];
  swapWithId: Post['id'];
}

type GQLPostQuestion = Pick<PostQuestion, 'id' | 'post' | 'question'>;

export type GQLPostNotification = Pick<
  GQLPost,
  'id' | 'numUpvotes' | 'numComments'
>;

export type GQLPostSmartTitle = {
  title: string;
  translation: GQLPost['translation'];
};

const POST_MODERATION_LIMIT_FOR_MUTATION = 50;

export interface GQLPostUpvote {
  createdAt: Date;
  post: GQLPost;
}

export interface GQLUserPost {
  vote: UserVote;
  hidden: boolean;
  flags?: UserPostFlagsPublic;
  votedAt: Date | null;
  awarded: boolean;
  pollVoteOptionId?: string | null;
}

export interface GQLPostUpvoteArgs extends ConnectionArguments {
  id: string;
}

export type GQLPostAwardArgs = GQLPostUpvoteArgs;

export const getPostNotification = async (
  con: DataSource,
  postId: string,
): Promise<GQLPostNotification | undefined> => {
  const post = await con
    .getRepository(Post)
    .findOne({ where: { id: postId }, select: ['id', 'upvotes', 'comments'] });
  if (!post) {
    return undefined;
  }
  return { id: post.id, numUpvotes: post.upvotes, numComments: post.comments };
};

interface ReportPostArgs {
  id: string;
  reason: ReportReason;
  comment: string;
  tags?: string[];
}

export interface GQLPostRelationArgs extends ConnectionArguments {
  id: string;
  relationType: PostRelationType;
}

export type GQLPostCodeSnippet = Pick<
  PostCodeSnippet,
  'postId' | 'language' | 'content' | 'order'
>;

export type GQLPostAnalytics = Omit<PostAnalytics, 'post' | 'createdAt'>;

export type GQLPostAnalyticsHistory = Omit<
  PostAnalyticsHistory,
  'post' | 'createdAt'
>;

const formatCampaignV2toV1 = (campaign: CampaignForV1) => ({
  post: getFormattedBoostedPost(campaign.post),
  campaign: {
    budget: campaign.flags.budget ?? 0,
    clicks: campaign.flags.clicks ?? 0,
    users: campaign.flags.users ?? 0,
    spend: campaign.flags.spend ?? 0,
    impressions: campaign.flags.impressions ?? 0,
    campaignId: campaign.id,
    postId: campaign.referenceId,
    endedAt: campaign.endedAt,
    startedAt: campaign.createdAt,
    status: campaign.state,
  },
});

const builderForCampaignV1 = (builder: QueryBuilder<CampaignPost>) =>
  builder
    .select('c.id', 'id')
    .addSelect('c.referenceId', 'referenceId')
    .addSelect('c.createdAt', 'createdAt')
    .addSelect('c.endedAt', 'endedAt')
    .addSelect('c.state', 'state')
    .addSelect('c.flags', 'flags')
    .addSelect(
      `(
        SELECT json_build_object(
          'id', p1.id,
          'shortId', p1."shortId",
          'slug', p1.slug,
          'image', p1.image,
          'title', p1.title,
          'type', p1.type,
          'sharedTitle', p2.title,
          'sharedImage', p2.image
        )
        FROM post p1
        LEFT JOIN post p2 ON p1."sharedPostId" = p2.id
        WHERE p1.id = c."postId"
      )`,
      'post',
    );

enum MultiplePostItemType {
  Post = 'post',
  ModerationItem = 'moderationItem',
}

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(BriefingType, 'BriefingType')}
  ${toGQLEnum(MultiplePostItemType, 'MultiplePostItemType')}

  """
  Multiple post item
  """
  type MultiplePostItem {
    type: MultiplePostItemType!
    sourceId: ID!
    id: ID!
  }

  """
  Post moderation item
  """
  type SourcePostModeration {
    """
    Id of the post
    """
    id: ID!
    """
    The post's title in HTML
    """
    titleHtml: String
    """
    The post's title
    """
    title: String
    """
    The post's content in HTML
    """
    contentHtml: String
    """
    The post's content
    """
    content: String
    """
    The post's image
    """
    image: String
    """
    Related source this is posted to
    """
    source: Source
    """
    Type of post
    """
    type: String
    """
    Shared post
    """
    sharedPost: Post
    """
    Post
    """
    post: Post
    """
    external link url
    """
    externalLink: String
    """
    Status of the moderation
    """
    status: String!
    """
    Reason for rejection
    """
    rejectionReason: String
    """
    Moderator message
    """
    moderatorMessage: String
    """
    Time the post was created
    """
    createdAt: DateTime!
    """
    Author of the post
    """
    createdBy: User
    """
    Moderator of the post
    """
    moderatedBy: User
    """
    Poll options for poll posts
    """
    pollOptions: [CreatePollOption!]
  }

  type TocItem {
    """
    Content of the toc item
    """
    text: String!

    """
    Id attribute of the Html element of the toc item
    """
    id: String

    """
    Children items of the toc item
    """
    children: [TocItem]
  }

  """
  Post notification
  """
  type PostNotification {
    """
    Unique identifier
    """
    id: ID!

    """
    Total number of upvotes
    """
    numUpvotes: Int!

    """
    Total number of comments
    """
    numComments: Int!
  }

  type PostFlagsPublic {
    """
    Whether the post's source is private or not
    """
    private: Boolean

    """
    The unix timestamp (seconds) the post will be promoted to public to
    """
    promoteToPublic: Int @auth(requires: [MODERATOR])

    """
    Cover video
    """
    coverVideo: String

    """
    The current campaign running for the post
    """
    campaignId: String
    """
    Number of posts used to create content of this post, for example in briefs
    """
    posts: Int

    """
    Number of sources used to create content of this post, for example in briefs
    """
    sources: Int

    """
    Total time saved by reading this post, in minutes
    """
    savedTime: Int

    """
    Time the post was generated
    """
    generatedAt: DateTime
  }

  type UserPostFlagsPublic {
    """
    Whether user dismissed feedback prompt for post
    """
    feedbackDismiss: Boolean
  }

  type UserPost {
    """
    The user's vote for the post
    """
    vote: Int!

    """
    Whether the post is hidden or not
    """
    hidden: Boolean!

    """
    The post's flags
    """
    flags: UserPostFlagsPublic

    """
    Time when vote for the post was last updated
    """
    votedAt: DateTime

    user: User!

    post: Post!

    awarded: Boolean!

    award: Product

    """
    The transaction that was created for the award
    """
    awardTransaction: UserTransactionPublic
    """
    If the user voted on the poll, this is the option they voted for
    """
    pollOption: PollOption
  }

  type PostTranslation {
    title: Boolean
    smartTitle: Boolean
    titleHtml: Boolean
    summary: Boolean
  }

  """
  Content post
  """
  type Post {
    """
    Unique identifier
    """
    id: ID!

    """
    Post type
    """
    type: String

    """
    Unique URL friendly short identifier
    """
    shortId: String

    """
    Time the post was published
    """
    publishedAt: DateTime

    """
    Time the post was pinned to the database
    """
    pinnedAt: DateTime

    """
    Time the post was added to the database
    """
    createdAt: DateTime!

    """
    URL to the post
    """
    url: String

    """
    Title of the post
    """
    title: String

    """
    HTML equivalent of the title
    """
    titleHtml: String

    """
    URL to the image of post
    """
    image: String

    """
    Estimation of time to read the article (in minutes)
    """
    readTime: Float

    """
    Source of the post
    """
    source: Source

    """
    Source of the post
    """
    yggdrasilId: ID

    """
    Tags of the post
    """
    tags: [String!]

    """
    Whether the user has read this post
    """
    read: Boolean

    """
    Whether the user bookmarked this post
    """
    bookmark: Bookmark

    """
    Whether the user bookmarked this post
    """
    bookmarked: Boolean

    """
    Whether the user upvoted this post
    """
    upvoted: Boolean

    """
    Whether the user commented this post
    """
    commented: Boolean

    """
    Whether the post's source is private or not
    """
    private: Boolean

    """
    If bookmarked, this is the list where it is saved
    """
    bookmarkList: BookmarkList

    """
    Permanent link to the post
    """
    permalink: String!

    """
    Total number of upvotes
    """
    numUpvotes: Int!

    """
    Total number of comments
    """
    numComments: Int!

    """
    Total number of awards
    """
    numAwards: Int!

    """
    Permanent link to the comments of the post
    """
    commentsPermalink: String!

    """
    Domain the post belongs to
    """
    domain: String!

    """
    Author of the post (if they have a daily.dev account)
    """
    author: User

    """
    Scout of the post who suggested the link (if they have a daily.dev account)
    """
    scout: User

    """
    Number of times the article has been viewed (unique readers)
    """
    views: Int

    """
    Trending score of the post
    """
    trending: Int

    """
    Meta description of the post
    """
    description: String

    """
    Table of content of the post
    """
    toc: [TocItem]

    """
    Auto generated summary
    """
    summary: String

    """
    Whether the user is the author
    """
    isAuthor: Int

    """
    Whether the user is the scout
    """
    isScout: Int

    """
    Original post that was shared in this post
    """
    sharedPost: Post

    """
    Additional information required for analytics purposes
    """
    feedMeta: String

    """
    Content of the post
    """
    content: String

    """
    HTML Parsed content of the comment
    """
    contentHtml: String

    """
    Whether the user downvoted this post
    """
    downvoted: Boolean

    """
    All the flags for the post
    """
    flags: PostFlagsPublic

    """
    User state for the post
    """
    userState: UserPost @auth

    """
    Time the post was updated
    """
    updatedAt: DateTime

    """
    Related sources for collection post
    """
    collectionSources: [Source!]!

    """
    Total number of related sources for collection post
    """
    numCollectionSources: Int!

    """
    Video ID for video post
    """
    videoId: String

    """
    Slug for the post
    """
    slug: String

    """
    Whether the post title is detected as clickbait
    """
    clickbaitTitleDetected: Boolean

    """
    List of available translations for the post
    """
    translation: PostTranslation

    """
    Language of the post
    """
    language: String

    """
    Featured award for the post, currently the most expensive one
    """
    featuredAward: UserPost

    """
    The amount of total engagements for the post
    """
    engagements: Int
    """
    Poll options
    """
    pollOptions: [PollOption]
    """
    Date the poll ends
    """
    endsAt: DateTime
    """
    Total number of votes in the poll
    """
    numPollVotes: Int!
  }

  type PostConnection {
    pageInfo: PageInfo!
    edges: [PostEdge!]!
    """
    The original query in case of a search operation
    """
    query: String
  }

  type PostEdge {
    node: Post!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type SourcePostModerationConnection {
    pageInfo: PageInfo!
    edges: [SourcePostModerationEdge!]!
    """
    The original query in case of a search operation
    """
    query: String
  }

  type SourcePostModerationEdge {
    node: SourcePostModeration!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type UpvoteEdge {
    node: UserPost!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type UpvoteConnection {
    pageInfo: PageInfo!
    edges: [UpvoteEdge!]!
    """
    The original query in case of a search operation
    """
    query: String
  }

  type LinkPreview {
    id: String
    title: String!
    image: String!
    url: String
    relatedPublicPosts: [Post!]
  }

  type PostQuestion {
    id: String!
    post: Post!
    question: String!
  }

  type PollOption {
    id: String!
    numVotes: Int!
    text: String!
    order: Int!
  }

  input PollOptionInput {
    text: String!
    order: Int!
  }

  type CreatePollOption {
    text: String!
    order: Int!
  }

  ${toGQLEnum(PostCodeSnippetLanguage, 'PostCodeSnippetLanguage')}

  type PostCodeSnippet {
    postId: String!
    order: Int!
    language: PostCodeSnippetLanguage!
    content: String!
  }

  type PostCodeSnippetEdge {
    node: PostCodeSnippet!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type PostCodeSnippetConnection {
    pageInfo: PageInfo!
    edges: [PostCodeSnippetEdge!]!
    """
    The original query in case of a search operation
    """
    query: String
  }

  type PostSmartTitle {
    title: String
    translation: PostTranslation
  }

  """
  Enum of the possible reasons to report a post
  """
  enum ReportReason {
    """
    The post's link is broken
    """
    BROKEN
    """
    The post is a clickbait
    """
    CLICKBAIT
    """
    The post has low quality content
    """
    LOW
    """
    The post is not safe for work (NSFW), for any reason
    """
    NSFW
    """
    Reason doesnt fit any specific category
    """
    OTHER
    """
    When the reason is the post having irrelevant tags
    """
    IRRELEVANT
  }

  enum PostRelationType {
    COLLECTION
  }

  type UserPostEdge {
    node: UserPost!

    """
    Used in before and after args
    """
    cursor: String!
  }

  type UserPostConnection {
    pageInfo: PageInfo!
    edges: [UserPostEdge!]!
    """
    The original query in case of a search operation
    """
    query: String
  }

  type PostBalance {
    amount: Int!
  }

  type CampaignPost {
    campaignId: String!
    postId: String!
    status: String!
    spend: Int!
    budget: Int!
    startedAt: DateTime!
    endedAt: DateTime
    impressions: Int!
    clicks: Int!
    users: Int
  }

  type CampaignData {
    users: Int
    impressions: Int!
    engagements: Int!
    clicks: Int!
    totalSpend: Int!
  }

  type BoostedPost {
    post: Post!
    campaign: CampaignPost!
  }

  type BoostedPostEdge {
    node: BoostedPost!
    """
    Used in before and after args
    """
    cursor: String!
  }

  type BoostedPostConnection {
    pageInfo: PageInfo!
    edges: [BoostedPostEdge]!
    stats: CampaignData
  }

  type GenerateBriefingResponse {
    postId: String!
    balance: UserBalance
  }

  type PostAnalytics {
    id: ID!
    impressions: Int!
    reach: Int!
    bookmarks: Int!
    profileViews: Int!
    followers: Int!
    squadJoins: Int!
    sharesExternal: Int!
    sharesInternal: Int!
    reputation: Int!
    coresEarned: Int!
    upvotes: Int!
    downvotes: Int!
    comments: Int!
    awards: Int!
    upvotesRatio: Int!
    shares: Int!
    reachAds: Int!
    impressionsAds: Int!
  }

  type PostAnalyticsHistory {
    id: ID!
    date: DateTime!
    impressions: Int!
    impressionsAds: Int!
  }

  type PostAnalyticsHistoryEdge {
    node: PostAnalyticsHistory!

    """
    Used in before and after args
    """
    cursor: String!
  }

  type PostAnalyticsHistoryConnection {
    pageInfo: PageInfo!
    edges: [PostAnalyticsHistoryEdge!]!
    """
    The original query in case of a search operation
    """
    query: String
  }

  extend type Query {
    """
    Get specific squad post moderation item
    """
    sourcePostModeration(
      """
      Id of the requested post moderation
      """
      id: ID!
    ): SourcePostModeration! @auth
    """
    Get squad post moderations by source id
    """
    sourcePostModerations(
      """
      Id of the source
      """
      sourceId: ID
      """
      Status of the moderation
      """
      status: [String]
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
    ): SourcePostModerationConnection! @auth

    """
    Get post by id
    """
    post(
      """
      Id of the requested post
      """
      id: ID
    ): Post!

    """
    Get post by URL
    """
    postByUrl(
      """
      URL of the requested post
      """
      url: String
    ): Post!

    """
    Get Post's Upvotes by post id
    """
    postUpvotes(
      """
      Id of the relevant post to return Upvotes
      """
      id: String!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): UpvoteConnection!

    searchQuestionRecommendations: [PostQuestion]! @auth

    """
    Get related posts to a post by relation type
    """
    relatedPosts(
      """
      Post id
      """
      id: ID!

      """
      Relation type
      """
      relationType: PostRelationType!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): PostConnection!

    """
    Get code snippets by post id
    """
    postCodeSnippets(
      """
      Post id
      """
      id: ID!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): PostCodeSnippetConnection!

    """
    Gets the Smart Title or the original title of a post,
    based on the settings of the user
    """
    fetchSmartTitle(id: ID!): PostSmartTitle
      @auth
      @rateLimitCounter(maxTries: 5, period: "monthly", key: "fetchSmartTitle")

    """
    Get Post's Awards by post id
    """
    postAwards(
      """
      Id of the relevant post to return Awards
      """
      id: ID!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): UserPostConnection!

    """
    Get Post's Awards count
    """
    postAwardsTotal(
      """
      Id of the relevant post to return Awards
      """
      id: ID!
    ): PostBalance!

    """
    Estimate the reach for a post boost campaign
    """
    boostEstimatedReach(
      """
      ID of the post to boost
      """
      postId: ID!
    ): BoostEstimate! @auth

    """
    Estimate the daily reach for a post boost campaign with specific budget and duration
    """
    boostEstimatedReachDaily(
      """
      ID of the post to boost
      """
      postId: ID!

      """
      Cores budget per day
      """
      budget: Int!

      """
      Amount of days to run the campaign
      """
      duration: Int!
    ): BoostEstimate! @auth

    postCampaignById(
      """
      ID of the campaign to fetch
      """
      id: ID!
    ): BoostedPost! @auth

    postCampaigns(
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
    ): BoostedPostConnection! @auth

    """
    Get user briefing posts
    """
    briefingPosts(
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
    ): PostConnection! @auth

    """
    Get post analytics
    """
    postAnalytics(
      """
      Id of the post
      """
      id: ID!
    ): PostAnalytics! @auth

    """
    Get post analytics history
    """
    postAnalyticsHistory(
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int

      """
      Id of the post
      """
      id: ID!
    ): PostAnalyticsHistoryConnection! @auth
  }

  extend type Mutation {
    """
    Vote on a poll
    """
    votePoll(
      """
      ID of the post containing the poll
      """
      postId: ID!
      """
      ID of the option to vote for
      """
      optionId: ID!
    ): Post! @auth
    """
    To create post moderation item
    """
    createSourcePostModeration(
      """
      Id of the Squad to post to
      """
      sourceId: ID!
      """
      content of the post
      """
      content: String
      """
      Commentary on the post
      """
      commentary: String
      """
      title of the post
      """
      title: String
      """
      Image to upload
      """
      image: Upload
      """
      Image URL to use
      """
      imageUrl: String
      """
      ID of the post to share
      """
      sharedPostId: ID
      """
      type of the post
      """
      type: String!
      """
      External link of the post
      """
      externalLink: String
      """
      ID of the exisiting post
      """
      postId: ID
      """
      Poll options
      """
      pollOptions: [PollOptionInput!]
      """
      Duration in days for poll (3-30 days)
      """
      duration: Int
    ): SourcePostModeration! @auth @rateLimit(limit: 1, duration: 30)

    """
    Create multiple source posts
    """
    createMultipleSourcePosts(
      """
      Ids of the Sources to post into
      """
      sourceIds: [ID!]!
      """
      content of the post
      """
      content: String
      """
      Commentary on the post
      """
      commentary: String
      """
      title of the post
      """
      title: String
      """
      Image to upload
      """
      image: Upload
      """
      Image URL to use
      """
      imageUrl: String
      """
      ID of the post to share
      """
      sharedPostId: ID
      """
      External link of the post
      """
      externalLink: String
    ): [MultiplePostItem]! @auth @rateLimit(limit: 1, duration: 30)

    """
    Hide a post from all the user feeds
    """
    hidePost(
      """
      Id of the post to hide
      """
      id: ID
    ): EmptyResponse @auth

    """
    Unhide a post from all the user feeds
    """
    unhidePost(
      """
      Id of the post to hide
      """
      id: ID
    ): EmptyResponse @auth

    """
    Report a post and hide it from all the user feeds
    """
    reportPost(
      """
      Id of the post to report
      """
      id: ID
      """
      Reason the user would like to report
      """
      reason: ReportReason
      """
      Additional comment about report reason
      """
      comment: String
      """
      List of irrelevant tags
      """
      tags: [String]
    ): EmptyResponse @auth

    """
    To allow user to create freeform posts
    """
    createFreeformPost(
      """
      ID of the squad to post to
      """
      sourceId: ID!

      """
      Avatar image for the squad
      """
      image: Upload

      """
      Title of the post (max 80 chars)
      """
      title: String!

      """
      Content of the post
      """
      content: String
    ): Post! @auth @rateLimit(limit: 1, duration: 30)

    """
    To allow user to edit posts
    """
    editPost(
      """
      ID of the post to update
      """
      id: ID!
      """
      Avatar image for the squad
      """
      image: Upload
      """
      Title of the post (max 80 chars)
      """
      title: String
      """
      Content of the post
      """
      content: String
    ): Post! @auth

    """
    Upload an asset from writing a post
    """
    uploadContentImage(
      """
      Asset to upload to our cloudinary server
      """
      image: Upload!
    ): String! @auth @rateLimit(limit: 5, duration: 60)

    """
    Promote a post
    """
    promoteToPublic(
      """
      Id of the post to update the promoteToPublic flag for
      """
      id: ID!
    ): EmptyResponse @auth(requires: [MODERATOR])

    """
    Demote a post
    """
    demoteFromPublic(
      """
      Id of the post to demote from the public
      """
      id: ID!
    ): EmptyResponse @auth(requires: [MODERATOR])

    """
    Pin or unpin a post
    """
    updatePinPost(
      """
      Id of the post to update the pinnedAt property
      """
      id: ID!

      """
      Whether to pin the post or not
      """
      pinned: Boolean!
    ): EmptyResponse @auth

    """
    Swap the order of 2 pinned posts based on their pinnedAt timestamp
    """
    swapPinnedPosts(
      """
      Id of the post to update the pinnedAt property
      """
      id: ID!

      """
      The post ID to swap with
      """
      swapWithId: ID!
    ): EmptyResponse @auth

    """
    Delete a post permanently
    """
    deletePost(
      """
      Id of the post to delete
      """
      id: ID
    ): EmptyResponse @auth

    """
    Bans a post (can be undone)
    """
    banPost(
      """
      Id of the post to ban
      """
      id: ID
    ): EmptyResponse @auth(requires: [MODERATOR])

    """
    Toggles post's title between clickbait and non-clickbait
    """
    clickbaitPost(id: ID!): EmptyResponse @auth(requires: [MODERATOR])

    """
    Start a post boost campaign
    """
    startPostBoost(
      """
      ID of the post to boost
      """
      postId: ID!
      """
      Duration of the boost in days (1-30)
      """
      duration: Int!
      """
      Budget for the boost in cores (1000-100000, must be divisible by 1000)
      """
      budget: Int!
    ): TransactionCreated @auth

    """
    Cancel an existing post boost campaign
    """
    cancelPostBoost(
      """
      ID of the post to cancel boost for
      """
      postId: ID!
    ): TransactionCreated @auth

    """
    Fetch external link's title and image preview
    """
    checkLinkPreview(
      """
      URL of the external link
      """
      url: String!
    ): LinkPreview @auth @rateLimit(limit: 20, duration: 60)

    """
    Create external link in source
    """
    submitExternalLink(
      """
      Source to share the post to
      """
      sourceId: ID!
      """
      URL to the new private post
      """
      url: String!
      """
      Preview image of the external link
      """
      image: String
      """
      Title of the external link
      """
      title: String
      """
      Commentary for the share
      """
      commentary: String
    ): EmptyResponse @auth @rateLimit(limit: 1, duration: 30)

    """
    Share post to source
    """
    sharePost(
      """
      Post to share in the source
      """
      id: ID!
      """
      Commentary for the share
      """
      commentary: String
      """
      Source to share the post to
      """
      sourceId: ID!
    ): Post @auth @rateLimit(limit: 1, duration: 30)

    """
    Update share type post
    """
    editSharePost(
      """
      Post to update
      """
      id: ID!
      """
      Commentary for the share
      """
      commentary: String
    ): Post @auth

    """
    Submit a view event to a post
    """
    viewPost(
      """
      Post to share in the source
      """
      id: ID!
    ): EmptyResponse @auth

    """
    Dismiss user post feedback
    """
    dismissPostFeedback(
      """
      Id of the post
      """
      id: ID!
    ): EmptyResponse @auth

    """
    Approve/Reject pending post moderation
    """
    moderateSourcePosts(
      """
      List of posts to moderate
      """
      postIds: [ID]!
      """
      Status wanted for the post
      """
      status: String
      """
      Source to moderate the post in
      """
      sourceId: ID
      """
      Rejection reason for the post
      """
      rejectionReason: String
      """
      Moderator message for the post
      """
      moderatorMessage: String
    ): [SourcePostModeration]! @auth

    """
    Delete a post moderation item
    """
    deleteSourcePostModeration(
      """
      Id of the post moderation
      """
      postId: ID!
    ): EmptyResponse @auth

    """
    Edit post moderation item
    """
    editSourcePostModeration(
      """
      Id of the post moderation
      """
      id: ID!
      """
      Id of the Squad to post to
      """
      sourceId: ID!
      """
      content of the post
      """
      content: String
      """
      Commentary on the post
      """
      commentary: String
      """
      title of the post
      """
      title: String
      """
      Image to upload
      """
      image: Upload
      """
      Image URL to use
      """
      imageUrl: String
      """
      ID of the post to share
      """
      sharedPostId: ID
      """
      type of the post
      """
      type: String!
      """
      External link of the post
      """
      externalLink: String
      """
      Poll options
      """
      pollOptions: [PollOptionInput!]
      """
      Duration in days for poll (3-30 days)
      """
      duration: Int
    ): SourcePostModeration! @auth

    """
    Generate new briefing for the user
    """
    generateBriefing(type: BriefingType!): GenerateBriefingResponse! @auth
    """
    Create a new poll post
    """
    createPollPost(
      """
      ID of the source to post to
      """
      sourceId: ID!
      """
      Poll question
      """
      title: String!
      """
      Poll options
      """
      options: [PollOptionInput!]!
      """
      Duration in days
      """
      duration: Int
    ): Post! @auth @rateLimit(limit: 1, duration: 30)
  }

  extend type Subscription {
    """
    Get notified when one of the given posts is upvoted or comments
    """
    postsEngaged: PostNotification
  }
`;

const nullableImageType = [
  PostType.Freeform,
  PostType.Welcome,
  PostType.Collection,
  PostType.Poll,
];

const editablePostTypes = [PostType.Welcome, PostType.Freeform];

export const getPostPermalink = (post: Pick<GQLPost, 'shortId'>): string =>
  `${process.env.URL_PREFIX}/r/${post.shortId}`;

export const getPostByUrl = async (
  ctx: Context,
  info: GraphQLResolveInfo,
  { url, canonicalUrl }: { url: string; canonicalUrl: string },
): Promise<GQLPost> => {
  const res = await graphorm.queryByHierarchy<GQLPost>(
    ctx,
    info,
    ['post'],
    (builder) => ({
      ...builder,
      queryBuilder: builder.queryBuilder
        .addSelect(`"${builder.alias}"."deleted"`)
        .where(
          `("${builder.alias}"."canonicalUrl" = :canonicalUrl OR "${builder.alias}"."url" = :url)`,
          { canonicalUrl, url },
        )
        .limit(1),
    }),
  );

  return res[0];
};

const updatePromoteToPublicFlag = async (
  ctx: Context,
  id: string,
  value: number | null,
): Promise<GQLEmptyResponse> => {
  if (!ctx.roles.includes(Roles.Moderator)) {
    throw new ForbiddenError('Access denied!');
  }

  await ctx.getRepository(Post).update(
    { id },
    {
      flags: updateFlagsStatement<Post>({ promoteToPublic: value }),
    },
  );

  return { _: true };
};

const getPostById = async (
  ctx: Context,
  info: GraphQLResolveInfo,
  id: string,
): Promise<GQLPost> => {
  const res = await graphorm.query<GQLPost>(ctx, info, (builder) => ({
    ...builder,
    queryBuilder: builder.queryBuilder.where(
      `"${builder.alias}"."id" = :id AND "${builder.alias}"."deleted" = false AND "${builder.alias}"."visible" = true`,
      { id },
    ),
  }));
  if (res.length) {
    return res[0];
  }
  throw new NotFoundError('Post not found');
};

const validateEditAllowed = (
  authorId: Post['authorId'],
  userId: User['id'],
) => {
  if (authorId !== userId) {
    throw new ForbiddenError(`Editing other people's posts is not allowed!`);
  }
};

const postCodeSnippetPageGenerator = offsetPageGenerator<GQLPostCodeSnippet>(
  100,
  500,
);

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    sourcePostModeration: async (
      _,
      { id }: { id: string },
      ctx: Context,
      info,
    ): Promise<GQLSourcePostModeration> => {
      const moderation = await ctx.con
        .getRepository(SourcePostModeration)
        .findOneOrFail({
          where: { id },
          select: ['sourceId'],
        });

      const isModerator = await isPrivilegedMember(ctx, moderation.sourceId);

      return graphorm.queryOneOrFail<GQLSourcePostModeration>(
        ctx,
        info,
        (builder) => {
          const queryBuilder = builder.queryBuilder.where(
            `"${builder.alias}"."id" = :id`,
            { id },
          );

          if (!isModerator) {
            queryBuilder.andWhere(
              `"${builder.alias}"."createdById" = :userId`,
              {
                userId: ctx.userId,
              },
            );
          }
          return {
            ...builder,
            queryBuilder,
          };
        },
      );
    },
    sourcePostModerations: async (
      _,
      args: SourcePostModerationArgs,
      ctx: Context,
      info,
    ): Promise<ConnectionRelay<GQLSourcePostModeration>> => {
      if (args?.sourceId) {
        const isModerator = await isPrivilegedMember(ctx, args.sourceId);
        if (isModerator) {
          return getModerationItemsAsAdminForSource(ctx, info, args);
        }
        return getModerationItemsByUserForSource(ctx, info, args);
      }
      return getAllModerationItemsAsAdmin(ctx, info, args);
    },
    post: async (
      source,
      { id }: { id: string },
      ctx: Context,
      info,
    ): Promise<GQLPost> => {
      const partialPost = await ctx.con.getRepository(Post).findOneOrFail({
        select: ['id', 'sourceId', 'private', 'authorId', 'type'],
        relations: ['source'],
        where: [{ id }, { slug: id }],
      });
      const postSource = await partialPost.source;

      if (
        partialPost.private ||
        sourceTypesWithMembers.includes(postSource.type)
      ) {
        try {
          await ensureSourcePermissions(ctx, partialPost.sourceId);
        } catch (permissionError) {
          if (permissionError instanceof ForbiddenError) {
            const forbiddenError = permissionError as ForbiddenError;

            const forbiddenErrorForPost = new ForbiddenError(
              permissionError.message,
              {
                ...forbiddenError.extensions,
                postId: partialPost.id,
              },
            );

            throw forbiddenErrorForPost;
          }

          throw permissionError;
        }
      }
      return getPostById(ctx, info, partialPost.id);
    },
    postByUrl: async (
      source,
      { url }: { url: string },
      ctx: Context,
      info,
    ): Promise<GQLPost> => {
      if (!isValidHttpUrl(url)) {
        throw new ValidationError('Invalid URL provided');
      }

      const { url: cleanUrl, canonicalUrl } = standardizeURL(url);
      const res = await graphorm.query(
        ctx,
        info,
        (builder) => ({
          ...builder,
          queryBuilder: builder.queryBuilder
            .where(
              `("${builder.alias}"."canonicalUrl" = :canonicalUrl OR "${builder.alias}"."url" = :url)`,
              { canonicalUrl, url: cleanUrl },
            )
            .andWhere(`"${builder.alias}"."deleted" = false`)
            .andWhere(`"${builder.alias}"."visible" = true`)
            .limit(1),
        }),
        true,
      );
      if (res.length) {
        const post = res[0] as GQLPost;
        if (post.private) {
          let sourceId = post.source?.id;
          if (!sourceId) {
            const p2 = await ctx.con.getRepository(Post).findOneOrFail({
              select: ['sourceId'],
              where: { id: post.id },
            });
            sourceId = p2.sourceId;
          }
          await ensureSourcePermissions(ctx, sourceId);
        }
        return post;
      }
      throw new NotFoundError('Post not found');
    },
    postUpvotes: async (
      _,
      args: GQLPostUpvoteArgs,
      ctx: Context,
      info,
    ): Promise<ConnectionRelay<GQLUserPost>> => {
      const post = await ctx.con
        .getRepository(Post)
        .findOneByOrFail({ id: args.id });
      await ensureSourcePermissions(ctx, post.sourceId);
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'votedAt' } as GQLDatePageGeneratorConfig<UserPost, 'votedAt'>,
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder
              .andWhere(`${builder.alias}.postId = :postId`, {
                postId: args.id,
              })
              .andWhere(`${builder.alias}.vote = 1`);

            if (ctx.userId) {
              builder.queryBuilder.andWhere(
                whereNotUserBlocked(builder.queryBuilder, {
                  userId: ctx.userId,
                }),
              );
            }

            return builder;
          },
          orderByKey: 'DESC',
        },
      );
    },
    searchQuestionRecommendations: async (
      source,
      _,
      ctx: AuthContext,
      info,
    ): Promise<GQLPostQuestion[]> => {
      const key = generateStorageKey(StorageTopic.Search, 'rec', ctx.userId);
      const cached = await getRedisObject(key);

      if (cached) {
        return JSON.parse(cached);
      }

      const data: GQLPostQuestion[] = await graphorm.query(
        ctx,
        info,
        (builder) => ({
          ...builder,
          queryBuilder: builder.queryBuilder
            .innerJoin(
              (query) => {
                const sub = query
                  .subQuery()
                  .select('id')
                  .from(PostQuestion, 'pq')
                  .where(`"pq"."postId" = "v"."postId"`);
                return query
                  .select('v."postId"')
                  .from(View, 'v')
                  .where({
                    userId: ctx.userId,
                    timestamp: MoreThan(subDays(new Date(), 30)),
                  })
                  .andWhere(`exists(${sub.getQuery()})`)
                  .orderBy('v."timestamp"', 'DESC')
                  .limit(10);
              },
              'views',
              `"${builder.alias}"."postId" = views."postId"`,
            )
            .orderBy('random()', 'DESC')
            .limit(3),
        }),
        true,
      );
      await setRedisObjectWithExpiry(
        key,
        JSON.stringify(data),
        ONE_MINUTE_IN_SECONDS * 3,
      );

      return data;
    },
    relatedPosts: async (
      _,
      args: GQLPostRelationArgs,
      ctx: Context,
      info,
    ): Promise<ConnectionRelay<GQLPost>> => {
      const post = await ctx.con
        .getRepository(Post)
        .findOneByOrFail([{ id: args.id }, { slug: args.id }]);
      await ensureSourcePermissions(ctx, post.sourceId);

      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt' },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder
              .leftJoin(
                PostRelation,
                'pr',
                `pr."relatedPostId" = ${builder.alias}.id`,
              )
              .andWhere(`pr.postId = :postId`, {
                postId: args.id,
              })
              .andWhere(`pr.type = :type`, {
                type: args.relationType,
              });

            return builder;
          },
          orderByKey: 'DESC',
        },
      );
    },
    postCodeSnippets: async (
      _,
      args: GQLPostRelationArgs,
      ctx: Context,
      info,
    ): Promise<ConnectionRelay<GQLPostCodeSnippet>> => {
      const post = await ctx.con
        .getRepository(Post)
        .findOneByOrFail([{ id: args.id }, { slug: args.id }]);
      await ensureSourcePermissions(ctx, post.sourceId);

      const page = postCodeSnippetPageGenerator.connArgsToPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) =>
          postCodeSnippetPageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => postCodeSnippetPageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          postCodeSnippetPageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder
            .andWhere(`${builder.alias}."postId" = :postId`, {
              postId: args.id,
            })
            .limit(page.limit)
            .offset(page.offset)
            .addOrderBy(`${builder.alias}.order`, 'ASC');

          return builder;
        },
        undefined,
        true,
      );
    },
    /**
     * Fetches the original title if clickbait shield is enabled,
     * and the smart title if clickbait shield is disabled.
     *
     * This is so that we an query the opposite title based on the user's settings.
     */
    fetchSmartTitle: async (
      _,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLPostSmartTitle> =>
      queryReadReplica(ctx.con, async ({ queryRunner }) => {
        const post: Pick<Post, 'title' | 'contentMeta' | 'translation'> =
          await queryRunner.manager.getRepository(Post).findOneOrFail({
            where: { id },
            select: ['title', 'contentMeta', 'translation'],
          });

        const translationRecord = getTranslationRecord({
          translations: post.translation,
          contentLanguage: ctx.contentLanguage,
        });

        if (!ctx.isPlus) {
          return {
            title: getPostSmartTitle(post, ctx.contentLanguage),
            translation: translationRecord,
          };
        }

        const settings = await queryRunner.manager
          .getRepository(Settings)
          .findOne({
            where: { userId: ctx.userId },
            select: ['flags'],
          });

        // If the user has clickbait shield enabled, return the original title
        if (settings?.flags?.clickbaitShieldEnabled ?? true) {
          return {
            title: getPostTranslatedTitle(post, ctx.contentLanguage),
            translation: translationRecord,
          };
        }

        // If the user has clickbait shield disabled, return the smart title
        return {
          title: getPostSmartTitle(post, ctx.contentLanguage),
          translation: translationRecord,
        };
      }),
    postAwards: async (
      _,
      args: GQLPostAwardArgs,
      ctx: Context,
      info,
    ): Promise<ConnectionRelay<GQLUserPost>> => {
      const post: Pick<Post, 'id' | 'sourceId'> = await ctx.con
        .getRepository(Post)
        .findOneOrFail({
          select: ['id', 'sourceId'],
          where: {
            id: args.id,
          },
        });

      await ensureSourcePermissions(ctx, post.sourceId);

      const pageGenerator = offsetPageGenerator<GQLUserPost>(20, 100);
      const page = pageGenerator.connArgsToPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => pageGenerator.hasNextPage(page, nodeSize),
        (node, index) => pageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder.innerJoin(
            'UserTransaction',
            'postAwardUserTransaction',
            `"postAwardUserTransaction".id = ${builder.alias}."awardTransactionId"`,
          );

          builder.queryBuilder.andWhere(`${builder.alias}.postId = :postId`, {
            postId: args.id,
          });

          if (ctx.userId) {
            builder.queryBuilder.andWhere(
              whereNotUserBlocked(builder.queryBuilder, {
                userId: ctx.userId,
              }),
            );
          }

          builder.queryBuilder
            .limit(page.limit)
            .offset(page.offset)
            .addOrderBy(`"postAwardUserTransaction"."value"`, 'DESC');

          return builder;
        },
        undefined,
        true,
      );
    },
    postAwardsTotal: async (
      _,
      args: GQLPostAwardArgs,
      ctx: Context,
    ): Promise<{ amount: number }> => {
      const post: Pick<Post, 'id' | 'sourceId'> = await ctx.con
        .getRepository(Post)
        .findOneOrFail({
          select: ['id', 'sourceId'],
          where: {
            id: args.id,
          },
        });

      await ensureSourcePermissions(ctx, post.sourceId);

      const result = await ctx.con
        .getRepository(UserPost)
        .createQueryBuilder('up')
        .select('COALESCE(SUM(ut.value), 0)', 'amount')
        .innerJoin('UserTransaction', 'ut', 'ut.id = up."awardTransactionId"')
        .where('up."postId" = :postId', { postId: post.id })
        .getRawOne();

      return result;
    },
    boostEstimatedReach: async (
      _,
      args: { postId: string },
      ctx: AuthContext,
    ): Promise<CampaignReach> => {
      const { postId } = args;
      const post = await validatePostBoostPermissions(ctx, postId);
      checkPostAlreadyBoosted(post);

      const { users } = await skadiApiClientV1.estimatePostBoostReach({
        postId,
        userId: ctx.userId,
      });

      return getAdjustedReach(users);
    },
    boostEstimatedReachDaily: async (
      _,
      args: { postId: string; budget: number; duration: number },
      ctx: AuthContext,
    ): Promise<CampaignReach> => {
      const { postId, budget, duration } = args;
      const post = await validatePostBoostPermissions(ctx, postId);
      checkPostAlreadyBoosted(post);
      validateCampaignArgs({ budget, duration });

      const { minImpressions, maxImpressions } =
        await skadiApiClientV1.estimatePostBoostReachDaily({
          postId,
          userId: ctx.userId,
          budget: coresToUsd(budget),
          durationInDays: duration,
        });

      if (minImpressions === maxImpressions) {
        return getAdjustedReach(maxImpressions);
      }

      const min = Math.max(minImpressions, 0);
      const max = Math.max(maxImpressions, min);

      return { min, max };
    },
    postCampaignById: async (
      _,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLBoostedPost> => {
      const campaign = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        builderForCampaignV1(
          queryRunner.manager
            .getRepository(CampaignPost)
            .createQueryBuilder('c'),
        )
          .where('c.id = :id', { id })
          .andWhere('c."userId" = :user', { user: ctx.userId })
          .getRawOne<CampaignForV1>(),
      );

      if (!campaign) {
        throw new NotFoundError('Campaign does not exist!');
      }

      return formatCampaignV2toV1(campaign);
    },
    postCampaigns: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
    ): Promise<BoostedPostConnection> => {
      const { first, after } = args;
      const isFirstRequest = !after;
      const offset = after ? cursorToOffset(after) : 0;
      const paginated = await graphorm.queryPaginatedIntegration(
        () => !!after,
        (nodeSize) => nodeSize === first,
        (_, i) => offsetToCursor(offset + i + 1),
        async () => {
          const campaigns = await queryReadReplica(
            ctx.con,
            ({ queryRunner }) => {
              const builder = builderForCampaignV1(
                queryRunner.manager
                  .getRepository(CampaignPost)
                  .createQueryBuilder('c'),
              );

              builder
                .andWhere(`c."userId" = :campaignUserId`, {
                  campaignUserId: ctx.userId,
                })
                .orderBy(`CASE WHEN c."state" = :active THEN 0 ELSE 1 END`)
                .addOrderBy('c."createdAt"', 'DESC')
                .limit(getLimit({ limit: first ?? 20 }))
                .setParameter('active', CampaignState.Active);

              if (offset) {
                builder.offset(offset);
              }

              return builder.getRawMany<CampaignForV1>();
            },
          );

          return campaigns.map(formatCampaignV2toV1);
        },
      );

      const stats = await getUserCampaignStats(ctx);

      return {
        ...paginated,
        stats: isFirstRequest
          ? { ...stats, totalSpend: stats.spend, engagements: 0 }
          : undefined,
      };
    },
    briefingPosts: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info,
    ): Promise<ConnectionRelay<GQLPost>> => {
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt' },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder
              .andWhere(`${builder.alias}.authorId = :briefingUserId`, {
                briefingUserId: ctx.userId,
              })
              .andWhere(`${builder.alias}.type = :type`, {
                type: PostType.Brief,
              });

            return builder;
          },
          orderByKey: 'DESC',
        },
      );
    },
    postAnalytics: async (
      _,
      args: {
        id: string;
      },
      ctx: AuthContext,
      info,
    ): Promise<GQLPostAnalytics> => {
      await ensurePostAnalyticsPermissions({ ctx, postId: args.id });

      return graphorm.queryOneOrFail<GQLPostAnalytics>(
        ctx,
        info,
        (builder) => ({
          ...builder,
          queryBuilder: builder.queryBuilder.andWhere(
            `"${builder.alias}".id = :postId`,
            { postId: args.id },
          ),
        }),
        undefined,
        true,
      );
    },
    postAnalyticsHistory: async (
      _,
      args: ConnectionArguments & {
        id: string;
      },
      ctx: AuthContext,
      info,
    ): Promise<ConnectionRelay<GQLPostAnalyticsHistory>> => {
      await ensurePostAnalyticsPermissions({ ctx, postId: args.id });

      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'updatedAt' },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}.id = :postId`,
              {
                postId: args.id,
              },
            );

            return builder;
          },
          orderByKey: 'DESC',
          readReplica: true,
        },
      );
    },
  },
  Mutation: {
    createSourcePostModeration: async (
      _,
      props: CreateSourcePostModerationArgs,
      ctx: AuthContext,
      info,
    ): Promise<GQLSourcePostModeration> => {
      await Promise.all([
        ensureSourcePermissions(
          ctx,
          props.sourceId,
          SourcePermissions.PostRequest,
        ),
        ensurePostRateLimit(ctx.con, ctx.userId),
      ]);

      const pendingPost = await validateSourcePostModeration(ctx, props);
      const moderatedPost = await createSourcePostModeration({
        ctx,
        args: pendingPost,
      });

      return graphorm.queryOneOrFail<GQLSourcePostModeration>(
        ctx,
        info,
        (builder) => ({
          ...builder,
          queryBuilder: builder.queryBuilder.where(
            `"${builder.alias}"."id" = :id`,
            { id: moderatedPost.id },
          ),
        }),
      );
    },
    hidePost: async (
      source,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await saveHiddenPost(ctx.con, { userId: ctx.userId, postId: id });
      return { _: true };
    },
    unhidePost: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (entityManager) => {
        await entityManager.getRepository(UserPost).save({
          postId: id,
          userId: ctx.userId,
          hidden: false,
        });
      });

      return { _: true };
    },
    reportPost: async (
      source,
      { id, reason, comment, tags }: ReportPostArgs,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await reportPost({ ctx, id, reason, comment, tags });

      return { _: true };
    },
    uploadContentImage: async (
      _,
      { image }: { image: Promise<FileUpload> },
      ctx,
    ): Promise<string> => {
      if (!image) {
        throw new ValidationError('File is missing!');
      }

      if (!process.env.CLOUDINARY_URL) {
        throw new Error('Unable to upload asset to cloudinary!');
      }

      const upload = await image;
      const extension = upload.filename?.split('.').pop().toLowerCase();
      const preset =
        extension === 'gif'
          ? UploadPreset.FreeformGif
          : UploadPreset.FreeformImage;
      const id = generateUUID();
      const filename = `content_${id}`;
      const { url: imageUrl, id: imageId } = await uploadPostFile(
        filename,
        upload.createReadStream(),
        preset,
      );
      await ctx.con.getRepository(ContentImage).save({
        serviceId: imageId,
        url: imageUrl,
      });
      return mapCloudinaryUrl(imageUrl);
    },
    deletePost: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      if (ctx.roles.includes(Roles.Moderator)) {
        await deletePost({ con: ctx.con, id, userId: ctx.userId });
        return { _: true };
      }

      await ctx.con.transaction(async (manager) => {
        const repo = manager.getRepository(Post);
        const post = await repo.findOneByOrFail({ id });
        if (post.authorId !== ctx.userId) {
          await ensureSourcePermissions(
            ctx,
            post.sourceId,
            SourcePermissions.PostDelete,
          );
        }
        await deletePost({ con: manager, id, userId: ctx.userId });
      });

      return { _: true };
    },
    promoteToPublic: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const timeToSeconds = Math.floor(nextWeek.valueOf() / 1000);
      return updatePromoteToPublicFlag(ctx, id, timeToSeconds);
    },
    demoteFromPublic: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => updatePromoteToPublicFlag(ctx, id, null),
    updatePinPost: async (
      _,
      { id, pinned }: PinPostArgs,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (manager) => {
        const repo = manager.getRepository(Post);
        const post = await repo.findOneByOrFail({ id });

        await ensureSourcePermissions(
          ctx,
          post.sourceId,
          SourcePermissions.PostPin,
        );

        const pinnedAt = pinned ? new Date() : null;

        await repo.update({ id }, { pinnedAt: pinnedAt as Date });
      });

      return { _: true };
    },
    swapPinnedPosts: async (
      _,
      { id, swapWithId }: SwapPinnedPostArgs,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (manager) => {
        const repo = manager.getRepository(Post);
        const post = await repo.findOneByOrFail({ id });
        const swapWithPost = await repo.findOneByOrFail({
          id: swapWithId,
        });

        await ensureSourcePermissions(
          ctx,
          post.sourceId,
          SourcePermissions.PostPin,
        );

        if (!post.pinnedAt || !swapWithPost.pinnedAt) {
          throw new ValidationError('Posts must be pinned first');
        }

        const isNextPost = swapWithPost.pinnedAt > post.pinnedAt;
        const swapPinnedTime = new Date(
          swapWithPost.pinnedAt.getTime() + 1000 * (isNextPost ? 1 : -1),
        );

        let query = manager
          .createQueryBuilder()
          .update(Post)
          .set({
            pinnedAt: () =>
              isNextPost
                ? `"pinnedAt" + interval '1 second'`
                : `"pinnedAt" - interval '1 second'`,
          })
          .where('"pinnedAt" IS NOT NULL')
          .andWhere('"sourceId" = :sourceId', { sourceId: post.sourceId });

        if (isNextPost) {
          query = query.andWhere('"pinnedAt" >= :swapPinnedTime', {
            swapPinnedTime,
          });
        } else {
          query = query.andWhere('"pinnedAt" <= :swapPinnedTime', {
            swapPinnedTime,
          });
        }

        await query.execute();
        await repo.update(
          { id },
          {
            pinnedAt: swapPinnedTime,
          },
        );
      });

      return { _: true };
    },
    createFreeformPost: async (
      _,
      args: CreatePostArgs,
      ctx: AuthContext,
      info,
    ): Promise<GQLPost> => {
      const { id } = await createFreeformPost(ctx, args);

      return graphorm.queryOneOrFail<GQLPost>(ctx, info, (builder) => ({
        ...builder,
        queryBuilder: builder.queryBuilder.where(
          `"${builder.alias}"."id" = :id`,
          { id },
        ),
      }));
    },
    editPost: async (
      _,
      args: EditPostArgs,
      ctx: AuthContext,
      info,
    ): Promise<GQLPost> => {
      const { id, image } = args;
      const { con, userId } = ctx;
      const { title, content } = validatePost(args);

      await con.transaction(async (manager) => {
        const repo = manager.getRepository(Post);
        const post = (await repo.findOneByOrFail({ id })) as
          | WelcomePost
          | FreeformPost;

        if (!editablePostTypes.includes(post.type)) {
          throw new ForbiddenError(
            'Editing post outside of type welcome_post and freeform is not allowed',
          );
        }

        if (post.authorId !== userId) {
          if (post.type !== PostType.Welcome) {
            throw new ForbiddenError(
              `Editing other people's posts is not allowed!`,
            );
          }

          await ensureSourcePermissions(
            ctx,
            post.sourceId,
            SourcePermissions.WelcomePostEdit,
          );
        }

        let updated: Partial<EditablePost> = {};

        if (title && title !== post.title) {
          updated.title = title;
        }

        if (image && process.env.CLOUDINARY_URL) {
          const upload = await image;
          const { url: coverImageUrl } = await uploadPostFile(
            id,
            upload.createReadStream(),
            UploadPreset.PostBannerImage,
          );
          updated.image = coverImageUrl;
        }

        if (content !== post.content) {
          const mentions = await getMentions(
            manager,
            content,
            userId,
            post.sourceId,
          );
          updated.content = content;
          updated.contentHtml = markdown.render(content, { mentions });
          await saveMentions(
            manager,
            post.id,
            ctx.userId,
            mentions,
            PostMention,
          );
        }

        if (post.type === PostType.Welcome) {
          await insertOrIgnoreAction(
            con,
            ctx.userId,
            UserActionType.EditWelcomePost,
          );
        }

        if (Object.keys(updated).length) {
          // Apply vordr checks before updating
          updated = await preparePostForUpdate(updated, post, {
            con: manager,
            userId,
            req: ctx.req,
          });
          // Type magic to avoid typescript issues
          const updatedQuery: QueryDeepPartialEntity<Post> = updated;
          if (updatedQuery.flags) {
            updatedQuery.flags = updateFlagsStatement(updatedQuery.flags);
          }
          await repo.update({ id }, updatedQuery);
        }
      });

      return graphorm.queryOneOrFail<GQLPost>(ctx, info, (builder) => ({
        ...builder,
        queryBuilder: builder.queryBuilder.where(
          `"${builder.alias}"."id" = :id`,
          { id },
        ),
      }));
    },
    banPost: async (
      source,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const post = await ctx.getRepository(Post).findOneByOrFail({ id });
      if (!post.banned) {
        await ctx.getRepository(Post).update(
          { id },
          {
            banned: true,
            flags: updateFlagsStatement<Post>({ banned: true }),
          },
        );
      }
      return { _: true };
    },
    clickbaitPost: async (_, { id }: { id: string }, ctx: AuthContext) => {
      const { contentQuality }: Pick<Post, 'contentQuality'> = await ctx.con
        .getRepository(Post)
        .findOneOrFail({
          where: { id },
          select: ['contentQuality'],
        });

      const clickbaitProbability = parseFloat(
        (contentQuality.is_clickbait_probability as unknown as string) || '0.0',
      );
      const clickbaitTitleProbabilityThreshold =
        remoteConfig.vars.clickbaitTitleProbabilityThreshold || 1.0;

      if ('manual_clickbait_probability' in contentQuality) {
        delete contentQuality.manual_clickbait_probability;
      } else {
        contentQuality.manual_clickbait_probability =
          clickbaitProbability > clickbaitTitleProbabilityThreshold ? 0 : 1;
      }

      await ctx.con.getRepository(Post).update(
        { id },
        {
          contentQuality,
        },
      );
    },
    startPostBoost: async (
      _,
      args: Pick<StartCampaignArgs, 'budget' | 'duration'> & { postId: string },
      ctx: AuthContext,
    ): Promise<TransactionCreated> => {
      validateCampaignArgs(args);

      return startCampaignPost({
        ctx,
        args: {
          value: args.postId,
          budget: args.budget,
          duration: args.duration,
        },
      });
    },
    cancelPostBoost: async (
      _,
      { postId }: { postId: string },
      ctx: AuthContext,
    ): Promise<TransactionCreated> => {
      const campaign = await ctx.con.getRepository(Campaign).findOneOrFail({
        where: {
          referenceId: postId,
          userId: ctx.userId,
          state: CampaignState.Active,
        },
      });

      return stopCampaignPost({ campaign, ctx });
    },
    checkLinkPreview: async (
      _,
      { url }: SubmitExternalLinkArgs,
      ctx: AuthContext,
    ): Promise<ExternalLinkPreview> => {
      if (!isValidHttpUrl(url)) {
        throw new ValidationError('Invalid URL provided');
      }

      let post = await findPostByUrl(url, ['id', 'title', 'image'], ctx.con);

      if (!post) {
        const preview = await fetchLinkPreview(url);
        // Check again if post exists after following redirects
        if (url !== preview.url && preview.url) {
          post = await findPostByUrl(
            preview.url,
            ['id', 'title', 'image'],
            ctx.con,
          );
        }
        if (!post) {
          return preview;
        }
      }

      const relatedPublicPosts = await ctx.con.getRepository(SharePost).find({
        where: {
          sharedPostId: post.id,
          private: false,
          deleted: false,
          visible: true,
        },
        take: 10,
        order: { createdAt: 'DESC' },
      });

      return {
        id: post.id,
        image: post.image!,
        title: post.title!,
        url,
        relatedPublicPosts,
      };
    },
    submitExternalLink: async (
      _,
      { sourceId, commentary, url, title, image }: SubmitExternalLinkArgs,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      if (!isValidHttpUrl(url)) {
        throw new ValidationError('Invalid URL provided');
      }

      if (sourceId === ctx.userId) {
        await ensureUserSourceExists(ctx.userId, ctx.con);
      }

      await Promise.all([
        ensureSourcePermissions(ctx, sourceId, SourcePermissions.Post),
        ensurePostRateLimit(ctx.con, ctx.userId),
      ]);
      await ctx.con.transaction(async (manager) => {
        const existingPost = await findPostByUrl(
          url,
          ['id', 'visible', 'deleted'],
          ctx.con,
          true,
        );

        if (existingPost) {
          if (existingPost.deleted) {
            throw new ValidationError(SubmissionFailErrorMessage.POST_DELETED);
          }

          await createSharePost({
            con: manager,
            ctx,
            args: {
              sourceId,
              authorId: ctx.userId,
              postId: existingPost.id,
              commentary,
              visible: existingPost.visible,
            },
          });
          return { _: true };
        }

        const { url: cleanUrl, canonicalUrl } = standardizeURL(url);
        await createExternalLink({
          con: manager,
          ctx,
          args: {
            authorId: ctx.userId,
            sourceId,
            url: cleanUrl,
            canonicalUrl,
            title,
            image,
            commentary,
            originalUrl: url,
          },
        });
      });
      return { _: true };
    },
    sharePost: async (
      _,
      {
        id,
        commentary,
        sourceId,
      }: { id: string; commentary: string; sourceId: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLPost> => {
      if (sourceId === ctx.userId) {
        await ensureUserSourceExists(ctx.userId, ctx.con);
      }

      const [post] = await Promise.all([
        ctx.con
          .createQueryBuilder()
          .select(['post.id', 'post.title', 'post.type', 'post.sharedPostId'])
          .from(Post, 'post')
          .where('post.id = :id', { id })
          .getOneOrFail(),
        ensureSourcePermissions(ctx, sourceId, SourcePermissions.Post),
        ensurePostRateLimit(ctx.con, ctx.userId),
      ]);

      const sharedPostId = determineSharedPostId(post);

      const newPost = await createSharePost({
        con: ctx.con,
        ctx,
        args: {
          authorId: ctx.userId,
          sourceId,
          postId: sharedPostId,
          commentary,
        },
      });

      return getPostById(ctx, info, newPost.id);
    },
    editSharePost: async (
      _,
      { id, commentary }: { id: string; commentary: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLPost> => {
      const post = await ctx.con.getRepository(Post).findOneByOrFail({ id });
      validateEditAllowed(post.authorId, ctx.userId);

      await ensureSourcePermissions(ctx, post.sourceId, SourcePermissions.Post);

      const { postId } = await updateSharePost(
        ctx.con,
        ctx.userId,
        id,
        post.sourceId,
        commentary,
      );
      return getPostById(ctx, info, postId);
    },
    viewPost: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const post = await ctx.con.getRepository(Post).findOneByOrFail({ id });
      await ensureSourcePermissions(ctx, post.sourceId);
      if (post.type !== PostType.Article) {
        await notifyView(
          ctx.log,
          post.id,
          ctx.userId,
          ctx.req.headers['referer'],
          new Date(),
          post.tagsStr?.split?.(',') ?? [],
        );
      }
      return { _: true };
    },
    dismissPostFeedback: async (
      source,
      { id }: { id: string },
      ctx: AuthContext,
    ) => {
      try {
        const post = await ctx.con.getRepository(Post).findOneByOrFail({ id });
        await ensureSourcePermissions(ctx, post.sourceId);

        await ctx.con
          .createQueryBuilder(UserPost, 'up')
          .insert()
          .values({
            postId: id,
            userId: ctx.userId,
            flags: {
              feedbackDismiss: true,
            },
          })
          .onConflict(
            `("postId", "userId") DO UPDATE SET flags = up."flags" || excluded.flags`,
          )
          .execute();
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;

        // Foreign key violation
        if (err?.code === TypeOrmError.FOREIGN_KEY) {
          throw new NotFoundError('Post or user not found');
        }

        throw err;
      }

      return { _: true };
    },
    moderateSourcePosts: async (
      _,
      {
        postIds,
        status,
        rejectionReason = null,
        moderatorMessage = null,
      }: {
        postIds: string[];
      } & Pick<
        SourcePostModeration,
        'sourceId' | 'status' | 'rejectionReason' | 'moderatorMessage'
      >,
      ctx: AuthContext,
      info,
    ) => {
      const uniquePostIds = Array.from(new Set(postIds));
      if (!uniquePostIds.length) {
        throw new ValidationError('Invalid array of post IDs provided');
      }

      if (uniquePostIds.length > POST_MODERATION_LIMIT_FOR_MUTATION) {
        logger.warn(
          { postCount: uniquePostIds.length, status },
          'moderation limit reached',
        );
        throw new ValidationError(
          `Maximum of ${POST_MODERATION_LIMIT_FOR_MUTATION} posts can be moderated at once`,
        );
      }

      if (
        ![
          SourcePostModerationStatus.Approved,
          SourcePostModerationStatus.Rejected,
        ].includes(status)
      ) {
        throw new ValidationError('Invalid status provided');
      }

      const canModerate = await canModeratePosts(ctx, uniquePostIds);

      if (!canModerate) {
        throw new ForbiddenError('Access denied!');
      }

      const update: Partial<SourcePostModeration> = {
        status,
        moderatedById: ctx.userId,
      };

      if (status === SourcePostModerationStatus.Rejected) {
        if (!rejectionReason) {
          throw new ValidationError('Rejection reason is required');
        }

        if (rejectionReason?.toLowerCase() === 'other' && !moderatorMessage) {
          throw new ValidationError('Moderator message is required');
        }

        update.rejectionReason = rejectionReason;
        update.moderatorMessage = moderatorMessage;
      }

      await ctx.con
        .getRepository(SourcePostModeration)
        .update(
          { id: In(uniquePostIds), status: SourcePostModerationStatus.Pending },
          update,
        );

      return graphorm.query<GQLSourcePostModeration>(ctx, info, (builder) => ({
        ...builder,
        queryBuilder: builder.queryBuilder.where(
          `"${builder.alias}"."id" IN (:...id) AND "${builder.alias}"."status" = :status`,
          { id: uniquePostIds, status },
        ),
      }));
    },
    deleteSourcePostModeration: async (
      _,
      { postId }: { postId: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const moderation = await ctx.con
        .getRepository(SourcePostModeration)
        .findOneOrFail({
          where: { id: postId },
          select: ['createdById', 'sourceId'],
        });

      await ensureSourcePermissions(
        ctx,
        moderation.sourceId,
        SourcePermissions.PostRequest,
      );

      const isAuthor = moderation.createdById === ctx.userId;

      if (!isAuthor) {
        throw new ForbiddenError('Access denied!');
      }

      await ctx.con.getRepository(SourcePostModeration).delete({ id: postId });

      return { _: true };
    },
    editSourcePostModeration: async (
      _,
      post: CreateSourcePostModerationArgs & { id: string },
      ctx: AuthContext,
      info,
    ): Promise<SourcePostModeration> => {
      await ensureSourcePermissions(
        ctx,
        post.sourceId,
        SourcePermissions.PostRequest,
      );

      const { id } = post;
      const moderation = await ctx.con
        .getRepository(SourcePostModeration)
        .findOneOrFail({
          where: { id },
          select: ['createdById', 'status'],
        });

      const isAuthor = moderation.createdById === ctx.userId;
      const isApproved =
        moderation.status === SourcePostModerationStatus.Approved;

      if (!isAuthor) {
        throw new ForbiddenError('Access denied!');
      }

      if (isApproved) {
        throw new ValidationError('Cannot edit an approved post');
      }

      const pendingPost = await validateSourcePostModeration(ctx, post);

      await ctx.con.getRepository(SourcePostModeration).update(
        { id },
        {
          ...pendingPost,
          status: SourcePostModerationStatus.Pending,
        },
      );

      return graphorm.queryOneOrFail<SourcePostModeration>(
        ctx,
        info,
        (builder) => ({
          ...builder,
          queryBuilder: builder.queryBuilder.where(
            `"${builder.alias}"."id" = :id AND "${builder.alias}"."status" = :status`,
            { id, status: SourcePostModerationStatus.Pending },
          ),
        }),
      );
    },
    generateBriefing: async (
      _,
      { type }: { type: BriefingType },
      ctx: AuthContext,
    ): Promise<{ postId: string; balance?: GetBalanceResult }> => {
      const { isPlus, userId, isTeamMember } = ctx;
      let balance;

      if (isPlus) {
        // No need to check balance or brief cost, just perform the request
        return await requestBriefGeneration(ctx.con, {
          userId,
          type,
          isTeamMember,
        });
      }

      const briefCost = await getBriefGenerationCost(ctx.con, {
        userId,
        type,
      });
      const isFree = briefCost === 0;

      if (!isFree) {
        // perform the transaction then request generation
        const { transfer } = await ctx.con.transaction(
          async (entityManager) => {
            const userTransaction = await entityManager
              .getRepository(UserTransaction)
              .save(
                entityManager.getRepository(UserTransaction).create({
                  id: randomUUID(),
                  processor: UserTransactionProcessor.Njord,
                  receiverId: systemUser.id,
                  status: UserTransactionStatus.Success,
                  productId: null,
                  senderId: userId,
                  value: briefCost,
                  valueIncFees: 0,
                  fee: 0,
                  request: ctx.requestMeta,
                  flags: { note: `Brief generation - ${type}` },
                  referenceId: null,
                  referenceType: UserTransactionType.BriefGeneration,
                }),
              );

            try {
              const transfer = await transferCores({
                ctx,
                transaction: userTransaction,
                entityManager,
              });
              return { transfer };
            } catch (error) {
              if (error instanceof TransferError) {
                await throwUserTransactionError({
                  ctx,
                  entityManager,
                  error,
                  transaction: userTransaction,
                });
              }
              throw error;
            }
          },
        );

        balance = {
          amount: parseBigInt(transfer.senderBalance!.newBalance),
        };
      }

      const result = await requestBriefGeneration(ctx.con, {
        userId,
        type,
        isTeamMember,
      });

      return { ...result, balance };
    },
    createPollPost: async (
      _,
      args: CreatePollPostProps,
      ctx: AuthContext,
      info,
    ): Promise<GQLPost> => {
      const parsedArgs = pollCreationSchema.safeParse(args);

      if (!parsedArgs.success) {
        throw new ValidationError(parsedArgs.error.issues[0].message);
      }

      const sourceCheck =
        args.sourceId === ctx.userId
          ? ensureUserSourceExists(ctx.userId, ctx.con)
          : ensureSourcePermissions(ctx, args.sourceId, SourcePermissions.Post);

      await Promise.all([
        sourceCheck,
        ensurePostRateLimit(ctx.con, ctx.userId),
      ]);

      const id = await generateShortId();

      const savedPost = await createPollPost({
        con: ctx.con,
        ctx,
        args: {
          id,
          title: args.title!,
          sourceId: args.sourceId,
          duration: args.duration,
          authorId: ctx.userId,
          pollOptions: args.options.map((option) =>
            ctx.con.getRepository(PollOption).create({
              text: option.text,
              numVotes: 0,
              order: option.order,
              postId: id!,
            }),
          ),
        },
      });

      return getPostById(ctx, info, savedPost.id);
    },
    votePoll: async (
      _,
      args: { optionId: string; postId: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLPost> => {
      const userPost = await ctx.con.getRepository(UserPost).findOne({
        where: {
          postId: args.postId,
          userId: ctx.userId,
        },
        relations: ['post'],
      });

      let post: PollPost | undefined;
      if (userPost) {
        post = (await userPost.post) as PollPost;
      } else {
        post = await ctx.con.getRepository(PollPost).findOneByOrFail({
          id: args.postId,
        });
      }

      await ensureSourcePermissions(ctx, post.sourceId);

      if (post.endsAt && isBefore(post.endsAt, new Date())) {
        throw new ConflictError('Poll has ended');
      }

      const hasAlreadyVoted = !!userPost?.pollVoteOptionId;

      if (hasAlreadyVoted) {
        throw new ConflictError('User has already voted on this poll');
      }

      await ctx.con.getRepository(UserPost).save({
        userId: ctx.userId,
        postId: args.postId,
        pollVoteOptionId: args.optionId,
      });

      return getPostById(ctx, info, args.postId);
    },
    createMultipleSourcePosts: async (
      _,
      input: CreateMultipleSourcePostProps,
      ctx: AuthContext,
    ): Promise<
      Array<{
        id: string;
        sourceId: string;
        type: MultiplePostItemType;
      }>
    > => {
      const { error: inputErrors, data: args } =
        multipleSourcePostArgsSchema.safeParse(input);

      if (inputErrors) {
        throw new ValidationError(
          `Error '${inputErrors.issues[0].path}': ${inputErrors.issues[0].message}`,
        );
      }

      const { sourceIds, sharedPostId, ...postArgs } = args;
      const isSharingPost = !!sharedPostId;
      const isMultiplePosting = sourceIds.length > 1;

      await ensurePostRateLimit(ctx.con, ctx.userId);

      return await Promise.all(
        sourceIds.map(async (sourceId) => {
          const isSameUserSource = sourceId === ctx.userId;
          if (isSameUserSource) {
            await ensureUserSourceExists(ctx.userId, ctx.con);
          }

          const [source, squadMember] = await Promise.all([
            ctx.con.getRepository(Source).findOneBy({
              id: sourceId,
            }),
            ctx.con.getRepository(SourceMember).findOneBy({
              userId: ctx.userId,
              sourceId,
            }),
          ]);

          if (
            !source ||
            !squadMember ||
            (!isSameUserSource && source?.type !== SourceType.Squad)
          ) {
            throw new ForbiddenError('Access denied!');
          }

          const canUserPostDirectly =
            isSameUserSource ||
            canPostToSquad(source as SquadSource, squadMember);

          if (canUserPostDirectly) {
            // directly post on squad
            if (isSharingPost) {
              await ctx.con
                .getRepository(Post)
                .findOneByOrFail({ id: sharedPostId });
              const { id } = await createSharePost({
                con: ctx.con,
                ctx,
                args: {
                  authorId: ctx.userId,
                  sourceId,
                  postId: sharedPostId,
                  commentary: args.title,
                },
              });
              return { id, sourceId, type: MultiplePostItemType.Post };
            }

            const { id } = await createFreeformPost(ctx, {
              ...postArgs,
              sourceId,
            });
            return { id, sourceId, type: MultiplePostItemType.Post };
          }

          // OR create a pending post instead
          const pendingPost = await validateSourcePostModeration(ctx, {
            ...postArgs,
            sourceId,
            sharedPostId,
            type: sharedPostId ? PostType.Share : PostType.Freeform,
          });
          const { id } = await createSourcePostModeration({
            ctx,
            args: pendingPost,
            options: { isMultiplePosting },
          });
          return {
            id,
            sourceId,
            type: MultiplePostItemType.ModerationItem,
          };
        }),
      );
    },
  },
  Subscription: {
    postsEngaged: {
      subscribe: async (): Promise<
        AsyncIterable<{ postsEngaged: GQLPostNotification }>
      > => {
        const iterator = redisPubSub.asyncIterator<GQLPostNotification>(
          'events.posts.*',
          { pattern: true },
        );

        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => {
                const { done, value } = await iterator.next();
                if (done) {
                  return { done: true, value: undefined };
                }
                return { done: false, value: { postsEngaged: value } };
              },
              return: async () => {
                await iterator.return?.();
                return { done: true, value: undefined };
              },
              throw: async (error: Error) => {
                await iterator.throw?.(error);
                return { done: true, value: undefined };
              },
            };
          },
        };
      },
    },
  },
  Post: {
    contentHtml: (post: GQLPost): GQLPost['contentHtml'] =>
      mapCloudinaryUrl(post.contentHtml),
    image: (post: GQLPost): string | undefined => {
      const image = mapCloudinaryUrl(post.image);
      if (nullableImageType.includes(post.type)) return image;

      return image || pickImageUrl(post);
    },
    permalink: getPostPermalink,
    commentsPermalink: (post: GQLPost): string | undefined =>
      post.slug ? getDiscussionLink(post.slug) : undefined,
    feedMeta: (post: GQLPost): string | undefined => {
      if (post.feedMeta) {
        return Buffer.from(post.feedMeta).toString('base64');
      }
      return undefined;
    },
  },
  LinkPreview: {
    image: (preview: ExternalLinkPreview) =>
      mapCloudinaryUrl(preview.image) ??
      pickImageUrl({ createdAt: new Date() }),
    title: (preview: ExternalLinkPreview) =>
      preview.title?.length ? preview.title : DEFAULT_POST_TITLE,
  },
});
