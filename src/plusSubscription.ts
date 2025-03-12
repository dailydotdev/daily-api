import { updateSubscriptionFlags } from './common';
import createOrGetConnection from './db';
import {
  UserSubscriptionStatus,
  User,
  type UserSubscriptionFlags,
} from './entity';

export const updateStoreKitUserSubscription = async ({
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

  const clone = structuredClone(data);

  // Remove appAccountToken from data, to make sure we don't accidentally update it
  if (clone.appAccountToken) {
    delete clone.appAccountToken;
  }

  const con = await createOrGetConnection();

  // Convert all keys in data to null when status is expired
  const subscriptionFlags = Object.fromEntries(
    Object.entries(clone).map(([key, value]) => [
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
