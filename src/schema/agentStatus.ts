import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, SubscriptionContext } from '../Context';
import { redisPubSub } from '../redis';
import { getAgentStatusFromRedis } from '../routes/public/agentStatus';

interface AgentStatus {
  name: string;
  project: string;
  status: string;
  task: string;
  message?: string;
  timestamp: string;
}

export const typeDefs = /* GraphQL */ `
  type AgentStatus {
    name: String!
    project: String!
    status: String!
    task: String!
    message: String
    timestamp: String!
  }

  extend type Query {
    """
    Get the current agent status for the authenticated user
    """
    agentStatus: [AgentStatus!]! @auth
  }

  extend type Subscription {
    """
    Get notified when agent status changes
    """
    agentStatusUpdated: [AgentStatus!]! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    agentStatus: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<AgentStatus[]> => {
      return getAgentStatusFromRedis(ctx.userId);
    },
  },
  Subscription: {
    agentStatusUpdated: {
      subscribe: async (
        source,
        args,
        ctx: SubscriptionContext,
      ): Promise<AsyncIterable<{ agentStatusUpdated: AgentStatus[] }>> => {
        const iterator = redisPubSub.asyncIterator<AgentStatus[]>(
          `events.agent-status.${ctx.userId}`,
        );

        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => {
                const { done, value } = await iterator.next();
                if (done) {
                  return { done: true, value: undefined };
                }
                return {
                  done: false,
                  value: { agentStatusUpdated: value },
                };
              },
              return: async () => {
                await iterator.return?.();
                return { done: true, value: undefined };
              },
              throw: async (error: Error) => {
                await iterator.throw?.(error);
                return { done: true, value: undefined };
              },
            };
          },
        };
      },
    },
  },
});
