import type {
  SubscriptionCreatedEvent,
  SubscriptionCreatedNotification,
} from '@paddle/paddle-node-sdk';
import { randomUUID } from 'crypto';
import createOrGetConnection from '../../../db';
import { extractSubscriptionCycle, paddleInstance } from '..';
import { Organization, User } from '../../../entity';
import { ContentPreferenceOrganization } from '../../../entity/contentPreference/ContentPreferenceOrganization';
import { ContentPreferenceStatus } from '../../../entity/contentPreference/types';
import { OrganizationMemberRoles } from '../../../roles';
import {
  PurchaseType,
  SubscriptionProvider,
  SubscriptionStatus,
} from '../../plus';
import { logger } from '../../../logger';
import { isPlusMember } from '../../../paddle';
import { updateSubscriptionFlags } from '../../utils';

type PaddleCustomData = {
  user_id?: string;
};

// If the user provides business information during the checkout, we will use it
// otherwise we will use the default business name
const getBusinessName = async (
  user: User,
  data: SubscriptionCreatedNotification,
) => {
  const defaultBusinessName = `${user.name}'s new Organization`;
  if (!data.businessId) {
    return defaultBusinessName;
  }

  try {
    const business = await paddleInstance.businesses.get(
      data.customerId,
      data.businessId,
    );
    return business.name;
  } catch {
    return defaultBusinessName;
  }
};

export const createOrganizationSubscription = async ({
  event,
}: {
  event: SubscriptionCreatedEvent;
}) => {
  const organizationId = randomUUID();
  const con = await createOrGetConnection();

  const { data } = event;
  const { user_id: userId }: PaddleCustomData = data?.customData || {};

  const subscriptionType = extractSubscriptionCycle(data.items);
  if (!subscriptionType) {
    logger.error(
      {
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Organization,
        data: event,
      },
      'Subscription type missing in payload',
    );
    return false;
  }

  await con.transaction(async (manager) => {
    const user = await manager.getRepository(User).findOneByOrFail({
      id: userId,
    });

    const businessName = await getBusinessName(user, data);

    const subscriptionFlags = {
      cycle: subscriptionType,
      createdAt: data.startedAt ?? undefined,
      subscriptionId: data.id,
      provider: SubscriptionProvider.Paddle,
      status: SubscriptionStatus.Active,
    };

    const organization = await manager.getRepository(Organization).save({
      id: organizationId,
      name: businessName,
      seats: data.items[0].quantity,
      subscriptionFlags: subscriptionFlags,
    });

    await Promise.all([
      // Add the user to the organization
      manager.getRepository(ContentPreferenceOrganization).save({
        userId: userId,
        referenceId: organization.id,
        organizationId: organization.id,
        feedId: userId,
        status: ContentPreferenceStatus.Follow,
        flags: {
          role: OrganizationMemberRoles.Owner,
          referralToken: randomUUID(),
        },
      }),
      // Give the user plus access if they are not already a plus member
      !isPlusMember(user.subscriptionFlags?.cycle) &&
        con.getRepository(User).update(
          { id: userId },
          {
            subscriptionFlags: updateSubscriptionFlags({
              ...subscriptionFlags,
              organizationId: organization.id,
            }),
          },
        ),
    ]);
  });

  try {
    // Update the paddle subscription with the organization id
    // This is needed to be able to update the subscription later
    await paddleInstance.subscriptions.update(data.id, {
      customData: {
        user_id: userId,
        organization_id: organizationId,
      },
    });
  } catch (_err) {
    const err = _err as Error;
    logger.error(
      {
        err,
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Organization,
        data: event,
      },
      'Failed to update subscription with organization id',
    );
  }
};
