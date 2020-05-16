import { gql, IFieldResolver, IResolvers } from 'apollo-server-fastify';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { GQLPost } from './posts';
import {
  anonymousFeedBuilder,
  AnonymousFeedFilters,
  bookmarksFeedBuilder,
  configuredFeedBuilder,
  FeedOptions,
  generateFeed,
  Ranking,
  searchPostFeedBuilder,
  sourceFeedBuilder,
  tagFeedBuilder,
} from '../common';
import { SelectQueryBuilder } from 'typeorm';
import { Post, searchPosts } from '../entity';
import { PaginationResponse } from './common';
import { GQLSearchPostSuggestionsResults } from './feeds';

export const typeDefs = gql`
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
    views: Int @deprecated(reason: "No longer available")
  }

  extend type Query {
    latest(params: QueryPostInput): [Post!]!
      @deprecated(reason: "Please use anonymousFeed or feed")
    bookmarks(params: QueryPostInput): [Post!]!
      @auth
      @deprecated(reason: "Please use bookmarksFeed")
    postsByPublication(params: PostByPublicationInput): [Post!]!
      @deprecated(reason: "Please use sourceFeed")
    postsByTag(params: PostByTagInput): [Post!]!
      @deprecated(reason: "Please use tagFeed")
    search(params: PostSearchInput): PostSearchResults!
      @deprecated(reason: "Please use searchPosts")
    searchSuggestion(
      params: PostSearchSuggestionInput
    ): SearchPostSuggestionsResults!
      @deprecated(reason: "Please use searchPostSuggestions")
  }
`;

interface GQLPublication {
  id: string;
  name: string;
  image: string;
}

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

interface GQLPostByPublicationInput extends CompatFeedInput {
  pub: string;
}

interface GQLPostByTagInput extends CompatFeedInput {
  tag: string;
}

interface GQLPostSearchInput extends CompatFeedInput {
  query: string;
}

interface CompatFeedArgs<TParams> {
  params: TParams;
}

interface GQLPostSearchResults {
  query: string;
  hits: GQLPost[];
}

async function compatGenerateFeed<
  TSource,
  TParams extends CompatFeedInput,
  TArgs extends CompatFeedArgs<TParams>
>(
  source: TSource,
  args: TArgs,
  ctx: Context,
  generate: (
    ctx: Context,
    limit: number,
    offset: number,
    opts: FeedOptions,
  ) => Promise<PaginationResponse<GQLPost>>,
): Promise<GQLPost[]> {
  const limit = args.params?.pageSize || 30;
  const offset = (args.params?.page || 0) * limit;
  const opts = {
    now: new Date(args.params?.latest),
    ranking:
      args.params?.sortBy === 'creation' ? Ranking.TIME : Ranking.POPULARITY,
  };
  const feed = await generate(ctx, limit, offset, opts);
  return feed.nodes;
}

function compatFeedResolver<
  TSource,
  TParams extends CompatFeedInput,
  TArgs extends CompatFeedArgs<TParams>
>(
  query: (
    ctx: Context,
    args: TArgs,
    opts: FeedOptions,
    builder: SelectQueryBuilder<Post>,
  ) => SelectQueryBuilder<Post>,
): IFieldResolver<TSource, Context, TArgs> {
  return async (
    source: TSource,
    args: TArgs,
    ctx: Context,
  ): Promise<GQLPost[]> =>
    compatGenerateFeed(source, args, ctx, (_, limit, offset, opts) =>
      generateFeed(ctx, limit, offset, (builder) =>
        query(ctx, args, opts, builder),
      ),
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  Query: traceResolverObject({
    latest: compatFeedResolver(
      (ctx, { params }: CompatFeedArgs<GQLQueryPostInput>, opts, builder) => {
        if (ctx.userId) {
          return configuredFeedBuilder(
            ctx,
            opts,
            ctx.userId,
            params.read === false,
            builder,
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
          return anonymousFeedBuilder(ctx, opts, filters, builder);
        }
      },
    ),
    bookmarks: compatFeedResolver((ctx, args, opts, builder) =>
      bookmarksFeedBuilder(ctx, opts.now, builder),
    ),
    postsByPublication: compatFeedResolver(
      (
        ctx,
        { params }: CompatFeedArgs<GQLPostByPublicationInput>,
        opts,
        builder,
      ) => sourceFeedBuilder(ctx, opts, params.pub, builder),
    ),
    postsByTag: compatFeedResolver(
      (ctx, { params }: CompatFeedArgs<GQLPostByTagInput>, opts, builder) =>
        tagFeedBuilder(ctx, opts, params.tag, builder),
    ),
    search: async (
      source,
      args: CompatFeedArgs<GQLPostSearchInput>,
      ctx,
    ): Promise<GQLPostSearchResults> => {
      const posts = await compatGenerateFeed(
        source,
        args,
        ctx,
        (_, limit, offset, opts) =>
          searchPostFeedBuilder(
            source,
            {
              query: args.params.query,
              now: opts.now,
              ranking: Ranking.POPULARITY,
            },
            ctx,
            { limit, offset },
          ),
      );
      return {
        hits: posts,
        query: args.params.query,
      };
    },
    searchSuggestion: async (
      source,
      { params: { query } }: { params: { query: string } },
      ctx,
    ): Promise<GQLSearchPostSuggestionsResults> => {
      const suggestions = await searchPosts(
        query,
        {
          hitsPerPage: 5,
          attributesToRetrieve: ['objectID', 'title'],
          attributesToHighlight: ['title'],
          highlightPreTag: '<strong>',
          highlightPostTag: '</strong>',
        },
        ctx.userId,
        ctx.req.ip,
      );
      return {
        query,
        hits: suggestions.map((s) => ({ title: s.highlight })),
      };
    },
  }),
  Post: {
    publication: (source: GQLPost): GQLPublication => source.source,
    views: (): number => 0,
  },
};
