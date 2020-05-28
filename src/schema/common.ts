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

export interface PaginationResponse<TReturn, TExtra = {}> {
  count?: number;
  hasNextPage?: boolean;
  nodes: TReturn[];
  extra?: TExtra;
}

interface Page {
  limit: number;
  offset: number;
}

type PaginationResolver<TSource, TReturn, TExtra = {}> = (
  source: TSource,
  args: ConnectionArguments,
  context: Context,
  page: Page,
  info: GraphQLResolveInfo & {
    mergeInfo: MergeInfo;
  },
) => Promise<PaginationResponse<TReturn, TExtra>>;

export function forwardPagination<TSource, TReturn, TExtra = {}>(
  resolver: PaginationResolver<TSource, TReturn, TExtra>,
  defaultLimit: number,
): IFieldResolver<TSource, Context, ConnectionArguments> {
  return async (
    source,
    args,
    context,
    info,
  ): Promise<Connection<TReturn> & TExtra> => {
    const page = {
      limit: args.first || defaultLimit,
      offset: getOffsetWithDefault(args.after, -1) + 1,
    };
    const { count, hasNextPage, nodes, extra = null } = await resolver(
      source,
      args,
      context,
      page,
      info,
    );

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
        cursor: offsetToCursor(page.offset + i),
      }),
    );
    return {
      pageInfo: {
        startCursor: edges[0].cursor,
        endCursor: edges[edges.length - 1].cursor,
        hasNextPage:
          count === undefined
            ? hasNextPage
            : page.offset + nodes.length < count,
        hasPreviousPage: page.offset > 0,
      },
      edges,
      ...extra,
    };
  };
}
