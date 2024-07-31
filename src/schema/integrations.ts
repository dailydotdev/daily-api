import { IResolvers } from '@graphql-tools/utils';
import { AuthContext, BaseContext } from '../Context';
import { traceResolvers } from './trace';
import { WebClient } from '@slack/web-api';
import { logger } from '../logger';
import {
  getIntegrationToken,
  getLimit,
  getSlackIntegrationOrFail,
} from '../common';
import { GQLEmptyResponse } from './common';
import { ValidationError } from 'apollo-server-errors';
import { UserSourceIntegrationSlack } from '../entity/UserSourceIntegration';
import { Source } from '../entity';

export type GQLSlackChannels = {
  id?: string;
  name?: string;
};

export type GQLSlackChannelConnection = {
  data: GQLSlackChannels[];
  cursor?: string;
};

export const typeDefs = /* GraphQL */ `
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
  },
  Mutation: {
    slackConnectSource: async (
      _,
      args: { integrationId: string; channelId: string; sourceId: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const [slackIntegration, source] = await Promise.all([
        getSlackIntegrationOrFail({
          id: args.integrationId,
          userId: ctx.userId,
          con: ctx.con,
        }),
        ctx.con.getRepository(Source).findOneByOrFail({
          id: args.sourceId,
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
