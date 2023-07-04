import { GraphQLResolveInfo } from 'graphql';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import {
  getDiscussionLink,
  recommendUsersByQuery,
  recommendUsersToMention,
} from '../common';
import {
  Comment,
  CommentUpvote,
  CommentMention,
  Post,
  Source,
  SourceMember,
  SourceType,
  User,
} from '../entity';
import { NotFoundError, TypeOrmError } from '../errors';
import { GQLEmptyResponse } from './common';
import { GQLUser } from './users';
import { Connection, ConnectionArguments } from 'graphql-relay';
import graphorm from '../graphorm';
import { GQLPost } from './posts';
import { Roles } from '../roles';
import { queryPaginatedByDate } from '../common/datePageGenerator';
import {
  markdown,
  mentionSpecialCharacters,
  saveMentions,
} from '../common/markdown';
import { ensureSourcePermissions, SourcePermissions } from './sources';
import { generateShortId } from '../ids';
import { CommentReport } from '../entity/CommentReport';

export interface GQLComment {
  id: string;
  postId: string;
  content: string;
  contentHtml: string;
  createdAt: Date;
  author?: GQLUser;
  upvoted?: boolean;
  children?: Connection<GQLComment>;
  post: GQLPost;
  numUpvotes: number;
}

interface GQLMentionUserArgs {
  postId?: string;
  query?: string;
  limit?: number;
  sourceId?: string;
}

interface GQLCommentPreviewArgs {
  content: string;
  sourceId?: string;
}

interface GQLPostCommentArgs {
  postId: string;
  content: string;
}

interface GQLCommentCommentArgs {
  commentId: string;
  content: string;
}

export interface GQLCommentUpvote {
  createdAt: Date;
  comment: GQLComment;
}

interface ReportCommentArgs {
  commentId: string;
  note: string;
  reason: string;
}

export const typeDefs = /* GraphQL */ `
  type Comment {
    """
    Unique identifier
    """
    id: ID!

    """
    Content of the comment
    """
    content: String!

    """
    HTML Parsed content of the comment
    """
    contentHtml: String!

    """
    Time when comment was created
    """
    createdAt: DateTime!

    """
    Time when comment was last updated (edited)
    """
    lastUpdatedAt: DateTime

    """
    Permanent link to the comment
    """
    permalink: String!

    """
    Author of this comment
    """
    author: User!

    """
    Whether the user upvoted this comment
    """
    upvoted: Boolean

    """
    Sub comments of this comment
    """
    children: CommentConnection

    """
    The post that was commented
    """
    post: Post!

    """
    Total number of upvotes
    """
    numUpvotes: Int!
  }

  type CommentEdge {
    node: Comment!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type CommentConnection {
    pageInfo: PageInfo!
    edges: [CommentEdge!]!
  }

  type CommentUpvote {
    createdAt: DateTime!

    user: User!
    comment: Comment!
  }

  type CommentUpvoteEdge {
    node: CommentUpvote!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type CommentUpvoteConnection {
    pageInfo: PageInfo!
    edges: [CommentUpvoteEdge!]!
  }

  """
  Enum of the possible reasons to report a comment
  """
  enum ReportCommentReason {
    """
    The comment is hateful
    """
    HATEFUL
    """
    The comment is in any form of bullying or harassment
    """
    HARASSMENT
    """
    The comment is a spam or a scam
    """
    SPAM
    """
    The comment contains any sexual or explicit content
    """
    EXPLICIT
    """
    The comment contains incorrect information
    """
    MISINFORMATION
    """
    Reason doesnt fit any specific category
    """
    OTHER
  }

  extend type Query {
    """
    Get the comments of a post
    """
    postComments(
      """
      Post id
      """
      postId: ID!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): CommentConnection!

    """
    Get Comment's Upvotes by post id
    """
    commentUpvotes(
      """
      Id of the relevant comment to return Upvotes
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
    ): CommentUpvoteConnection!

    """
    Get the comments of a user
    """
    userComments(
      """
      User id (author)
      """
      userId: ID!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): CommentConnection!

    """
    Recommend users to mention in the comments
    """
    recommendedMentions(
      postId: String
      query: String
      limit: Int
      sourceId: String
    ): [User] @auth

    """
    Markdown equivalent of the user's comment
    """
    commentPreview(content: String!, sourceId: String): String @auth
  }

  extend type Mutation {
    """
    Comment on a post
    """
    commentOnPost(
      """
      Id of the post
      """
      postId: ID!
      """
      Content of the comment
      """
      content: String!
    ): Comment @auth

    """
    Comment on a comment
    """
    commentOnComment(
      """
      Id of the comment
      """
      commentId: ID!
      """
      Content of the comment
      """
      content: String!
    ): Comment @auth

    """
    Edit comment
    """
    editComment(
      """
      Id of the comment to edit
      """
      id: ID!
      """
      New content of the comment
      """
      content: String!
    ): Comment @auth

    """
    Delete a comment
    """
    deleteComment(
      """
      Id of the comment
      """
      id: ID!
    ): EmptyResponse @auth

    """
    Report a comment from a post
    """
    reportComment(
      """
      Id of the comment to report
      """
      commentId: ID!
      """
      Reason the user would like to report
      """
      reason: ReportCommentReason
      """
      Additional comment about report reason
      """
      note: String
    ): EmptyResponse @auth

    """
    Upvote to a comment
    """
    upvoteComment(
      """
      Id of the comment to upvote
      """
      id: ID!
    ): EmptyResponse @auth

    """
    Cancel an upvote of a comment
    """
    cancelCommentUpvote(
      """
      Id of the comment
      """
      id: ID!
    ): EmptyResponse @auth
  }
`;

