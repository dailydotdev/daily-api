import { IFieldResolver, IResolvers } from '@graphql-tools/utils';
import { BaseContext, Context } from '../Context';
import { traceResolvers } from './trace';
import { GQLPost } from './posts';
import {
  anonymousFeedBuilder,
  AnonymousFeedFilters,
  applyFeedWhere,
  bookmarksFeedBuilder,
  configuredFeedBuilder,
  FeedOptions,
  Ranking,
  tagFeedBuilder,
} from '../common';
import { SelectQueryBuilder } from 'typeorm';
import { Post } from '../entity';
import graphorm from '../graphorm';

export const typeDefs = /* GraphQL */ `
  type Publication {
    id: ID!
    name: String!
    image: String!
  }

  type PostSearchResults {
    query: String
    hits: [Post]
  }

  input QueryPostInput {
    latest: String
    page: Int
    pageSize: Int
    pubs: String
    tags: String
    sortBy: String
    read: Boolean
  }

  input PostByPublicationInput {
    latest: String
    page: Int
    pageSize: Int
    pub: String!
  }

  input PostByTagInput {
    latest: String
    page: Int
    pageSize: Int
    tag: String!
  }

  input PostSearchInput {
    latest: String
    page: Int
    pageSize: Int
    query: String!
  }

  input PostSearchSuggestionInput {
    query: String!
  }

  extend type Post {
    """
    Publication of the post
    """
    publication: Publication! @deprecated(reason: "Please use source instead")
  }

  extend type Query {
    latest(params: QueryPostInput): [Post!]!
      @deprecated(reason: "Please use anonymousFeed or feed")
    bookmarks(params: QueryPostInput): [Post!]!
      @auth
      @deprecated(reason: "Please use sourceFeed")
    postsByTag(params: PostByTagInput): [Post!]!
      @deprecated(reason: "Please use tagFeed")
  }
`;

interface CompatFeedInput {
  latest: Date;
  page: number;
  pageSize: number;
  sortBy: string;
}

interface GQLQueryPostInput extends CompatFeedInput {
  pubs: string;
  tags: string;
  read: boolean;
}

interface GQLPostByTagInput extends CompatFeedInput {
  tag: string;
}

interface CompatFeedArgs<TParams> {
  params: TParams;
}

async function compatGenerateFeed<
  TSource,
  TParams extends CompatFeedInput,
  TArgs extends CompatFeedArgs<TParams>,
>(
  source: TSource,
  args: TArgs,
  ctx: Context,
  generate: (
    ctx: Context,
    limit: number,
    offset: number,
    opts: FeedOptions,
  ) => Promise<GQLPost[]>,
): Promise<GQLPost[]> {
  const limit = Math.min(args.params?.pageSize || 30, 50);
  const offset = (args.params?.page || 0) * limit;
  const opts = {
    now: new Date(args.params?.latest),
    ranking:
      args.params?.sortBy === 'creation' ? Ranking.TIME : Ranking.POPULARITY,
  };
  return generate(ctx, limit, offset, { ...opts, supportedTypes: ['article'] });
}

function compatFeedResolver<
  TSource,
  TParams extends CompatFeedInput,
  TArgs extends CompatFeedArgs<TParams>,
>(
  query: (
    ctx: Context,
    args: TArgs,
    opts: FeedOptions,
    builder: SelectQueryBuilder<Post>,
    alias: string,
  ) => SelectQueryBuilder<Post>,
): IFieldResolver<TSource, Context, TArgs> {
  return async (
    source: TSource,
    args: TArgs,
    ctx: Context,
    info,
  ): Promise<GQLPost[]> =>
    compatGenerateFeed(source, args, ctx, (_, limit, offset, opts) =>
      graphorm.query(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = applyFeedWhere(
            ctx,
            query(ctx, args, opts, builder.queryBuilder, builder.alias),
            builder.alias,
            ['article'],
          )
            .limit(limit)
            .offset(offset);
          return builder;
        },
        true,
      ),
    );
}

const orderFeed = (
  ranking: Ranking,
  builder: SelectQueryBuilder<Post>,
  alias = 'post',
): SelectQueryBuilder<Post> =>
  builder.orderBy(
    ranking === Ranking.POPULARITY ? `${alias}.score` : `${alias}.createdAt`,
    'DESC',
  );

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    latest: compatFeedResolver(
      (
        ctx,
        { params }: CompatFeedArgs<GQLQueryPostInput>,
        opts,
        builder,
        alias,
      ) => {
        const newBuilder = orderFeed(opts.ranking, builder, alias);
        if (ctx.userId) {
          return configuredFeedBuilder(
            ctx,
            ctx.userId,
            params.read === false,
            newBuilder,
            alias,
            {},
          );
        } else {
          const filters: AnonymousFeedFilters = {
            includeSources: params?.pubs?.length
              ? params?.pubs?.split(',')
              : undefined,
            includeTags: params?.tags?.length
              ? params?.tags?.split(',')
              : undefined,
          };
          return anonymousFeedBuilder(ctx, filters, newBuilder, alias);
        }
      },
    ),
    bookmarks: compatFeedResolver((ctx, args, opts, builder, alias) =>
      bookmarksFeedBuilder(
        ctx,
        false,
        null,
        builder.orderBy('bookmark.createdAt', 'DESC'),
        alias,
      ),
    ),
    postsByTag: compatFeedResolver(
      (
        ctx,
        { params }: CompatFeedArgs<GQLPostByTagInput>,
        opts,
        builder,
        alias,
      ) =>
        orderFeed(
          opts.ranking,
          tagFeedBuilder(ctx, params.tag, builder, alias),
          alias,
        ),
    ),
  },
});
