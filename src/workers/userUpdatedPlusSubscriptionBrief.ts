import { isSpecialUser, updateFlagsStatement } from '../common';
import { TypedWorker } from './worker';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../entity';

export const userUpdatedPlusSubscriptionBriefWorker: TypedWorker<'user-updated'> =
  {
    subscription: 'api.user-updated-plus-subscribed-brief',
    handler: async (message, con) => {
      const {
        data: { newProfile: user, user: oldUser },
      } = message;

      const beforeFlags = JSON.parse(
        (oldUser.subscriptionFlags as string) || '{}',
      ) as User['subscriptionFlags'];
      const afterFlags = JSON.parse(
        (user.subscriptionFlags as string) || '{}',
      ) as User['subscriptionFlags'];

      if (isSpecialUser({ userId: user.id }) || !user.infoConfirmed) {
        return;
      }

      if (afterFlags?.subscriptionId === beforeFlags?.subscriptionId) {
        return;
      }

      if (afterFlags?.subscriptionId === '' || !afterFlags?.subscriptionId) {
        await con.getRepository(UserPersonalizedDigest).update(
          {
            userId: user.id,
            type: UserPersonalizedDigestType.Brief,
          },
          {
            type: UserPersonalizedDigestType.Digest,
            flags: updateFlagsStatement<UserPersonalizedDigest>({
              sendType: UserPersonalizedDigestSendType.workdays,
            }),
          },
        );
      } else {
        await con.getRepository(UserPersonalizedDigest).update(
          {
            userId: user.id,
            type: UserPersonalizedDigestType.Digest,
          },
          {
            type: UserPersonalizedDigestType.Brief,
            flags: updateFlagsStatement<UserPersonalizedDigest>({
              sendType: UserPersonalizedDigestSendType.daily,
            }),
          },
        );
      }
    },
  };
