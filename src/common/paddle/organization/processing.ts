import type {
  SubscriptionCanceledEvent,
  SubscriptionCreatedEvent,
} from '@paddle/paddle-node-sdk';
import { randomUUID } from 'crypto';
import createOrGetConnection from '../../../db';
import {
  extractSubscriptionCycle,
  getPaddleSubscriptionData,
  paddleInstance,
  type paddleSubscriptionSchema,
} from '..';
import { Organization, User } from '../../../entity';
import {
  ContentPreferenceOrganization,
  ContentPreferenceOrganizationStatus,
} from '../../../entity/contentPreference/ContentPreferenceOrganization';
import { OrganizationMemberRole } from '../../../roles';
import {
  PurchaseType,
  SubscriptionProvider,
  SubscriptionStatus,
} from '../../plus';
import { logger } from '../../../logger';
import { isPlusMember, type PaddleSubscriptionEvent } from '../../../paddle';
import { updateSubscriptionFlags } from '../../utils';
import type { z } from 'zod';
import { In } from 'typeorm';

// If the user provides business information during the checkout, we will use it
// otherwise we will use the default business name
const getBusinessName = async (
  user: User,
  data: z.infer<typeof paddleSubscriptionSchema>,
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
  const data = getPaddleSubscriptionData({ event });
  const organizationId = randomUUID();
  const con = await createOrGetConnection();

  const { user_id: userId } = data.customData;

  const subscriptionType = extractSubscriptionCycle(
    data.items as PaddleSubscriptionEvent['data']['items'],
  );

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
      priceId: data.items[0].price.id,
      provider: SubscriptionProvider.Paddle,
      status: SubscriptionStatus.Active,
    };

    const organization = await manager.getRepository(Organization).save({
      id: organizationId,
      name: businessName,
      seats: data.items[0].quantity,
      subscriptionFlags: subscriptionFlags,
    });

    const isPlus = isPlusMember(user.subscriptionFlags?.cycle);

    await Promise.all([
      // Add the user to the organization
      manager.getRepository(ContentPreferenceOrganization).save({
        userId: userId,
        referenceId: organization.id,
        organizationId: organization.id,
        feedId: userId,
        status: isPlus
          ? ContentPreferenceOrganizationStatus.Free
          : ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: randomUUID(),
        },
      }),
      // Give the user plus access if they are not already a plus member
      !isPlus &&
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

export const cancelOrganizationSubscription = async ({
  event,
}: {
  event: SubscriptionCanceledEvent;
}) => {
  const data = getPaddleSubscriptionData({ event });
  const con = await createOrGetConnection();

  await con.transaction(async (manager) => {
    const organization = await manager.getRepository(Organization).findOne({
      where: {
        id: data.customData.organization_id,
      },
      relations: {
        members: true,
      },
      select: {
        members: {
          userId: true,
          status: true,
        },
      },
    });

    if (!organization) {
      logger.error(
        {
          provider: SubscriptionProvider.Paddle,
          purchaseType: PurchaseType.Organization,
          data: event,
        },
        'Organization not found for subscription cancellation',
      );
      return;
    }

    const members = await organization.members;
    const membersIdsToDowngrade = members
      .filter(
        (member) => member.status === ContentPreferenceOrganizationStatus.Plus,
      )
      .map((member) => member.userId);

    const subscriptionFlags = {
      cycle: null,
      status: SubscriptionStatus.Expired,
    };

    await Promise.all([
      // Update the organization subscription flags to mark it as expired
      manager.getRepository(Organization).update(
        {
          id: organization.id,
        },
        {
          subscriptionFlags: updateSubscriptionFlags(subscriptionFlags),
        },
      ),

      // Set seats of all members to Free.
      manager.getRepository(ContentPreferenceOrganization).update(
        {
          organizationId: organization.id,
        },
        {
          status: ContentPreferenceOrganizationStatus.Free,
        },
      ),

      // Update subscription flags for members with Plus access to remove subscription metadata
      manager.getRepository(User).update(
        {
          id: In(membersIdsToDowngrade),
        },
        {
          subscriptionFlags: updateSubscriptionFlags({
            ...subscriptionFlags,
            subscriptionId: null,
            createdAt: null,
            provider: null,
            organizationId: null,
            priceId: null,
          }),
        },
      ),
    ]);
  });
};
