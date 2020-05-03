import { gql, IResolvers } from 'apollo-server-fastify';
import { ConnectionArguments } from 'graphql-relay';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import { feedResolver, whereTags } from '../common';

export const typeDefs = gql`
  enum Ranking {
    """
    Rank by a combination of time and views
    """
    POPULARITY
    """
    Rank by time only
    """
    TIME
  }

  input FiltersInput {
    """
    Include posts of these sources
    """
    includeSources: [String!]

    """
    Exclude posts of these sources
    """
    excludeSources: [String!]

    """
    Posts must include at least one tag from this list
    """
    includeTags: [String!]
  }

  extend type Query {
    anonymousFeed(
      """
      Time the pagination started to ignore new items
      """
      now: DateTime!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Ranking criteria for the feed
      """
      ranking: Ranking = POPULARITY

      filters: FiltersInput
    ): PostConnection!
  }
`;

export enum Ranking {
  POPULARITY = 'POPULARITY',
  TIME = 'TIME',
}

interface FiltersInput {
  includeSources?: string[];
  excludeSources?: string[];
  includeTags?: string[];
}

interface AnonymousFeedArgs extends ConnectionArguments {
  now: Date;
  ranking: Ranking;
  filters?: FiltersInput;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    anonymousFeed: feedResolver(
      (ctx, { now, filters, ranking }: AnonymousFeedArgs, builder) => {
        let newBuilder = builder
          .where('post.createdAt < :now', { now })
          .orderBy(
            ranking === Ranking.POPULARITY ? 'post.score' : 'post.createdAt',
            'DESC',
          );
        if (filters?.includeSources?.length) {
          newBuilder = newBuilder.andWhere(`post.sourceId IN (:...sources)`, {
            sources: filters.includeSources,
          });
        } else if (filters?.excludeSources?.length) {
          newBuilder = newBuilder.andWhere(
            `post.sourceId NOT IN (:...sources)`,
            { sources: filters.excludeSources },
          );
        }
        if (filters?.includeTags?.length) {
          newBuilder = newBuilder.andWhere((builder) =>
            whereTags(filters.includeTags, builder),
          );
        }
        return newBuilder;
      },
    ),
  },
});
