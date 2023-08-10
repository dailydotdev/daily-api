import {
  Connection as ConnectionRelay,
  ConnectionArguments,
} from 'graphql-relay';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import { DataSource, DeepPartial, EntityManager } from 'typeorm';
import {
  ensureSourcePermissions,
  GQLSource,
  SourcePermissions,
  sourceTypesWithMembers,
} from './sources';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import {
  CreatePost,
  CreatePostArgs,
  DEFAULT_POST_TITLE,
  defaultImage,
  EditablePost,
  EditPostArgs,
  fetchLinkPreview,
  getDiscussionLink,
  isValidHttpUrl,
  notifyView,
  pickImageUrl,
  createFreeformPost,
  standardizeURL,
  updateFlagsStatement,
  uploadPostFile,
  UploadPreset,
  validatePost,
} from '../common';
import {
  ArticlePost,
  createExternalLink,
  createSharePost,
  ExternalLink,
  ExternalLinkPreview,
  FreeformPost,
  HiddenPost,
  Post,
  PostFlagsPublic,
  PostMention,
  PostReport,
  PostType,
  Toc,
  Upvote,
  UserActionType,
  WelcomePost,
} from '../entity';
import { GQLEmptyResponse } from './common';
import {
  NotFoundError,
  SubmissionFailErrorMessage,
  TypeOrmError,
} from '../errors';
import { GQLBookmarkList } from './bookmarks';
import { getMentions, GQLComment } from './comments';
import graphorm from '../graphorm';
import { GQLUser } from './users';
import { redisPubSub } from '../redis';
import { queryPaginatedByDate } from '../common/datePageGenerator';
import { GraphQLResolveInfo } from 'graphql';
import { Roles } from '../roles';
import { markdown, saveMentions } from '../common/markdown';
import { FileUpload } from 'graphql-upload/GraphQLUpload';
import { insertOrIgnoreAction } from './actions';
import { generateShortId, generateUUID } from '../ids';
import { ContentImage } from '../entity';
import { Downvote } from '../entity/Downvote';
import { PostQuestion } from '../entity/posts/PostQuestion';

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
  ratio?: number;
  placeholder?: string;
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
  featuredComments?: GQLComment[];
  deleted?: boolean;
  private: boolean;
  // Used only for pagination (not part of the schema)
  score: number;
  bookmarkedAt: Date;
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
}

interface PinPostArgs {
  id: string;
  pinned: boolean;
}

type GQLPostQuestion = Pick<PostQuestion, 'id' | 'post' | 'question'>;

export type GQLPostNotification = Pick<
  GQLPost,
  'id' | 'numUpvotes' | 'numComments'
>;

export interface GQLPostUpvote {
  createdAt: Date;
  post: GQLPost;
}

export interface GQLPostUpvoteArgs extends ConnectionArguments {
  id: string;
}

export interface SubmitExternalLinkArgs extends ExternalLink {
  sourceId: string;
  commentary: string;
}

export const getPostNotification = async (
  con: DataSource,
  postId: string,
): Promise<GQLPostNotification> => {
  const post = await con
    .getRepository(Post)
    .findOne({ where: { id: postId }, select: ['id', 'upvotes', 'comments'] });
  if (!post) {
    return null;
  }
  return { id: post.id, numUpvotes: post.upvotes, numComments: post.comments };
};

interface ReportPostArgs {
  id: string;
  reason: string;
  comment: string;
  tags?: string[];
}

