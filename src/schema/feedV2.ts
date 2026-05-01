import type { IFieldResolver, IResolvers } from '@graphql-tools/utils';
import type { GraphQLResolveInfo } from 'graphql';
import { parseResolveInfo, type ResolveTree } from 'graphql-parse-resolve-info';
import graphorm from '../graphorm';
import type { AuthContext, BaseContext } from '../Context';
import type { GQLPost } from './posts';
import type { FeedGenerator, FeedResponse } from '../integrations/feed';
import type { Connection } from 'graphql-relay';
import {
  isFeedResponseHighlightItem,
  versionToFeedGenerator,
  versionToTimeFeedGenerator,
} from '../integrations/feed';
import {
  applyFeedWhere,
  base64,
  type FeedArgs,
  fixedIdsFeedBuilder,
  Ranking,
} from '../common';
import { type PostHighlight } from '../entity';

export type FeedV2Args = FeedArgs & {
  unreadOnly: boolean;
  version: number;
  highlightsLimit?: number | null;
};

type GQLFeedPostItem = {
  itemType: 'post';
  postId: string;
  post?: GQLPost | null;
  feedMeta: string | null;
};

type GQLFeedHighlightsItem = {
  itemType: 'highlight';
  highlightIds: string[];
  highlights?: PostHighlight[];
  feedMeta: string | null;
};

type GQLFeedItem = GQLFeedPostItem | GQLFeedHighlightsItem;

export const feedV2TypeDefs = /* GraphQL */ `
  type FeedItemConnection {
    pageInfo: PageInfo!
    edges: [FeedItemEdge!]!
  }

  type FeedItemEdge {
    node: FeedItem!
    cursor: String!
  }

  union FeedItem = FeedPostItem | FeedHighlightsItem

  type FeedPostItem {
    post: Post
    feedMeta: String
  }

  type FeedHighlightsItem {
    highlights: [PostHighlight!]!
    feedMeta: String
  }

  extend type Query {
    """
    Get a configured For You feed with mixed feed items
    """
    feedV2(
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
      Return only unread posts
      """
      unreadOnly: Boolean = false

      """
      Version of the feed algorithm
      """
      version: Int = 20

      """
      Array of supported feed item types
      """
      supportedTypes: [String!]

      """
      Deprecated, no longer in use. Kept for backwards compatibility.
      """
      noAi: Boolean = false

      """
      Number of highlights to include in a highlights item.
      If zero or null, highlights items are not requested.
      """
      highlightsLimit: Int
    ): FeedItemConnection! @auth
  }
`;

export const getForYouFeedGenerator = ({
  ranking,
  version,
}: Pick<FeedV2Args, 'ranking' | 'version'>): FeedGenerator => {
  const generator =
    ranking === Ranking.TIME
      ? versionToTimeFeedGenerator(version)
      : versionToFeedGenerator(version);

  return generator;
};

const encodeFeedMeta = (feedMeta: string | null | undefined): string | null =>
  feedMeta ? base64(feedMeta) : null;

const supportsHighlights = ({
  supportedTypes,
  highlightsLimit,
}: Pick<FeedV2Args, 'supportedTypes' | 'highlightsLimit'>): boolean =>
  !!supportedTypes?.includes('highlight') && !!highlightsLimit;

export const getFeedV2AllowedPostTypes = (
  supportedTypes: FeedV2Args['supportedTypes'],
): string[] | undefined =>
  supportedTypes?.filter((type) => type !== 'highlight');

const getResolveTreeChild = (
  tree: ResolveTree | null | undefined,
  fieldName: string,
): ResolveTree | null => {
  if (!tree) {
    return null;
  }

  const rootType = Object.keys(tree.fieldsByTypeName)[0];
  const fields = tree.fieldsByTypeName[rootType];

  return (
    Object.values(fields).find((field) => field.name === fieldName) ?? null
  );
};

export const getFeedV2FieldTree = (
  info: GraphQLResolveInfo,
  typeName: 'FeedPostItem' | 'FeedHighlightsItem',
  fieldName: 'post' | 'highlights',
): ResolveTree | null => {
  const parsedInfo = parseResolveInfo(info) as ResolveTree | null;
  const edgesTree = getResolveTreeChild(parsedInfo, 'edges');
  const nodeTree = getResolveTreeChild(edgesTree, 'node');

  return nodeTree?.fieldsByTypeName?.[typeName]?.[fieldName] ?? null;
};