export interface GQLPostCommentsArgs extends ConnectionArguments {
  postId: string;
}

export interface GQLCommentUpvoteArgs extends ConnectionArguments {
  id: string;
}

export interface GQLUserCommentsArgs extends ConnectionArguments {
  userId: string;
}

export interface MentionedUser {
  id: string;
  username?: string;
}

export const getMentions = async (
  con: DataSource | EntityManager,
  content: string,
  userId: string,
  sourceId?: string,
): Promise<MentionedUser[]> => {
  if (!content?.length) return [];
  const replaced = content.replace(mentionSpecialCharacters, ' ');
  const words = replaced.split(' ');
  const result = words.reduce((list, word) => {
    if (word.length === 1 || word.charAt(0) !== '@') {
      return list;
    }

    return list.concat(word.substring(1));
  }, []);

  if (result.length === 0) {
    return [];
  }

  const repo = con.getRepository(User);
  const getUsers = () =>
    repo.find({ where: { username: In(result), id: Not(userId) } });

  if (!sourceId) {
    return getUsers();
  }

  const source = await con.getRepository(Source).findOneBy({ id: sourceId });

  if (!source.private) {
    return getUsers();
  }

  return repo
    .createQueryBuilder('u')
    .select('u.id, u.username')
    .innerJoin(SourceMember, 'sm', 'u.id = sm."userId"')
    .where('sm."sourceId" = :sourceId', { sourceId })
    .andWhere('u.username IN (:...usernames)', { usernames: result })
    .andWhere('u.id != :id', { id: userId })
    .getRawMany();
};

export const saveComment = async (
  con: DataSource | EntityManager,
  comment: Comment,
  sourceId?: string,
): Promise<Comment> => {
  const mentions = await getMentions(
    con,
    comment.content,
    comment.userId,
    sourceId,
  );
  const contentHtml = markdown.render(comment.content, { mentions });
  comment.contentHtml = contentHtml;
  const savedComment = await con.getRepository(Comment).save(comment);
  await saveMentions(
    con,
    savedComment.id,
    savedComment.userId,
    mentions,
    CommentMention,
  );

  return savedComment;
};

export const updateMentions = async (
  con: EntityManager,
  oldUsername: string,
  newUsername: string,
  commentIds: string[],
): Promise<unknown[]> => {
  const comments = await con
    .getRepository(Comment)
    .find({ where: { id: In(commentIds) } });
  const updated = comments.map((comment) => {
    const content = comment.content
      .split(' ')
      .map((word) => (word === `@${oldUsername}` ? `@${newUsername}` : word))
      .join(' ');
    comment.content = content;

    return comment;
  });

  return Promise.all(updated.map((comment) => saveComment(con, comment)));
};

const saveNewComment = async (
  con: DataSource | EntityManager,
  comment: Comment,
  sourceId?: string,
) => {
  const savedComment = await saveComment(con, comment, sourceId);

  await con
    .getRepository(Post)
    .increment({ id: savedComment.postId }, 'comments', 1);

  if (savedComment.parentId) {
    await con
      .getRepository(Comment)
      .increment({ id: savedComment.parentId }, 'comments', 1);
  }

  return savedComment;
};

const getCommentById = async (
  id: string,
  ctx: Context,
  info: GraphQLResolveInfo,
): Promise<GQLComment> => {
  const res = await graphorm.query<GQLComment>(ctx, info, (builder) => {
    builder.queryBuilder = builder.queryBuilder
      .andWhere(`${builder.alias}.id = :id`, { id })
      .limit(1);
    return builder;
  });
  return res[0];
};