export const typeDefs = /* GraphQL */ `
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
    Aspect ratio of the image
    """
    ratio: Float @deprecated(reason: "no longer maintained")

    """
    Tiny version of the image in base64
    """
    placeholder: String @deprecated(reason: "no longer maintained")

    """
    Estimation of time to read the article (in minutes)
    """
    readTime: Float

    """
    Source of the post
    """
    source: Source

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
    Permanent link to the comments of the post
    """
    commentsPermalink: String!

    """
    Featured comments for the post
    """
    featuredComments: [Comment!] @deprecated(reason: "no longer maintained")

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

  type Upvote {
    createdAt: DateTime!

    user: User!
    post: Post!
  }

  type UpvoteEdge {
    node: Upvote!

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
  }

  type PostQuestion {
    id: String!
    post: Post!
    question: String!
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

  extend type Query {
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
  }

  extend type Mutation {
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
      Content of the post (max 4000 chars)
      """
      content: String
    ): Post! @auth

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
      Content of the post (max 4000 chars)
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
    Upvote to the post
    """
    upvote(
      """
      Id of the post to upvote
      """
      id: ID!
    ): EmptyResponse @auth

    """
    Cancel an upvote of a post
    """
    cancelUpvote(
      """
      Id of the post
      """
      id: ID!
    ): EmptyResponse @auth

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
    ): EmptyResponse @auth

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
    Downvote to the post
    """
    downvote(
      """
      Id of the post to downvote
      """
      id: ID!
    ): EmptyResponse @auth

    """
    Cancel an downvote of a post
    """
    cancelDownvote(
      """
      Id of the post
      """
      id: ID!
    ): EmptyResponse @auth
  }

  extend type Subscription {
    """
    Get notified when one of the given posts is upvoted or comments
    """
    postsEngaged: PostNotification
  }
`;

const nullableImageType = [PostType.Freeform, PostType.Welcome];

const saveHiddenPost = async (
  con: DataSource,
  hiddenPost: DeepPartial<HiddenPost>,
): Promise<boolean> => {
  try {
    await con.getRepository(HiddenPost).insert(hiddenPost);
  } catch (err) {
    // Foreign key violation
    if (err?.code === TypeOrmError.FOREIGN_KEY) {
      throw new NotFoundError('Post not found');
    }
    // Unique violation
    if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
      throw err;
    }
  }
  return true;
};

const revertPostDownvote = async (
  con: DataSource | EntityManager,
  postId: string,
  userId: string,
): Promise<void> => {
  await con.getRepository(Downvote).delete({
    postId,
    userId,
  });
  await con.getRepository(HiddenPost).delete({ postId, userId });
};

const editablePostTypes = [PostType.Welcome, PostType.Freeform];

export const reportReasons = new Map([
  ['BROKEN', '💔 Link is broken'],
  ['NSFW', '🔞 Post is NSFW'],
  ['CLICKBAIT', '🎣 Clickbait!!!'],
  ['LOW', '💩 Low quality content'],
  ['OTHER', '🤔 Other'],
  ['IRRELEVANT', `Post's tags are irrelevant`],
]);

export const getPostPermalink = (post: Pick<GQLPost, 'shortId'>): string =>
  `${process.env.URL_PREFIX}/r/${post.shortId}`;

export const getPostByUrl = async (
  url: string,
  ctx: Context,
  info: GraphQLResolveInfo,
): Promise<GQLPost> => {
  const res = await graphorm.queryByHierarchy<GQLPost>(
    ctx,
    info,
    ['post'],
    (builder) => ({
      queryBuilder: builder.queryBuilder
        .addSelect(`"${builder.alias}"."deleted"`)
        .where(
          `("${builder.alias}"."canonicalUrl" = :url OR "${builder.alias}"."url" = :url)`,
          { url },
        )
        .limit(1),
      ...builder,
    }),
  );

  return res[0];
};

