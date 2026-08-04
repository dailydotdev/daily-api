import { Type } from 'typebox';
import type { EntityManager } from 'typeorm';
import { Comment } from '../../../entity/Comment';
import { Post } from '../../../entity/posts/Post';
import { User } from '../../../entity/user/User';
import { queryReadReplica } from '../../queryReadReplica';
import type { InterestToolContext } from './context';
import {
  DEFAULT_COMMENT_LIMIT,
  MAX_COMMENT_CHARS,
  MAX_COMMENT_LENGTH,
  MAX_COMMENT_LIMIT,
  MAX_REPLIES_PER_PARENT,
  budgetError,
  jsonResult,
} from './constants';

export const readCommentsTool = ({
  con,
  interest,
  consumeBudget,
}: InterestToolContext) => ({
  name: 'read_comments',
  label: 'Read post comments',
  description:
    "Read the discussion on a post: top-level comments with their replies, ranked by upvotes or recency, including each author and their vote counts. Use it to tell whether a post is genuinely useful or merely popular. You get a sample, not the thread: postCommentCount is the real total, shown tells you how much you received, and each comment's replyCount is its real reply count even when fewer replies are returned.",
  parameters: Type.Object({
    postId: Type.String(),
    sortBy: Type.Optional(
      Type.Union([Type.Literal('upvotes'), Type.Literal('newest')]),
    ),
    limit: Type.Optional(Type.Number()),
  }),
  execute: async (
    _id: never,
    params: { postId: string; sortBy?: 'upvotes' | 'newest'; limit?: number },
  ) => {
    if (consumeBudget()) {
      return jsonResult(budgetError);
    }
    const limit = Math.min(
      Math.max(params.limit ?? DEFAULT_COMMENT_LIMIT, 1),
      MAX_COMMENT_LIMIT,
    );
    const order: 'c.upvotes' | 'c."createdAt"' =
      params.sortBy === 'newest' ? 'c."createdAt"' : 'c.upvotes';

    // Probe separately, otherwise an invisible post is indistinguishable from a
    // visible one with no comments — both yield zero rows below.
    const post = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager.getRepository(Post).findOne({
        select: ['id', 'comments'],
        where: [
          {
            id: params.postId,
            deleted: false,
            banned: false,
            private: false,
            showOnFeed: true,
          },
          {
            id: params.postId,
            deleted: false,
            banned: false,
            sourceId: interest.sourceId ?? '',
          },
        ],
      }),
    );
    if (!post) {
      return jsonResult({ postId: params.postId, error: 'not_found' });
    }

    const selectComments = (manager: EntityManager, parentIsNull: boolean) =>
      manager
        .getRepository(Comment)
        .createQueryBuilder('c')
        .select([
          'c.id AS id',
          'c."parentId" AS "parentId"',
          'c.content AS content',
          'c.upvotes AS upvotes',
          'c.downvotes AS downvotes',
          'c.awards AS awards',
          'c."createdAt" AS "createdAt"',
          'c.comments AS "replyCount"',
          'u.username AS username',
          'u.reputation AS reputation',
        ])
        .leftJoin(User, 'u', 'u.id = c."userId"')
        .where('c."postId" = :postId', { postId: params.postId })
        .andWhere(`c.flags->>'vordr' IS DISTINCT FROM 'true'`)
        .andWhere(
          parentIsNull
            ? 'c."parentId" IS NULL'
            : 'c."parentId" IN (:...parentIds)',
        );

    const { topLevel, replies } = await queryReadReplica(
      con,
      async ({ queryRunner }) => {
        const parents = await selectComments(queryRunner.manager, true)
          .orderBy(order, 'DESC')
          .limit(limit)
          .getRawMany();

        if (!parents.length) {
          return { topLevel: parents, replies: [] };
        }

        const children = await selectComments(queryRunner.manager, false)
          .setParameter(
            'parentIds',
            parents.map((comment) => comment.id),
          )
          .addSelect(
            'ROW_NUMBER() OVER (PARTITION BY c."parentId" ORDER BY c.upvotes DESC)',
            'rank',
          )
          .orderBy('rank', 'ASC')
          .addOrderBy('c.upvotes', 'DESC')
          .limit(parents.length * MAX_REPLIES_PER_PARENT)
          .getRawMany();

        return { topLevel: parents, replies: children };
      },
    );

    if (!topLevel.length) {
      return jsonResult({
        postId: params.postId,
        postCommentCount: post.comments,
        shown: { parents: 0, replies: 0 },
        commentsOmitted: false,
        comments: [],
      });
    }

    let budget = MAX_COMMENT_CHARS;
    let commentsOmitted = false;
    const render = (comment: Record<string, unknown>) => {
      const full = String(comment.content ?? '');
      const text = full.slice(0, MAX_COMMENT_LENGTH);
      if (budget <= 0) {
        commentsOmitted = true;
        return null;
      }
      budget -= text.length;
      return {
        author: comment.username,
        reputation: comment.reputation,
        upvotes: comment.upvotes,
        downvotes: comment.downvotes,
        awards: comment.awards,
        createdAt: (comment.createdAt as Date)?.toISOString(),
        content: text,
        ...(text.length < full.length ? { contentTruncated: true } : {}),
      };
    };

    let shownReplies = 0;
    const comments = topLevel
      .map((comment) => {
        const rendered = render(comment);
        if (!rendered) {
          return null;
        }
        const shown = replies
          .filter((reply) => reply.parentId === comment.id)
          .sort(
            (a, b) =>
              (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime(),
          )
          .map(render)
          .filter(Boolean);
        shownReplies += shown.length;
        return {
          ...rendered,
          replyCount: comment.replyCount,
          replies: shown,
        };
      })
      .filter(Boolean);

    return jsonResult({
      postId: params.postId,
      postCommentCount: post.comments,
      shown: { parents: comments.length, replies: shownReplies },
      commentsOmitted,
      comments,
    });
  },
});