export const reportCommentReasons = new Map([
  ['HATEFUL', 'Hateful or Offensive Content'],
  ['HARASSMENT', 'Harassment or Bullying'],
  ['SPAM', 'Spam or Scams'],
  ['EXPLICIT', 'Explicit Sexual Content'],
  ['MISINFORMATION', 'False Information or Misinformation'],
  ['OTHER', 'Other'],
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Query: traceResolverObject<any, any>({
    postComments: async (
      _,
      args: GQLPostCommentsArgs,
      ctx,
      info,
    ): Promise<Connection<GQLComment>> => {
      const post = await ctx.con
        .getRepository(Post)
        .findOneByOrFail({ id: args.postId });
      await ensureSourcePermissions(ctx, post.sourceId);
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt', maxSize: 500 },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder
              .andWhere(`${builder.alias}.postId = :postId`, {
                postId: args.postId,
              })
              .andWhere(`${builder.alias}.parentId is null`);

            return builder;
          },
        },
      );
    },
    userComments: async (
      _,
      args: GQLUserCommentsArgs,
      ctx,
      info,
    ): Promise<Connection<GQLComment>> => {
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt' },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder
              .andWhere(`${builder.alias}."userId" = :userId`, {
                userId: args.userId,
              })
              .innerJoin(Post, 'p', `"${builder.alias}"."postId" = p.id`)
              .innerJoin(Source, 's', `"p"."sourceId" = s.id`)
              .andWhere(`s.private = false`)
              .andWhere('p.visible = true')
              .andWhere('p.deleted = false');

            return builder;
          },
          orderByKey: 'DESC',
        },
      );
    },
    commentUpvotes: async (
      _,
      args: GQLCommentUpvoteArgs,
      ctx,
      info,
    ): Promise<Connection<GQLCommentUpvote>> => {
      const comment = await ctx.con.getRepository(Comment).findOneOrFail({
        where: { id: args.id },
        relations: ['post'],
      });
      const post = await comment.post;
      await ensureSourcePermissions(ctx, post.sourceId);
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt' },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}.commentId = :commentId`,
              { commentId: args.id },
            );

            return builder;
          },
          orderByKey: 'DESC',
        },
      );
    },
    recommendedMentions: async (
      _,
      { postId, query, limit = 5, sourceId }: GQLMentionUserArgs,
      ctx,
      info,
    ): Promise<User[]> => {
      const { con, userId } = ctx;
      const ids = await (query
        ? recommendUsersByQuery(con, userId, { query, limit, sourceId })
        : recommendUsersToMention(con, userId, { limit, postId, sourceId }));

      if (ids.length === 0) {
        return [];
      }

      return graphorm.query(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder
          .where(`"${builder.alias}".id IN (:...ids)`, { ids })
          .orderBy(`"${builder.alias}".name`)
          .limit(limit);

        return builder;
      });
    },
    commentPreview: async (
      _,
      { content, sourceId }: GQLCommentPreviewArgs,
      ctx,
    ): Promise<string> => {
      const trimmed = content.trim();

      if (trimmed.length === 0) {
        return '';
      }

      const mentions = await getMentions(
        ctx.con,
        trimmed,
        ctx.userId,
        sourceId,
      );

      if (!mentions?.length) {
        return markdown.render(trimmed);
      }

      return markdown.render(trimmed, { mentions });
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Mutation: traceResolverObject<any, any>({
    commentOnPost: async (
      source,
      { postId, content }: GQLPostCommentArgs,
      ctx: Context,
      info,
    ): Promise<GQLComment> => {
      if (!content.trim().length) {
        throw new ValidationError('Content cannot be empty!');
      }

      try {
        const post = await ctx.con
          .getRepository(Post)
          .findOneByOrFail({ id: postId });
        const source = await ensureSourcePermissions(ctx, post.sourceId);
        const squadId =
          source.type === SourceType.Squad ? source.id : undefined;
        const comment = await ctx.con.transaction(async (entityManager) => {
          const createdComment = entityManager.getRepository(Comment).create({
            id: await generateShortId(),
            postId,
            userId: ctx.userId,
            content,
          });

          return saveNewComment(entityManager, createdComment, squadId);
        });
        return getCommentById(comment.id, ctx, info);
      } catch (err) {
        // Foreign key violation
        if (err?.code === TypeOrmError.FOREIGN_KEY) {
          throw new NotFoundError('Post or user not found');
        }
        throw err;
      }
    },
    commentOnComment: async (
      source,
      { commentId, content }: GQLCommentCommentArgs,
      ctx: Context,
      info,
    ): Promise<GQLComment> => {
      if (!content.trim().length) {
        throw new ValidationError('Content cannot be empty!');
      }

      try {
        const comment = await ctx.con.transaction(async (entityManager) => {
          const parentComment = await ctx.con
            .getRepository(Comment)
            .findOneOrFail({
              where: { id: commentId },
              relations: ['post'],
            });
          const post = await parentComment.post;
          const source = await ensureSourcePermissions(ctx, post.sourceId);
          if (parentComment.parentId) {
            throw new ForbiddenError('Cannot comment on a sub-comment');
          }
          const squadId =
            source.type === SourceType.Squad ? source.id : undefined;
          const createdComment = entityManager.getRepository(Comment).create({
            id: await generateShortId(),
            postId: parentComment.postId,
            userId: ctx.userId,
            parentId: commentId,
            content,
          });

          return saveNewComment(entityManager, createdComment, squadId);
        });
        return getCommentById(comment.id, ctx, info);
      } catch (err) {
        // Foreign key violation
        if (err?.code === TypeOrmError.FOREIGN_KEY) {
          throw new NotFoundError('User or parent comment not found');
        }
        throw err;
      }
    },
    editComment: async (
      _,
      { id, content }: { id: string; content: string },
      ctx: Context,
      info,
    ): Promise<GQLComment> => {
      if (!content.trim().length) {
        throw new ValidationError('Content cannot be empty!');
      }

      await ctx.con.transaction(async (entityManager) => {
        const repo = entityManager.getRepository(Comment);
        const comment = await repo.findOneByOrFail({ id });
        if (comment.userId !== ctx.userId) {
          throw new ForbiddenError("Cannot edit someone else's comment");
        }
        const post = await comment.post;
        const source = await post.source;
        const squadId =
          source.type === SourceType.Squad ? source.id : undefined;
        comment.content = content;
        comment.lastUpdatedAt = new Date();
        await saveComment(entityManager, comment, squadId);
      });
      return getCommentById(id, ctx, info);
    },
    deleteComment: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (entityManager) => {
        const repo = entityManager.getRepository(Comment);
        const comment = await ctx.con.getRepository(Comment).findOneOrFail({
          where: { id },
          relations: ['post'],
        });
        const post = await comment.post;
        if (
          comment.userId !== ctx.userId &&
          ctx.roles.indexOf(Roles.Moderator) < 0 &&
          !(await ensureSourcePermissions(
            ctx,
            post.sourceId,
            SourcePermissions.CommentDelete,
          ))
        ) {
          throw new ForbiddenError("Cannot delete someone else's comment");
        }
        if (comment.parentId) {
          await repo.decrement({ id: comment.parentId }, 'comments', 1);
        }
        const childComments = await entityManager
          .getRepository(Comment)
          .countBy({ parentId: comment.id });
        await entityManager
          .getRepository(Post)
          .decrement({ id: comment.postId }, 'comments', 1 + childComments);
        await repo.delete({ id: comment.id });
      });
      return { _: true };
    },
    reportComment: async (
      source,
      { commentId: id, reason, note }: ReportCommentArgs,
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      if (!reportCommentReasons.has(reason)) {
        throw new ValidationError('Reason is invalid');
      }

      await ctx
        .getRepository(Comment)
        .findOneOrFail({ where: { id }, select: ['id'] });

      try {
        await ctx.getRepository(CommentReport).insert({
          commentId: id,
          userId: ctx.userId,
          reason,
          note,
        });
      } catch (err) {
        if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
          ctx.log.error({ err }, 'failed to save report to database');
        }
      }

      return { _: true };
    },
    upvoteComment: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      try {
        const comment = await ctx.con.getRepository(Comment).findOneOrFail({
          where: { id },
          relations: ['post'],
        });
        const post = await comment.post;
        await ensureSourcePermissions(ctx, post.sourceId);
        await ctx.con.transaction(async (entityManager) => {
          await entityManager.getRepository(CommentUpvote).insert({
            commentId: id,
            userId: ctx.userId,
          });
          await entityManager
            .getRepository(Comment)
            .increment({ id }, 'upvotes', 1);
        });
      } catch (err) {
        // Foreign key violation
        if (err?.code === TypeOrmError.FOREIGN_KEY) {
          throw new NotFoundError('Comment or user not found');
        }
        // Unique violation
        if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
          throw err;
        }
      }
      return { _: true };
    },
    cancelCommentUpvote: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (entityManager): Promise<boolean> => {
        const upvote = await entityManager
          .getRepository(CommentUpvote)
          .findOneBy({
            commentId: id,
            userId: ctx.userId,
          });
        if (upvote) {
          await entityManager.getRepository(CommentUpvote).delete({
            commentId: id,
            userId: ctx.userId,
          });
          await entityManager
            .getRepository(Comment)
            .decrement({ id }, 'upvotes', 1);
          return true;
        }
        return false;
      });
      return { _: true };
    },
  }),
  Comment: {
    permalink: (comment: GQLComment): string =>
      getDiscussionLink(comment.postId),
  },
};
