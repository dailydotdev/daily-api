import { IFieldResolver, IResolvers } from '@graphql-tools/utils';
import {
  Connection,
  ConnectionArguments,
  Edge,
  getOffsetWithDefault,
  offsetToCursor,
} from 'graphql-relay';
import { GraphQLResolveInfo } from 'graphql';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.js';
import { GraphQLDateTime } from 'graphql-scalars';

import { Context } from '../Context';

export interface GQLEmptyResponse {
  _: boolean;
}

export interface GQLDataInput<T> {
  data: T;
}

export interface GQLIdInput {
  id: string;
}

export type GQLDataIdInput<T> = GQLIdInput & GQLDataInput<T>;

export const typeDefs = /* GraphQL */ `
  """
  The javascript \`Date\` as string. Type represents date and time as the ISO Date string.
  """
  scalar DateTime

  input ConnectionArgs {
    """
    Paginate before opaque cursor
    """
    before: String

    """
    Paginate after opaque cursor
    """
    after: String

    """
    Paginate first
    """
    first: Int

    """
    Paginate last
    """
    last: Int
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  """
  Used for mutations with empty response
  """
  type EmptyResponse {
    """
    Every type must have at least one field
    """
    _: Boolean
  }

  enum CacheControlScope {
    PUBLIC
    PRIVATE
  }

  directive @cacheControl(
    maxAge: Int
    scope: CacheControlScope
    inheritMaxAge: Boolean
  ) on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

  scalar Upload
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  DateTime: GraphQLDateTime,
  Upload: GraphQLUpload,
};

export interface PaginationResponse<TReturn, TExtra = undefined> {
  nodes: TReturn[];
  extra?: TExtra;
  total?: number;
}

export interface Page {
  limit: number;
}

export interface OffsetPage extends Page {
  offset: number;
}

export interface CursorPage extends Page {
  cursor?: string;
}

export interface PageGenerator<
  TReturn,
  TArgs extends ConnectionArguments,
  TPage extends Page,
  TParams = undefined,
> {
  connArgsToPage: (args: TArgs) => TPage;
  nodeToCursor: (
    page: TPage,
    args: TArgs,
    node: TReturn,
    index: number,
    queryParams?: TParams,
  ) => string;
  hasNextPage: (
    page: TPage,
    nodesSize: number,
    total?: number,
    queryParams?: TParams,
  ) => boolean;
  hasPreviousPage: (
    page: TPage,
    nodesSize: number,
    total?: number,
    queryParams?: TParams,
  ) => boolean;
  transformNodes?: (
    page: TPage,
    nodes: TReturn[],
    queryParams?: TParams,
  ) => TReturn[];
}

export const getSearchQuery = (param: string): string =>
  `SELECT to_tsquery('english', ${param}) AS query`;

export const processSearchQuery = (query: string): string =>
  query.trim().split(' ').join(' & ') + ':*';

export const offsetPageGenerator = <TReturn>(
  defaultLimit: number,
  maxLimit: number,
  totalLimit?: number,
): PageGenerator<TReturn, ConnectionArguments, OffsetPage, unknown> => ({
  connArgsToPage: (args: ConnectionArguments): OffsetPage => {
    const limit = Math.min(args.first || defaultLimit, maxLimit);
    const offset = getOffsetWithDefault(args.after, -1) + 1;
    return {
      limit: totalLimit ? Math.min(limit, totalLimit - offset) : limit,
      offset,
    };
  },
  nodeToCursor: (page, args, node, i): string =>
    offsetToCursor(page.offset + i),
  hasNextPage: (page, nodesSize, total): boolean =>
    total
      ? page.offset + nodesSize < total
      : (page.offset + nodesSize < totalLimit || !totalLimit) &&
        page.limit === nodesSize,
  hasPreviousPage: (page): boolean => page.offset > 0,
});

export const fixedIdsPageGenerator = <
  TReturn extends { id: string; feedMeta?: string },
>(
  defaultLimit: number,
  maxLimit: number,
  totalLimit?: number,
): PageGenerator<
  TReturn,
  ConnectionArguments,
  OffsetPage,
  { data: [string, string][]; cursor?: string }
> => ({
  connArgsToPage: (args: ConnectionArguments): OffsetPage => {
    const limit = Math.min(args.first || defaultLimit, maxLimit) + 1;
    const offset = getOffsetWithDefault(args.after, -1) + 1;
    return {
      limit: totalLimit ? Math.min(limit, totalLimit - offset) : limit,
      offset,
    };
  },
  nodeToCursor: (page, args, node, i, queryParams): string =>
    offsetToCursor(
      page.offset +
        queryParams.data.findIndex(([postId]) => postId === node.id),
    ),
  hasNextPage: (page, nodesSize, total, queryParams): boolean =>
    queryParams.data.length >= page.limit,
  hasPreviousPage: (page): boolean => page.offset > 0,
  transformNodes: (page, nodes, queryParams) => {
    // Add the metadata object
    return nodes.slice(0, page.limit - 1).map((node) => ({
      ...node,
      feedMeta: queryParams.data.find(([postId]) => postId === node.id)?.[1],
    }));
  },
});

export const feedCursorPageGenerator = <
  TReturn extends { id: string; feedMeta?: string },
>(
  defaultLimit: number,
  maxLimit: number,
): PageGenerator<
  TReturn,
  ConnectionArguments,
  CursorPage,
  { data: [string, string][]; cursor?: string }
> => ({
  connArgsToPage: (args: ConnectionArguments): CursorPage => {
    const limit = Math.min(args.first || defaultLimit, maxLimit);
    return {
      limit,
      cursor: args.after,
    };
  },
  nodeToCursor: (page, args, node, i, queryParams): string =>
    queryParams.cursor,
  hasNextPage: (page, nodesSize, total, queryParams): boolean =>
    queryParams.data.length >= page.limit,
  hasPreviousPage: (page): boolean => !!page.cursor,
  transformNodes: (page, nodes, queryParams) => {
    // Add the metadata object
    return nodes.map((node) => ({
      ...node,
      feedMeta: queryParams.data.find(([postId]) => postId === node.id)?.[1],
    }));
  },
});

type PaginationResolver<
  TSource,
  TReturn,
  TPage extends Page,
  TExtra = undefined,
> = (
  source: TSource,
  args: ConnectionArguments,
  context: Context,
  page: TPage,
  info: GraphQLResolveInfo,
) => Promise<PaginationResponse<TReturn, TExtra>>;

export function connectionFromNodes<
  TReturn,
  TArgs extends ConnectionArguments,
  TPage extends Page,
  TExtra = undefined,
  TParams = undefined,
>(
  args: TArgs,
  nodes: TReturn[],
  extra: TExtra,
  page: TPage,
  pageGenerator: PageGenerator<TReturn, TArgs, TPage, TParams>,
  total?: number,
  queryParams?: TParams,
): Connection<TReturn> & TExtra {
  const transformedNodes = pageGenerator.transformNodes?.(page, nodes) ?? nodes;
  if (!transformedNodes.length) {
    return {
      pageInfo: {
        startCursor: null,
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      edges: [],
      ...extra,
    };
  }

  const edges = transformedNodes.map(
    (n, i): Edge<TReturn> => ({
      node: n,
      cursor: pageGenerator.nodeToCursor(page, args, n, i, queryParams),
    }),
  );
  return {
    pageInfo: {
      startCursor: edges[0].cursor,
      endCursor: edges[edges.length - 1].cursor,
      hasNextPage: pageGenerator.hasNextPage(page, nodes.length, total),
      hasPreviousPage: pageGenerator.hasPreviousPage(page, nodes.length, total),
    },
    edges,
    ...extra,
  };
}

export function forwardPagination<
  TSource,
  TReturn,
  TArgs extends ConnectionArguments,
  TPage extends Page,
  TExtra = undefined,
>(
  resolver: PaginationResolver<TSource, TReturn, TPage, TExtra>,
  pageGenerator: PageGenerator<TReturn, TArgs, TPage>,
): IFieldResolver<TSource, Context, TArgs> {
  return async (
    source,
    args,
    context,
    info,
  ): Promise<Connection<TReturn> & TExtra> => {
    const page = pageGenerator.connArgsToPage(args);
    const {
      total,
      nodes,
      extra = null,
    } = await resolver(source, args, context, page, info);
    return connectionFromNodes(args, nodes, extra, page, pageGenerator, total);
  };
}
