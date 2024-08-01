import { IResolvers } from '@graphql-tools/utils';
import { AuthContext, BaseContext } from '../Context';
import { traceResolvers } from './trace';
import { WebClient } from '@slack/web-api';
import { logger } from '../logger';
import {
  getIntegrationToken,
  getLimit,
  getSlackIntegrationOrFail,
  toGQLEnum,
} from '../common';
import { GQLEmptyResponse } from './common';
import { ValidationError } from 'apollo-server-errors';
import {
  UserSourceIntegration,
  UserSourceIntegrationSlack,
} from '../entity/UserSourceIntegration';
import { ConflictError } from '../errors';
import graphorm from '../graphorm';
import { UserIntegrationType } from '../entity/UserIntegration';
import {
  ensureSourcePermissions,
  GQLSource,
  SourcePermissions,
} from './sources';

export type GQLSlackChannels = {
  id?: string;
  name?: string;
};

export type GQLSlackChannelConnection = {
  data: GQLSlackChannels[];
  cursor?: string;
};

export type GQLUserSourceIntegration = Pick<
  UserSourceIntegration,
  'userIntegrationId' | 'type' | 'createdAt' | 'updatedAt'
> & {
  source: GQLSource;
};

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(UserIntegrationType, 'UserIntegrationType')}

  type SlackChannel {
    id: String
    name: String
  }

  type SlackChannelConnection {
    """
    Channels list
    """
    data: [SlackChannel!]!

    """
    Next page cursor, if exists
    """
    cursor: String
  }

  type UserSourceIntegration {
    userIntegrationId: ID!
    type: String!
    createdAt: DateTime
    updatedAt: DateTime
    source: Source!
  }

  extend type Query {
    """
    Get slack channels
    """
    slackChannels(
      """
      ID of slack integration to use
      """
      integrationId: ID!

      """
      Number of channels to return
      """
      limit: Int = 10

      """
      Cursor for pagination
      """
      cursor: String
    ): SlackChannelConnection @auth

    """
    Get source integration
    """
    sourceIntegration(
      """
      ID of source
      """
      sourceId: ID!

      """
      Type of integration
      """
      type: UserIntegrationType!
    ): UserSourceIntegration @auth
  }

  extend type Mutation {
    """
    Connect source to slack channel
    """
    slackConnectSource(
      """
      ID of slack integration to use
      """
      integrationId: ID!

      """
      ID of slack channel to connect
      """
      channelId: ID!

      """
      ID of source to connect
      """
      sourceId: ID!
    ): EmptyResponse! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers({
  Query: {
    slackChannels: async (
      _,
      args: { integrationId: string; limit: number; cursor: string },
      ctx: AuthContext,
    ): Promise<GQLSlackChannelConnection> => {
      const slackIntegration = await getSlackIntegrationOrFail({
        id: args.integrationId,
        userId: ctx.userId,
        con: ctx.con,
      });

      const client = new WebClient(
        await getIntegrationToken({ integration: slackIntegration }),
      );

      const result = await client.conversations.list({
        limit: getLimit({
          limit: args.limit,
          defaultLimit: 10,
          max: 999,
        }),
        cursor: args.cursor,
        exclude_archived: true,
      });

      if (!result.ok) {
        const message = 'failed to fetch slack channels';

        logger.error(
          {
            err: new Error(result.error),
          },
          message,
        );

        throw new Error(message);
      }

      return {
        data: result.channels.map((channel) => {
          return {
            id: channel.id,
            name: channel.name,
          };
        }),
        cursor: result.response_metadata?.next_cursor,
      };
    },
    sourceIntegration: async (
      _,
      args: { sourceId: string; type: UserIntegrationType },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserSourceIntegration | null> => {
      await ensureSourcePermissions(
        ctx,
        args.sourceId,
        SourcePermissions.ConnectSlack,
      );

      return graphorm.queryOneOrFail<GQLUserSourceIntegration>(
        ctx,
        info,
        (builder) => ({
          queryBuilder: builder.queryBuilder
            .where(`"${builder.alias}"."sourceId" = :id`, { id: args.sourceId })
            .andWhere(`"${builder.alias}"."type" = :type`, { type: args.type }),
          ...builder,
        }),
      );
    },
  },
  Mutation: {
    slackConnectSource: async (
      _,
      args: { integrationId: string; channelId: string; sourceId: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const source = await ensureSourcePermissions(
        ctx,
        args.sourceId,
        SourcePermissions.ConnectSlack,
      );

      const [slackIntegration] = await Promise.all([
        getSlackIntegrationOrFail({
          id: args.integrationId,
          userId: ctx.userId,
          con: ctx.con,
        }),
      ]);

      const client = new WebClient(
        await getIntegrationToken({ integration: slackIntegration }),
      );

      const channelResult = await client.conversations.info({
        channel: args.channelId,
      });

      if (!channelResult.ok && channelResult.channel.id !== args.channelId) {
        throw new ValidationError('invalid channel');
      }

      const existing = await ctx.con
        .getRepository(UserSourceIntegrationSlack)
        .findOneBy({
          sourceId: args.sourceId,
        });

      if (existing && existing.userIntegrationId !== slackIntegration.id) {
        throw new ConflictError('source already connected to a channel');
      }

      await ctx.con.getRepository(UserSourceIntegrationSlack).upsert(
        {
          userIntegrationId: slackIntegration.id,
          sourceId: args.sourceId,
          // only one channel per source is allowed currently
          channelIds: [args.channelId],
        },
        ['userIntegrationId', 'sourceId'],
      );

      await client.conversations.join({
        channel: args.channelId,
      });

      await client.chat.postMessage({
        channel: args.channelId,
        text: `Connected source "${source.name}" to this channel 🙌`,
      });

      return { _: true };
    },
  },
});
