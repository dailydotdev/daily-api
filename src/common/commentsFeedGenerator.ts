import { SelectQueryBuilder } from 'typeorm';
import { Comment, CommentUpvote, User } from '../entity';
import { GQLComment } from '../schema/comments';
import { connectionFromNodes, Page, PageGenerator } from '../schema/common';
import { ConnectionArguments } from 'graphql-relay';
import { getCursorFromAfter } from './pagination';
import { base64 } from './base64';

export const selectUpvoted = (
  userId: string,
  builder: SelectQueryBuilder<Comment>,
  alias = 'comment',
): string => {
  const query = builder
    .select('1')
    .from(CommentUpvote, 'upvote')
    .where(`upvote.userId = :userId`, { userId })
    .andWhere(`upvote.commentId = ${alias}.id`)
    .getQuery();
  return `EXISTS${query}`;
};

export const selectAuthor = (
  builder: SelectQueryBuilder<Comment>,
): SelectQueryBuilder<User> =>
  builder
    .select(`to_jsonb(u)`, 'author')
    .from(User, 'u')
    .where('u.id = comment.userId')
    .limit(1);

export const selectChildren = (
  builder: SelectQueryBuilder<Comment>,
  limit: number,
  userId?: string,
): SelectQueryBuilder<Comment> =>
  builder.select(`coalesce(jsonb_agg(res), '[]'::jsonb)`, 'children').from(
    (builder) =>
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      selectComments(builder, 0, userId, 'child')
        .where('child.parentId = comment.id')
        .limit(limit),
    'res',
  );

export const selectComments = (
  builder: SelectQueryBuilder<Comment>,
  limitChildren: number,
  userId?: string,
  alias = 'comment',
): SelectQueryBuilder<Comment> => {
  let newBuilder = builder
    .from(Comment, alias)
    .select(`${alias}.id`, 'id')
    .addSelect(`${alias}.content`, 'content')
    .addSelect(`${alias}.postId`, 'postId')
    .addSelect(`${alias}.createdAt`, 'createdAt')
    .addSelect(selectAuthor)
    .orderBy(`${alias}.createdAt`, 'DESC');
  if (userId) {
    newBuilder = newBuilder.addSelect(
      selectUpvoted(userId, newBuilder.subQuery(), alias),
      'upvoted',
    );
  }
  if (limitChildren) {
    newBuilder = newBuilder.addSelect((builder) =>
      selectChildren(builder, limitChildren, userId),
    );
  }
  return newBuilder;
};

export interface CommentsPage extends Page {
  timestamp?: Date;
}

export const commentsPageGenerator: PageGenerator<
  GQLComment,
  ConnectionArguments,
  CommentsPage
> = {
  connArgsToPage: ({ first, after }: ConnectionArguments) => {
    const cursor = getCursorFromAfter(after);
    const limit = Math.min(first || 30, 50);
    if (cursor) {
      return { limit, timestamp: new Date(parseInt(cursor)) };
    }
    return { limit };
  },
  nodeToCursor: (page, _, node) => base64(`time:${node.createdAt.getTime()}`),
  hasNextPage: (page, nodesSize) => page.limit === nodesSize,
  hasPreviousPage: (page) => !!page.timestamp,
};

interface RawChildren extends Omit<GQLComment, 'children' | 'createdAt'> {
  createdAt: string;
}

interface RawComment extends Omit<GQLComment, 'children'> {
  children: RawChildren[];
}

export const mapRawComment = (
  comment: RawComment,
  limitChildren: number,
): GQLComment => ({
  ...comment,
  children: connectionFromNodes(
    { first: limitChildren },
    comment.children.map((child) => ({
      ...child,
      createdAt: new Date(child.createdAt),
    })),
    {},
    commentsPageGenerator.connArgsToPage({ first: limitChildren }),
    commentsPageGenerator,
  ),
});
