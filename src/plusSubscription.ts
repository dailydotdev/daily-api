import { updateSubscriptionFlags } from './common';
import createOrGetConnection from './db';
import {
  UserSubscriptionStatus,
  User,
  type UserSubscriptionFlags,
} from './entity';

export const updateUserSubscription = async ({
  userId,
  data,
  status,
}: {
  userId: string;
  data?: Omit<UserSubscriptionFlags, 'status'>;
  status?: UserSubscriptionStatus;
}) => {
  if (!data) {
    return;
  }

  // Remove appAccountToken from data, to make sure we don't accidentally update it
  if (data.appAccountToken) {
    delete data.appAccountToken;
  }

  const con = await createOrGetConnection();

  // Convert all keys in data to null when status is expired
  const subscriptionFlags = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      status === UserSubscriptionStatus.Expired ? null : value,
    ]),
  );

  await con.getRepository(User).update(
    {
      id: userId,
    },
    {
      subscriptionFlags: updateSubscriptionFlags({
        ...subscriptionFlags,
        status,
      }),
    },
  );
};
