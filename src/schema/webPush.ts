import { IResolvers } from '@graphql-tools/utils';
import { AuthContext, BaseContext } from '../Context';
import {
  syncWebPushSubscriptionSchema,
  type SyncWebPushSubscriptionInput,
} from '../common/schema/webPush';
import { cleanupStaleOneSignalWebSubscriptions } from '../onesignal';

type GQLSyncWebPushSubscriptionResult = {
  cleanedUpSubscriptions: number;
};

export const typeDefs = /* GraphQL */ `
  input SyncWebPushSubscriptionInput {
    subscriptionId: ID
    origin: String
    optedIn: Boolean = true
  }

  type SyncWebPushSubscriptionResult {
    cleanedUpSubscriptions: Int!
  }

  extend type Mutation {
    syncWebPushSubscription(
      input: SyncWebPushSubscriptionInput
    ): SyncWebPushSubscriptionResult! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = {
  Mutation: {
    syncWebPushSubscription: async (
      _,
      args: { input?: SyncWebPushSubscriptionInput },
      ctx: AuthContext,
    ): Promise<GQLSyncWebPushSubscriptionResult> => {
      const input = syncWebPushSubscriptionSchema.parse(args.input ?? {});

      if (!input.optedIn) {
        return { cleanedUpSubscriptions: 0 };
      }

      try {
        const cleanedUpSubscriptions =
          await cleanupStaleOneSignalWebSubscriptions(ctx.userId);

        return { cleanedUpSubscriptions };
      } catch (err) {
        ctx.log.error(
          {
            err,
            userId: ctx.userId,
            subscriptionId: input.subscriptionId,
            origin: input.origin,
          },
          'failed to clean up stale OneSignal web subscriptions',
        );

        return { cleanedUpSubscriptions: 0 };
      }
    },
  },
};
