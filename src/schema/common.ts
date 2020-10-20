import {
  gql,
  IFieldResolver,
  IResolvers,
  MergeInfo,
} from 'apollo-server-fastify';
import {
  Connection,
  ConnectionArguments,
  Edge,
  getOffsetWithDefault,
  offsetToCursor,
} from 'graphql-relay';
import { GraphQLResolveInfo } from 'graphql';
import { GraphQLDateTime } from 'graphql-iso-date';
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

export const typeDefs = gql`
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

  directive @auth(
    """
    Roles required for the operation (at least one)
    """
    requires: [Role] = []

    """
    Whether premium subscription is required
    """
    premium: Boolean = false
  ) on OBJECT | FIELD_DEFINITION

  enum Role {
    MODERATOR
  }

  directive @url on INPUT_FIELD_DEFINITION
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  DateTime: GraphQLDateTime,
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

export interface PageGenerator<
  TReturn,
  TArgs extends ConnectionArguments,
  TPage extends Page
> {
  connArgsToPage: (args: TArgs) => TPage;
  nodeToCursor: (
    page: TPage,
    args: TArgs,
    node: TReturn,
    index: number,
  ) => string;
  hasNextPage: (page: TPage, nodesSize: number, total?: number) => boolean;
  hasPreviousPage: (page: TPage, nodesSize: number, total?: number) => boolean;
}

export const offsetPageGenerator = <TReturn>(
  defaultLimit: number,
  maxLimit: number,
): PageGenerator<TReturn, ConnectionArguments, OffsetPage> => ({
  connArgsToPage: (args: ConnectionArguments): OffsetPage => ({
    limit: Math.min(args.first || defaultLimit, maxLimit),
    offset: getOffsetWithDefault(args.after, -1) + 1,
  }),
  nodeToCursor: (page, args, node, i): string =>
    offsetToCursor(page.offset + i),
  hasNextPage: (page, nodesSize, total): boolean =>
    total ? page.offset + nodesSize < total : page.limit === nodesSize,
  hasPreviousPage: (page): boolean => page.offset > 0,
});

type PaginationResolver<
  TSource,
  TReturn,
  TPage extends Page,
  TExtra = undefined
> = (
  source: TSource,
  args: ConnectionArguments,
  context: Context,
  page: TPage,
  info: GraphQLResolveInfo & {
    mergeInfo: MergeInfo;
  },
) => Promise<PaginationResponse<TReturn, TExtra>>;

export function connectionFromNodes<
  TReturn,
  TArgs extends ConnectionArguments,
  TPage extends Page,
  TExtra = undefined
>(
  args: TArgs,
  nodes: TReturn[],
  extra: TExtra,
  page: TPage,
  pageGenerator: PageGenerator<TReturn, TArgs, TPage>,
  total?: number,
): Connection<TReturn> & TExtra {
  if (!nodes.length) {
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

  const edges = nodes.map(
    (n, i): Edge<TReturn> => ({
      node: n,
      cursor: pageGenerator.nodeToCursor(page, args, n, i),
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
  TExtra = undefined
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
    const { total, nodes, extra = null } = await resolver(
      source,
      args,
      context,
      page,
      info,
    );
    return connectionFromNodes(args, nodes, extra, page, pageGenerator, total);
  };
}
