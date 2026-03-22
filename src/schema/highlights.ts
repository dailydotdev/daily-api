import { IResolvers } from '@graphql-tools/utils';
import {
  ConnectionArguments,
  getOffsetWithDefault,
  offsetToCursor,
} from 'graphql-relay';
import type { PageGenerator } from './common';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import { forwardPagination, type OffsetPage } from './common';
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

const defaultMajorHeadlinesLimit = 10;
const maxMajorHeadlinesLimit = 50;

const majorHeadlinesPageGenerator: PageGenerator<
  PostHighlight,
  ConnectionArguments,
  OffsetPage
> = {
  connArgsToPage: (args) => {
    const limit =
      Math.min(
        args.first || defaultMajorHeadlinesLimit,
        maxMajorHeadlinesLimit,
      ) + 1;
    const offset = getOffsetWithDefault(args.after, -1) + 1;

    return {
      limit,
      offset,
    };
  },
  nodeToCursor: (page, args, node, index) =>
    offsetToCursor(page.offset + index),
  hasNextPage: (page, nodesSize) => nodesSize >= page.limit,
  hasPreviousPage: (page) => page.offset > 0,
  transformNodes: (page, nodes) => nodes.slice(0, page.limit - 1),
};

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

          const nodes = await repo
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
            .getMany();

          return {
            nodes,
          };
        }),
      majorHeadlinesPageGenerator,
    ),
  },
};
