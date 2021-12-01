import { gql, ForbiddenError } from 'apollo-server-fastify';
import { IResolvers } from 'graphql-tools';
import { v4 as uuidv4 } from 'uuid';
import {
  forwardPagination,
  PaginationResponse,
  GQLDataInput,
  GQLDataIdInput,
  GQLIdInput,
  offsetPageGenerator,
} from './common';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Source, SourceFeed, SourceRequest } from '../entity';
import { fetchUserInfo, getRelayNodeInfo, uploadLogo } from '../common';
import { GraphQLResolveInfo } from 'graphql';
import { FileUpload } from 'graphql-upload';

export interface GQLSourceRequest {
  id: string;
  sourceUrl: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  approved?: boolean;
  closed: boolean;
  sourceId?: string;
  sourceName?: string;
  sourceImage?: string;
  sourceTwitter?: string;
  sourceFeed?: string;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GQLRequestSourceInput extends Partial<GQLSourceRequest> {
  sourceUrl: string;
}

export interface GQLUpdateSourceRequestInput extends Partial<GQLSourceRequest> {
  sourceUrl?: string;
  sourceId?: string;
  sourceName?: string;
  sourceImage?: string;
  sourceTwitter?: string;
  sourceFeed?: string;
}

export interface GQLDeclineSourceRequestInput
  extends Partial<GQLSourceRequest> {
  reason: string;
}

export const typeDefs = gql`
  """
  Community request for a new source
  """
  type SourceRequest {
    """
    Unique identifier
    """
    id: ID!

    """
    URL to the source website
    """
    sourceUrl: String!

    """
    Id of the user who requested this source
    """
    userId: ID!

    """
    Name of the user who requested this source
    """
    userName: String

    """
    Email of the user who requested this source
    """
    userEmail: String

    """
    Whether this request was approved
    """
    approved: Boolean

    """
    Whether this request is closed
    """
    closed: Boolean!

    """
    Id for the future source
    """
    sourceId: ID

    """
    Name of the future source
    """
    sourceName: String

    """
    URL for thumbnail image of the future source
    """
    sourceImage: String

    """
    Twitter handle of the future source
    """
    sourceTwitter: String

    """
    Feed (RSS/Atom) of the future source
    """
    sourceFeed: String

    """
    Reason for not accepting this request
    """
    reason: String

    """
    Time when the request was received
    """
    createdAt: DateTime!

    """
    Time of last update
    """
    updatedAt: DateTime!
  }

  type SourceRequestConnection {
    pageInfo: PageInfo!
    edges: [SourceRequestEdge!]!
  }

  type SourceRequestEdge {
    node: SourceRequest!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  input DeclineSourceRequestInput {
    """
    Reason for not accepting this request
    """
    reason: String!
  }

  input RequestSourceInput {
    """
    URL to the source website
    """
    sourceUrl: String! @url
  }

  input UpdateSourceRequestInput {
    """
    URL to the source website
    """
    sourceUrl: String @url

    """
    Id for the future source
    """
    sourceId: ID

    """
    Name of the future source
    """
    sourceName: String

    """
    URL for thumbnail image of the future source
    """
    sourceImage: String @url

    """
    Twitter handle of the future source
    """
    sourceTwitter: String

    """
    Feed (RSS/Atom) of the future source
    """
    sourceFeed: String @url
  }

  extend type Mutation {
    """
    Request a new source
    """
    requestSource(data: RequestSourceInput!): SourceRequest! @auth

    """
    Update the information of a source request
    """
    updateSourceRequest(
      data: UpdateSourceRequestInput!
      id: String!
    ): SourceRequest! @auth(requires: [MODERATOR])

    """
    Decline a source request
    """
    declineSourceRequest(
      data: DeclineSourceRequestInput!
      id: String!
    ): SourceRequest! @auth(requires: [MODERATOR])

    """
    Approve a source request (but doesn't publish it)
    """
    approveSourceRequest(id: String!): SourceRequest!
      @auth(requires: [MODERATOR])

    """
    Publish a source request and turn it into a source
    """
    publishSourceRequest(id: String!): SourceRequest!
      @auth(requires: [MODERATOR])

    """
    Upload a logo to a source request
    """
    uploadSourceRequestLogo(file: Upload!, id: String!): SourceRequest!
      @auth(requires: [MODERATOR])
  }

  extend type Query {
    """
    Get all pending source requests
    """
    pendingSourceRequests(
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
    ): SourceRequestConnection! @auth(requires: [MODERATOR])
  }
`;

const findOrFail = async (
  ctx: Context,
  id: string,
): Promise<GQLSourceRequest> => {
  const req = await ctx.getRepository(SourceRequest).findOneOrFail(id);
  if (req.closed) {
    throw new ForbiddenError(
      'Access denied! Source request is already closed!',
    );
  }
  return req;
};

const partialUpdateSourceRequest = async (
  ctx: Context,
  id: string,
  data: Partial<GQLSourceRequest>,
): Promise<GQLSourceRequest> => {
  const req = await findOrFail(ctx, id);
  const repo = ctx.getRepository(SourceRequest);
  return repo.save(repo.merge(req, data));
};

const createSourceFromRequest = (
  ctx: Context,
  req: SourceRequest,
): Promise<Source> =>
  ctx.con.manager.transaction(async (entityManager): Promise<Source> => {
    const source = entityManager.create(Source, {
      id: req.sourceId,
      twitter: req.sourceTwitter,
      website: req.sourceUrl,
      name: req.sourceName,
      image: req.sourceImage,
    });
    await entityManager.save(source);

    const feed = entityManager.create(SourceFeed, {
      feed: req.sourceFeed,
      sourceId: source.id,
    });
    await entityManager.save(feed);

    return source;
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    requestSource: async (
      source,
      { data }: GQLDataInput<GQLRequestSourceInput>,
      ctx,
    ): Promise<GQLSourceRequest> => {
      const info = await fetchUserInfo(ctx.userId);
      const repo = ctx.getRepository(SourceRequest);
      const sourceReq = repo.create({
        sourceUrl: data.sourceUrl,
        userId: ctx.userId,
        userName: info.name,
        userEmail: info.email,
      });
      await repo.save(sourceReq);
      return sourceReq;
    },
    updateSourceRequest: async (
      source,
      { id, data }: GQLDataIdInput<GQLUpdateSourceRequestInput>,
      ctx,
    ): Promise<GQLSourceRequest> => {
      return partialUpdateSourceRequest(ctx, id, data);
    },
    declineSourceRequest: async (
      source,
      { id, data }: GQLDataIdInput<GQLDeclineSourceRequestInput>,
      ctx,
    ): Promise<GQLSourceRequest> => {
      return partialUpdateSourceRequest(ctx, id, {
        approved: false,
        closed: true,
        ...data,
      });
    },
    approveSourceRequest: async (
      source,
      { id }: GQLIdInput,
      ctx,
    ): Promise<GQLSourceRequest> => {
      return partialUpdateSourceRequest(ctx, id, {
        approved: true,
      });
    },
    publishSourceRequest: async (
      source,
      { id }: GQLIdInput,
      ctx,
    ): Promise<GQLSourceRequest> => {
      const req = await findOrFail(ctx, id);
      if (
        !req.sourceId ||
        !req.sourceName ||
        !req.sourceImage ||
        !req.sourceFeed ||
        !req.approved
      ) {
        throw new ForbiddenError(
          'Access denied! Source request cannot be published!',
        );
      }
      await createSourceFromRequest(ctx, req);
      req.closed = true;
      await ctx.getRepository(SourceRequest).save(req);
      ctx.log.info(
        {
          sourceRequest: req,
        },
        `published new source ${req.id}`,
      );
      return req;
    },
    uploadSourceRequestLogo: async (
      source,
      { id, file }: GQLIdInput & { file: FileUpload },
      ctx,
    ): Promise<GQLSourceRequest> => {
      const req = await findOrFail(ctx, id);
      const { createReadStream } = await file;
      const stream = createReadStream();
      const name = uuidv4().replace(/-/g, '');
      const img = await uploadLogo(name, stream);
      ctx.log.info(
        {
          sourceRequest: req,
          img,
        },
        'uploaded image for source request',
      );
      req.sourceImage = img;
      return ctx.getRepository(SourceRequest).save(req);
    },
  },
  Query: {
    pendingSourceRequests: forwardPagination(
      async (
        source,
        args,
        ctx,
        { limit, offset },
        info: GraphQLResolveInfo,
      ): Promise<PaginationResponse<GQLSourceRequest>> => {
        const [rows, total] = await ctx.loader.loadManyPaginated<SourceRequest>(
          SourceRequest,
          { closed: false },
          getRelayNodeInfo(info),
          {
            limit,
            offset,
          },
          { order: { '"createdAt"': 'ASC' } },
        );
        return {
          total,
          nodes: rows,
        };
      },
      offsetPageGenerator(100, 500),
    ),
  },
});