const updatePromoteToPublicFlag = async (
  ctx: Context,
  id: string,
  value: number,
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
    queryBuilder: builder.queryBuilder.where(
      `"${builder.alias}"."id" = :id AND "${builder.alias}"."deleted" = false`,
      { id },
    ),
    ...builder,
  }));
  if (res.length) {
    return res[0];
  }
  throw new NotFoundError('Post not found');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  Query: traceResolverObject({
    post: async (
      source,
      { id }: { id: string },
      ctx: Context,
      info,
    ): Promise<GQLPost> => {
      const partialPost = await ctx.con.getRepository(Post).findOneOrFail({
        select: ['id', 'sourceId', 'private'],
        relations: ['source'],
        where: { id },
      });
      const postSource = await partialPost.source;

      if (
        partialPost.private ||
        sourceTypesWithMembers.includes(postSource.type)
      ) {
        await ensureSourcePermissions(ctx, partialPost.sourceId);
      }
      return getPostById(ctx, info, id);
    },
    postByUrl: async (
      source,
      { url }: { id: string; url: string },
      ctx: Context,
      info,
    ): Promise<GQLPost> => {
      const standardizedUrl = standardizeURL(url);
      const res = await graphorm.query(ctx, info, (builder) => ({
        queryBuilder: builder.queryBuilder
          .where(
            `("${builder.alias}"."canonicalUrl" = :url OR "${builder.alias}"."url" = :url) AND "${builder.alias}"."deleted" = false`,
            { url: standardizedUrl },
          )
          .limit(1),
        ...builder,
      }));
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
      ctx,
      info,
    ): Promise<ConnectionRelay<GQLPostUpvote>> => {
      const post = await ctx.con
        .getRepository(Post)
        .findOneByOrFail({ id: args.id });
      await ensureSourcePermissions(ctx, post.sourceId);
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt' },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}.postId = :postId`,
              { postId: args.id },
            );

            return builder;
          },
          orderByKey: 'DESC',
        },
      );
    },
    searchQuestionRecommendations: async (
      source,
      _,
      ctx: Context,
      info,
    ): Promise<GQLPostQuestion[]> =>
      graphorm.query(ctx, info, (builder) => ({
        queryBuilder: builder.queryBuilder
          .innerJoin(
            (query) =>
              query
                .select('u."postId"')
                .from(Upvote, 'u')
                .where({ userId: ctx.userId })
                .orderBy('u."createdAt"', 'DESC')
                .limit(5),
            'upvoted',
            `"${builder.alias}"."postId" = upvoted."postId"`,
          )
          .orderBy('random()', 'DESC')
          .limit(3),
        ...builder,
      })),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Mutation: traceResolverObject<any, any>({
    hidePost: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await saveHiddenPost(ctx.con, { userId: ctx.userId, postId: id });
      return { _: true };
    },
    unhidePost: async (
      _,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con
        .getRepository(HiddenPost)
        .delete({ postId: id, userId: ctx.userId });
      return { _: true };
    },
    reportPost: async (
      source,
      { id, reason, comment, tags }: ReportPostArgs,
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      if (!reportReasons.has(reason)) {
        throw new ValidationError('Reason is invalid');
      }

      if (reason === 'IRRELEVANT' && !tags?.length) {
        throw new ValidationError('You must include the irrelevant tags!');
      }

      const added = await saveHiddenPost(ctx.con, {
        userId: ctx.userId,
        postId: id,
      });
      if (added) {
        const post = await ctx.getRepository(Post).findOneByOrFail({ id });
        await ensureSourcePermissions(ctx, post.sourceId);
        if (!post.banned) {
          try {
            await ctx.getRepository(PostReport).insert({
              postId: id,
              userId: ctx.userId,
              reason,
              comment,
              tags,
            });
          } catch (err) {
            if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
              throw new Error('Failed to save report to database');
            }
          }
        }
      }
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
      return imageUrl;
    },
    deletePost: async (
      _,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      if (ctx.roles.includes(Roles.Moderator)) {
        await ctx.getRepository(Post).update(
          { id },
          {
            deleted: true,
            flags: updateFlagsStatement<Post>({ deleted: true }),
          },
        );
        return { _: true };
      }

      await ctx.con.transaction(async (manager) => {
        const repo = manager.getRepository(Post);
        const post = await repo.findOneBy({ id });
        if (post.authorId !== ctx.userId) {
          await ensureSourcePermissions(
            ctx,
            post.sourceId,
            SourcePermissions.PostDelete,
          );
        }
        await repo.update(
          { id },
          {
            deleted: true,
            flags: updateFlagsStatement<Post>({ deleted: true }),
          },
        );
      });

      return { _: true };
    },
    promoteToPublic: async (
      _,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const timeToSeconds = Math.floor(nextWeek.valueOf() / 1000);
      return updatePromoteToPublicFlag(ctx, id, timeToSeconds);
    },
    demoteFromPublic: async (
      _,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => updatePromoteToPublicFlag(ctx, id, null),
    updatePinPost: async (
      _,
      { id, pinned }: PinPostArgs,
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (manager) => {
        const repo = manager.getRepository(Post);
        const post = await repo.findOneBy({ id });

        await ensureSourcePermissions(
          ctx,
          post.sourceId,
          SourcePermissions.PostPin,
        );

        await repo.update({ id }, { pinnedAt: pinned ? new Date() : null });
      });

      return { _: true };
    },
    createFreeformPost: async (
      source,
      args: CreatePostArgs,
      ctx: Context,
      info,
    ): Promise<GQLPost> => {
      const { sourceId, image } = args;
      const { con, userId } = ctx;
      const id = await generateShortId();
      const { title, content } = validatePost(args);

      if (!title) {
        throw new ValidationError('Title can not be an empty string!');
      }

      await con.transaction(async (manager) => {
        await ensureSourcePermissions(ctx, sourceId, SourcePermissions.Post);

        const mentions = await getMentions(manager, content, userId, sourceId);
        const contentHtml = markdown.render(content, { mentions });
        const params: CreatePost = {
          id,
          title,
          content,
          contentHtml,
          authorId: userId,
          sourceId,
        };

        if (image && process.env.CLOUDINARY_URL) {
          const upload = await image;
          const { url: coverImageUrl } = await uploadPostFile(
            id,
            upload.createReadStream(),
            UploadPreset.PostBannerImage,
          );
          params.image = coverImageUrl;
        }

        await createFreeformPost(manager, params);
        await saveMentions(manager, id, userId, mentions, PostMention);
      });

      return graphorm.queryOneOrFail<GQLPost>(ctx, info, (builder) => ({
        queryBuilder: builder.queryBuilder.where(
          `"${builder.alias}"."id" = :id`,
          { id },
        ),
        ...builder,
      }));
    },
    editPost: async (
      source,
      args: EditPostArgs,
      ctx: Context,
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

        const updated: Partial<EditablePost> = {};

        if (title && title !== post.title) {
          updated.title = title;
        }

        if (image && process.env.CLOUDINARY_URL) {
          const upload = await image;
          const { url: coverImageUrl } = await uploadPostFile(
            id,
            upload.createReadStream(),
            UploadPreset.PostBannerImage,
            { invalidate: true },
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
          await repo.update({ id }, updated);
        }
      });

      return graphorm.queryOneOrFail<GQLPost>(ctx, info, (builder) => ({
        queryBuilder: builder.queryBuilder.where(
          `"${builder.alias}"."id" = :id`,
          { id },
        ),
        ...builder,
      }));
    },
    banPost: async (
      source,
      { id }: { id: string },
      ctx: Context,
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
    upvote: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      try {
        const post = await ctx.con.getRepository(Post).findOneByOrFail({ id });
        await ensureSourcePermissions(ctx, post.sourceId);
        await ctx.con.transaction(async (entityManager) => {
          await entityManager.getRepository(Upvote).insert({
            postId: id,
            userId: ctx.userId,
          });

          await revertPostDownvote(entityManager, id, ctx.userId);
        });
      } catch (err) {
        // Foreign key violation
        if (err?.code === TypeOrmError.FOREIGN_KEY) {
          throw new NotFoundError('Post or user not found');
        }
        // Unique violation
        if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
          throw err;
        }
      }
      return { _: true };
    },
    cancelUpvote: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (entityManager) => {
        await entityManager.getRepository(Upvote).delete({
          postId: id,
          userId: ctx.userId,
        });
      });
      return { _: true };
    },
    checkLinkPreview: async (
      _,
      { url }: SubmitExternalLinkArgs,
      ctx,
    ): Promise<ExternalLinkPreview> => {
      const standardizedUrl = standardizeURL(url);
      const post = await ctx.con
        .getRepository(ArticlePost)
        .createQueryBuilder()
        .select('id, title, image')
        .where([{ canonicalUrl: standardizedUrl }, { url: standardizedUrl }])
        .andWhere({ deleted: false })
        .getRawOne();

      if (!post) {
        return fetchLinkPreview(standardizedUrl);
      }

      return post;
    },
    submitExternalLink: async (
      _,
      { sourceId, commentary, url, title, image }: SubmitExternalLinkArgs,
      ctx,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (manager) => {
        await ensureSourcePermissions(ctx, sourceId, SourcePermissions.Post);
        const cleanUrl = standardizeURL(url);
        if (!isValidHttpUrl(cleanUrl)) {
          throw new ValidationError('URL is not valid');
        }

        const existingPost: Pick<ArticlePost, 'id' | 'deleted' | 'visible'> =
          await manager.getRepository(ArticlePost).findOne({
            select: ['id', 'deleted', 'visible'],
            where: [{ url: cleanUrl }, { canonicalUrl: cleanUrl }],
          });
        if (existingPost) {
          if (existingPost.deleted) {
            throw new ValidationError(SubmissionFailErrorMessage.POST_DELETED);
          }

          await createSharePost(
            manager,
            sourceId,
            ctx.userId,
            existingPost.id,
            commentary,
            existingPost.visible,
          );
          return { _: true };
        }
        await createExternalLink(
          manager,
          ctx.log,
          sourceId,
          ctx.userId,
          { url, title, image },
          commentary,
        );
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
      ctx,
      info,
    ): Promise<GQLPost> => {
      await ctx.con.getRepository(Post).findOneByOrFail({ id });
      await ensureSourcePermissions(ctx, sourceId, SourcePermissions.Post);

      const newPost = await createSharePost(
        ctx.con,
        sourceId,
        ctx.userId,
        id,
        commentary,
      );
      return getPostById(ctx, info, newPost.id);
    },
    viewPost: async (
      _,
      { id }: { id: string },
      ctx,
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
    downvote: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      try {
        const post = await ctx.con.getRepository(Post).findOneByOrFail({ id });
        await ensureSourcePermissions(ctx, post.sourceId);
        await ctx.con.transaction(async (entityManager) => {
          await entityManager.getRepository(Downvote).insert({
            postId: id,
            userId: ctx.userId,
          });

          await saveHiddenPost(entityManager.connection, {
            userId: ctx.userId,
            postId: id,
          });

          await entityManager.getRepository(Upvote).delete({
            postId: id,
            userId: ctx.userId,
          });
        });
      } catch (err) {
        // Foreign key violation
        if (err?.code === TypeOrmError.FOREIGN_KEY) {
          throw new NotFoundError('Post or user not found');
        }
        // Unique violation
        if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
          throw err;
        }
      }
      return { _: true };
    },
    cancelDownvote: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (entityManager) => {
        await revertPostDownvote(entityManager, id, ctx.userId);
      });
      return { _: true };
    },
  }),
  Subscription: {
    postsEngaged: {
      subscribe: async (): Promise<
        AsyncIterator<{ postsEngaged: GQLPostNotification }>
      > => {
        const it = {
          [Symbol.asyncIterator]: () =>
            redisPubSub.asyncIterator<GQLPostNotification>('events.posts.*', {
              pattern: true,
            }),
        };
        return (async function* () {
          for await (const value of it) {
            yield { postsEngaged: value };
          }
        })();
      },
    },
  },
  Post: {
    image: (post: GQLPost): string => {
      if (nullableImageType.includes(post.type)) return post.image;

      return post.image || pickImageUrl(post);
    },
    placeholder: (post: GQLPost): string =>
      post.image ? post.placeholder : defaultImage.placeholder,
    ratio: (post: GQLPost): number =>
      post.image ? post.ratio : defaultImage.ratio,
    permalink: getPostPermalink,
    commentsPermalink: (post: GQLPost): string => getDiscussionLink(post.id),
    feedMeta: (post: GQLPost): string => {
      if (post.feedMeta) {
        return Buffer.from(post.feedMeta).toString('base64');
      }
      return undefined;
    },
  },
  LinkPreview: {
    image: (preview: ExternalLinkPreview) =>
      preview.image ?? pickImageUrl({ createdAt: new Date() }),
    title: (preview: ExternalLinkPreview) =>
      preview.title?.length ? preview.title : DEFAULT_POST_TITLE,
  },
};
