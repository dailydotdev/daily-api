import { gql, IResolvers } from 'apollo-server-fastify';
import { ConnectionArguments } from 'graphql-relay';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import { feedResolver, nestChild, selectSource, whereTags } from '../common';
import { SelectQueryBuilder } from 'typeorm';
import { Feed, FeedTag, Post } from '../entity';
import { GQLSource } from './sources';
import { FeedSource } from '../entity/FeedSource';

export const typeDefs = gql`
  type FeedSettings {
    id: String
    userId: String
    includeTags: [String]
    excludeSources: [Source]
  }

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
    includeSources: [ID!]

    """
    Exclude posts of these sources
    """
    excludeSources: [ID!]

    """
    Posts must include at least one tag from this list
    """
    includeTags: [String!]
  }

  extend type Query {
    """
    Get an ad-hoc feed based on sources and tags filters
    """
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

      """
      Filters to apply to the feed
      """
      filters: FiltersInput
    ): PostConnection!

    """
    Get a single source feed
    """
    sourceFeed(
      """
      Id of the source
      """
      source: ID!

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
    ): PostConnection!

    """
    Get a single tag feed
    """
    tagFeed(
      """
      The tag to fetch
      """
      tag: String!

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
    ): PostConnection!

    """
    Get the user's default feed settings
    """
    feedSettings: FeedSettings @auth
  }
`;

export enum Ranking {
  POPULARITY = 'POPULARITY',
  TIME = 'TIME',
}

interface GQLFiltersInput {
  includeSources?: string[];
  excludeSources?: string[];
  includeTags?: string[];
}

interface FeedArgs extends ConnectionArguments {
  now: Date;
  ranking: Ranking;
}

interface AnonymousFeedArgs extends FeedArgs {
  filters?: GQLFiltersInput;
}

interface SourceFeedArgs extends FeedArgs {
  source: string;
}

interface TagFeedArgs extends FeedArgs {
  tag: string;
}

const applyFeedArgs = (
  builder: SelectQueryBuilder<Post>,
  { now, ranking }: FeedArgs,
): SelectQueryBuilder<Post> =>
  builder
    .where('post.createdAt < :now', { now })
    .orderBy(
      ranking === Ranking.POPULARITY ? 'post.score' : 'post.createdAt',
      'DESC',
    );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    anonymousFeed: feedResolver(
      (ctx, { now, filters, ranking }: AnonymousFeedArgs, builder) => {
        let newBuilder = applyFeedArgs(builder, { now, ranking });
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
    sourceFeed: feedResolver(
      (ctx, { now, ranking, source }: SourceFeedArgs, builder) =>
        applyFeedArgs(builder, {
          now,
          ranking,
        }).andWhere(`post.sourceId = :source`, { source }),
    ),
    tagFeed: feedResolver((ctx, { now, ranking, tag }: TagFeedArgs, builder) =>
      applyFeedArgs(builder, {
        now,
        ranking,
      }).andWhere((subBuilder) => whereTags([tag], subBuilder)),
    ),
    feedSettings: (source, args, ctx): Promise<Feed> =>
      ctx.getRepository(Feed).findOneOrFail({
        where: {
          id: ctx.userId,
          userId: ctx.userId,
        },
      }),
  },
  FeedSettings: {
    includeTags: async (source: Feed, args, ctx): Promise<string[]> => {
      const tags = await ctx.getRepository(FeedTag).find({
        select: ['tag'],
        where: { feedId: source.id },
        order: { tag: 'ASC' },
      });
      return tags.map((t) => t.tag);
    },
    excludeSources: async (source: Feed, args, ctx): Promise<GQLSource[]> => {
      const displays = await ctx.con
        .createQueryBuilder()
        .select('source.*')
        .from(FeedSource, 'feed')
        .leftJoin(
          (subBuilder) => selectSource(ctx.userId, subBuilder),
          'source',
          'source."sourceId" = feed."sourceId"',
        )
        .orderBy('source."sourceName"')
        .getRawMany();
      const sources = displays.map((d) => nestChild(d, 'source')['source']);
      return sources;
    },
  },
});
