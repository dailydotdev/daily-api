import { Type } from 'typebox';
import { Post } from '../../../entity/posts/Post';
import { Source } from '../../../entity/Source';
import { User } from '../../../entity/user/User';
import { queryReadReplica } from '../../queryReadReplica';
import { getDiscussionLink } from '../../links';
import type { InterestToolContext } from './context';
import { budgetError, jsonResult } from './constants';

type PostDetailRow = {
  id: string;
  type: string;
  subType: string | null;
  title: string | null;
  summary: string | null;
  description: string | null;
  content: string | null;
  readTime: number | null;
  createdAt: Date;
  publishedAt: Date | null;
  tagsStr: string | null;
  language: string | null;
  contentCuration: string[] | null;
  views: number;
  upvotes: number;
  downvotes: number;
  comments: number;
  awards: number;
  trending: number | null;
  score: number | null;
  url: string | null;
  slug: string | null;
  contentQuality: Post['contentQuality'] | null;
  communitySentiment: Post['communitySentiment'] | null;
  toc: unknown;
  sharedPostId: string | null;
  sourceId: string | null;
  sourceHandle: string | null;
  sourceName: string | null;
  sourceDescription: string | null;
  sourceType: string | null;
  sourceFlags: Source['flags'] | null;
  authorUsername: string | null;
  authorName: string | null;
  authorReputation: number | null;
  sharedId: string | null;
  sharedTitle: string | null;
  sharedSummary: string | null;
};

export const readPostTool = ({
  con,
  interest,
  overBudget,
  pipeline,
}: InterestToolContext) => ({
  name: 'read_post',
  label: 'Read post',
  description:
    "Read one post in full: engagement counts, quality signals, tags, source, author, summary and the community's take. Works on any post, including older ones and ones already delivered for this interest, so use it when the user asks about something specific. alreadyDelivered tells you whether this interest has surfaced it before.",
  parameters: Type.Object({
    postId: Type.String(),
  }),
  execute: async (_id: never, params: { postId: string }) => {
    if (overBudget()) {
      return jsonResult(budgetError);
    }
    const post = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager
        .getRepository(Post)
        .createQueryBuilder('p')
        .select([
          'p.id AS id',
          'p.type AS type',
          'p."subType" AS "subType"',
          'p.title AS title',
          'p.summary AS summary',
          'p.description AS description',
          'p.content AS content',
          'p."readTime" AS "readTime"',
          'p."createdAt" AS "createdAt"',
          'p."publishedAt" AS "publishedAt"',
          'p."tagsStr" AS "tagsStr"',
          'p.language AS language',
          'p."contentCuration" AS "contentCuration"',
          'p.views AS views',
          'p.upvotes AS upvotes',
          'p.downvotes AS downvotes',
          'p.comments AS comments',
          'p.awards AS awards',
          'p.trending AS trending',
          'p.score AS score',
          'p.url AS url',
          'p.slug AS slug',
          'p."contentQuality" AS "contentQuality"',
          'p."communitySentiment" AS "communitySentiment"',
          'p.toc AS toc',
          'p."sharedPostId" AS "sharedPostId"',
          's.id AS "sourceId"',
          's.handle AS "sourceHandle"',
          's.name AS "sourceName"',
          's.description AS "sourceDescription"',
          's.type AS "sourceType"',
          's.flags AS "sourceFlags"',
          'a.username AS "authorUsername"',
          'a.name AS "authorName"',
          'a.reputation AS "authorReputation"',
          'sp.id AS "sharedId"',
          'sp.title AS "sharedTitle"',
          'sp.summary AS "sharedSummary"',
        ])
        .leftJoin(Source, 's', 's.id = p."sourceId"')
        .leftJoin(User, 'a', 'a.id = p."authorId"')
        .leftJoin(Post, 'sp', 'sp.id = p."sharedPostId"')
        .where('p.id = :postId', { postId: params.postId })
        .andWhere('p.deleted = false')
        .andWhere(
          '((p.private = false AND p."showOnFeed" = true) OR p."sourceId" = :interestSourceId)',
          { interestSourceId: interest.sourceId },
        )
        .getRawOne<PostDetailRow>(),
    );

    if (!post) {
      return jsonResult({ postId: params.postId, error: 'not_found' });
    }

    const [delivered, viewed] = await Promise.all([
      pipeline.findDelivered(post.id),
      pipeline.findViewed(post.id),
    ]);

    return jsonResult({
      postId: post.id,
      type: post.type,
      subType: post.subType,
      title: post.title,
      summary: post.summary,
      description: post.description,
      content: post.content,
      url: post.url,
      permalink: getDiscussionLink(post.slug ?? post.id),
      readTime: post.readTime,
      publishedAt: (post.publishedAt ?? post.createdAt)?.toISOString(),
      language: post.language,
      tags: post.tagsStr ? post.tagsStr.split(',') : [],
      contentCuration: post.contentCuration,
      engagement: {
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        comments: post.comments,
        views: post.views,
        awards: post.awards,
        trending: post.trending,
        score: post.score,
      },
      contentQuality: post.contentQuality,
      communitySentiment: post.communitySentiment,
      toc: post.toc,
      source: post.sourceId
        ? {
            id: post.sourceId,
            handle: post.sourceHandle,
            name: post.sourceName,
            description: post.sourceDescription,
            type: post.sourceType,
            totalPosts: post.sourceFlags?.totalPosts,
            totalUpvotes: post.sourceFlags?.totalUpvotes,
            totalMembers: post.sourceFlags?.totalMembers,
          }
        : null,
      author: post.authorUsername
        ? {
            username: post.authorUsername,
            name: post.authorName,
            reputation: post.authorReputation,
          }
        : null,
      sharedPost: post.sharedId
        ? {
            postId: post.sharedId,
            title: post.sharedTitle,
            summary: post.sharedSummary,
          }
        : null,
      alreadyDelivered: !!delivered,
      deliveredAt: delivered?.createdAt?.toISOString() ?? null,
      alreadyViewed: !!viewed,
    });
  },
});
