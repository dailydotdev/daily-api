import { updateSubscriptionFlags } from './common';
import { SubscriptionStatus } from './common/plus';
import { revokeAllUserTokens } from './common/personalAccessToken';
import createOrGetConnection from './db';
import { User, type UserSubscriptionFlags } from './entity';

export const updateStoreKitUserSubscription = async ({
  userId,
  data,
  status,
}: {
  userId: string;
  data?: Omit<UserSubscriptionFlags, 'status'>;
  status?: SubscriptionStatus;
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
  const subscriptionFlags =
    status === SubscriptionStatus.Expired
      ? { status, appAccountToken: data.appAccountToken }
      : updateSubscriptionFlags({ ...clone, status });

  await con.getRepository(User).update(
    {
      id: userId,
    },
    {
      subscriptionFlags: subscriptionFlags,
    },
  );

  // Revoke all API tokens when subscription expires
  if (status === SubscriptionStatus.Expired) {
    await revokeAllUserTokens(con, userId);
  }
};
