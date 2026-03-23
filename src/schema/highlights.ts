import { IResolvers } from '@graphql-tools/utils';
import {
  ConnectionArguments,
  getOffsetWithDefault,
  offsetToCursor,
} from 'graphql-relay';
import type { SelectQueryBuilder } from 'typeorm';
import { BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import type { OffsetPage } from './common';
import {
  PostHighlight,
  PostHighlightSignificance,
} from '../entity/PostHighlight';

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

const getMajorHeadlinesPage = (args: ConnectionArguments): OffsetPage => ({
  limit:
    Math.min(args.first || defaultMajorHeadlinesLimit, maxMajorHeadlinesLimit) +
    1,
  offset: getOffsetWithDefault(args.after, -1) + 1,
});

const addMajorHeadlineFilter = <T extends PostHighlight>(
  builder: SelectQueryBuilder<T>,
): SelectQueryBuilder<T> =>
  builder
    .where('highlight.significance IN (:...significances)', {
      significances: majorHeadlineSignificances,
    })
    .andWhere('highlight."retiredAt" IS NULL');

const getDedupedMajorHeadlinesQuery = (
  queryBuilder: SelectQueryBuilder<PostHighlight>,
) =>
  addMajorHeadlineFilter(
    queryBuilder
      .subQuery()
      .select('highlight.id', 'id')
      .from(PostHighlight, 'highlight'),
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
            .andWhere(`"${builder.alias}"."retiredAt" IS NULL`)
            .orderBy(`"${builder.alias}"."highlightedAt"`, 'DESC');
          return builder;
        },
        true,
      ),
    majorHeadlines: async (
      _,
      args: ConnectionArguments,
      ctx: Context,
      info,
    ) => {
      const page = getMajorHeadlinesPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        () => page.offset > 0,
        (nodeSize) => nodeSize >= page.limit,
        (_, index) => offsetToCursor(page.offset + index),
        (builder) => {
          const dedupedIdsQuery = getDedupedMajorHeadlinesQuery(
            builder.queryBuilder as SelectQueryBuilder<PostHighlight>,
          );

          builder.queryBuilder
            .innerJoin(
              `(${dedupedIdsQuery.getQuery()})`,
              'deduped',
              `deduped.id = ${builder.alias}.id`,
            )
            .setParameters(dedupedIdsQuery.getParameters())
            .orderBy(`${builder.alias}."highlightedAt"`, 'DESC')
            .addOrderBy(`${builder.alias}."id"`, 'DESC')
            .offset(page.offset)
            .limit(page.limit);

          return builder;
        },
        (nodes) => nodes.slice(0, page.limit - 1),
        true,
      );
    },
  },
};