const toFeedV2Items = ({
  response,
  postsById,
  highlightsById,
}: {
  response: FeedResponse;
  postsById: Map<string, GQLPost>;
  highlightsById: Map<string, PostHighlight>;
}): GQLFeedItem[] =>
  response.data.reduce<GQLFeedItem[]>((acc, item) => {
    if (isFeedResponseHighlightItem(item)) {
      if (!item.highlightIds.length) {
        return acc;
      }

      acc.push({
        itemType: 'highlight',
        highlightIds: item.highlightIds,
        highlights: item.highlightIds.reduce<PostHighlight[]>((items, id) => {
          const highlight = highlightsById.get(id);
          if (highlight) {
            items.push(highlight);
          }
          return items;
        }, []),
        feedMeta: item.feedMeta,
      });
      return acc;
    }

    const post = postsById.get(item.id);
    if (!post) {
      return acc;
    }

    acc.push({
      itemType: 'post',
      postId: item.id,
      post,
      feedMeta: item.feedMeta,
    });
    return acc;
  }, []);

export const toFeedV2PostConnection = (
  connection: Connection<GQLPost>,
): Connection<GQLFeedItem> => ({
  pageInfo: connection.pageInfo,
  edges: connection.edges.map((edge) => ({
    cursor: edge.cursor,
    node: {
      itemType: 'post',
      postId: edge.node.id,
      post: edge.node,
      feedMeta: edge.node.feedMeta ?? null,
    },
  })),
});

export const emptyFeedV2Connection = ({
  after,
}: Pick<FeedV2Args, 'after'>): Connection<GQLFeedItem> =>
  graphorm.nodesToConnection<GQLFeedItem>(
    [],
    0,
    () => !!after,
    () => false,
    () => after || '',
  );

export const feedV2QueryResolver: IFieldResolver<
  unknown,
  AuthContext,
  FeedV2Args
> = async (source, args, ctx, info) => {
  const page = {
    limit: Math.min(args.first || 30, 50),
    cursor: args.after || undefined,
  };
  const allowedPostTypes = getFeedV2AllowedPostTypes(args.supportedTypes);
  const response = await getForYouFeedGenerator(args).generate(ctx, {
    user_id: ctx.userId || ctx.trackingId,
    page_size: page.limit,
    offset: 0,
    cursor: page.cursor,
    allowed_post_types: allowedPostTypes,
    highlights_limit: supportsHighlights(args)
      ? args.highlightsLimit || undefined
      : undefined,
  });

  const postIds = Array.from(
    new Set(
      response.data.flatMap((item) =>
        isFeedResponseHighlightItem(item) ? [] : [item.id],
      ),
    ),
  );
  const highlightIds = Array.from(
    new Set(
      response.data.flatMap((item) =>
        isFeedResponseHighlightItem(item) ? item.highlightIds : [],
      ),
    ),
  );
  const postFieldTree = getFeedV2FieldTree(info, 'FeedPostItem', 'post');
  const highlightsFieldTree = getFeedV2FieldTree(
    info,
    'FeedHighlightsItem',
    'highlights',
  );
  const [posts, highlights] = await Promise.all([
    postIds.length && postFieldTree
      ? graphorm.queryResolveTree<GQLPost>(
          ctx,
          postFieldTree,
          (builder) => {
            builder.queryBuilder = applyFeedWhere(
              ctx,
              fixedIdsFeedBuilder(
                ctx,
                postIds,
                builder.queryBuilder,
                builder.alias,
              ),
              builder.alias,
              allowedPostTypes || ['article'],
              true,
              true,
              true,
              true,
              false,
            );
            return builder;
          },
          true,
        )
      : Promise.resolve([]),
    highlightIds.length && highlightsFieldTree
      ? graphorm.queryResolveTree<PostHighlight>(
          ctx,
          highlightsFieldTree,
          (builder) => {
            builder.queryBuilder
              .where(`${builder.alias}.id IN (:...ids)`, {
                ids: highlightIds,
              })
              .limit(highlightIds.length);
            return builder;
          },
          true,
        )
      : Promise.resolve([]),
  ]);

  return graphorm.nodesToConnection<GQLFeedItem>(
    toFeedV2Items({
      response,
      postsById: new Map(posts.map((post) => [post.id, post])),
      highlightsById: new Map(
        highlights.map((highlight) => [highlight.id, highlight]),
      ),
    }),
    response.data.length,
    () => !!page.cursor,
    () => response.data.length >= page.limit,
    () => response.cursor as string,
    response.staleCursor ? { staleCursor: response.staleCursor } : undefined,
  );
};

export const feedV2Resolvers: IResolvers<unknown, BaseContext> = {
  FeedItem: {
    __resolveType: (item: GQLFeedItem) =>
      item.itemType === 'highlight' ? 'FeedHighlightsItem' : 'FeedPostItem',
  },
  FeedPostItem: {
    post: (item: GQLFeedPostItem): GQLPost | null => item.post ?? null,
    feedMeta: (item: GQLFeedPostItem): string | null =>
      encodeFeedMeta(item.feedMeta),
  },
  FeedHighlightsItem: {
    highlights: (item: GQLFeedHighlightsItem): PostHighlight[] =>
      item.highlights ?? [],
    feedMeta: (item: GQLFeedHighlightsItem): string | null =>
      encodeFeedMeta(item.feedMeta),
  },
};
