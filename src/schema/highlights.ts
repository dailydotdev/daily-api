import { IResolvers } from '@graphql-tools/utils';
import { ConnectionArguments } from 'graphql-relay';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import {
  forwardPagination,
  offsetPageGenerator,
  type OffsetPage,
} from './common';
import {
  PostHighlight,
  PostHighlightSignificance,
} from '../entity/PostHighlight';
import { queryReadReplica } from '../common/queryReadReplica';

export const typeDefs = /* GraphQL */ `
  type PostHighlight {
    id: ID!
    post: Post!
    channel: String!
    highlightedAt: DateTime!
    headline: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type PostHighlightEdge {
    node: PostHighlight!
    cursor: String!
  }

  type PostHighlightConnection {
    pageInfo: PageInfo!
    edges: [PostHighlightEdge!]!
  }

  extend type Query {
    """
    Get highlights for a channel, ordered by recency
    """
    postHighlights(channel: String!): [PostHighlight!]!

    """
    Get major headlines across all channels, deduplicated by post and ordered by recency
    """
    majorHeadlines(first: Int, after: String): PostHighlightConnection!
  }
`;

const majorHeadlineSignificances = [
  PostHighlightSignificance.Breaking,
  PostHighlightSignificance.Major,
];

const majorHeadlinesPageGenerator = offsetPageGenerator<PostHighlight>(10, 50);

const addMajorHeadlineFilter = (
  builder: SelectQueryBuilder<PostHighlight>,
): SelectQueryBuilder<PostHighlight> =>
  builder.where('highlight.significance IN (:...significances)', {
    significances: majorHeadlineSignificances,
  });

const getDedupedMajorHeadlinesQuery = (repo: Repository<PostHighlight>) =>
  addMajorHeadlineFilter(
    repo.createQueryBuilder('highlight').select('highlight.id', 'id'),
  )
    .distinctOn(['highlight.postId'])
    .orderBy('highlight.postId', 'ASC')
    .addOrderBy('highlight.highlightedAt', 'DESC')
    .addOrderBy('highlight.id', 'DESC');

const getMajorHeadlinesCountQuery = (repo: Repository<PostHighlight>) =>
  addMajorHeadlineFilter(repo.createQueryBuilder('highlight'))
    .select('COUNT(DISTINCT highlight."postId")', 'count')
    .getRawOne<{ count: string }>();

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    postHighlights: async (_, args: { channel: string }, ctx: Context, info) =>
      graphorm.query(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."channel" = :channel`, {
              channel: args.channel,
            })
            .orderBy(`"${builder.alias}"."highlightedAt"`, 'DESC');
          return builder;
        },
        true,
      ),
    majorHeadlines: forwardPagination<
      unknown,
      PostHighlight,
      ConnectionArguments,
      OffsetPage
    >(
      async (_, args, ctx, page) =>
        queryReadReplica(ctx.con, async ({ queryRunner }) => {
          const repo = queryRunner.manager.getRepository(PostHighlight);
          const dedupedIdsQuery = getDedupedMajorHeadlinesQuery(repo);

          const [nodes, totalResult] = await Promise.all([
            repo
              .createQueryBuilder('highlight')
              .innerJoin(
                `(${dedupedIdsQuery.getQuery()})`,
                'deduped',
                'deduped.id = highlight.id',
              )
              .setParameters(dedupedIdsQuery.getParameters())
              .orderBy('highlight.highlightedAt', 'DESC')
              .addOrderBy('highlight.id', 'DESC')
              .offset(page.offset)
              .limit(page.limit)
              .getMany(),
            getMajorHeadlinesCountQuery(repo),
          ]);

          return {
            nodes,
            total: Number(totalResult?.count ?? 0),
          };
        }),
      majorHeadlinesPageGenerator,
    ),
  },
};
