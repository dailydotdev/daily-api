import type {
  SubscriptionCanceledEvent,
  SubscriptionCreatedEvent,
} from '@paddle/paddle-node-sdk';
import { extractSubscriptionCycle, getPaddleSubscriptionData } from '../index';
import type { PaddleSubscriptionEvent } from '../../../paddle';
import createOrGetConnection from '../../../db';
import {
  PurchaseType,
  SubscriptionProvider,
  SubscriptionStatus,
} from '../../plus/subscription';
import { logger } from '../../../logger';
import { OpportunityJob } from '../../../entity/opportunities/OpportunityJob';
import {
  recruiterPaddleCustomDataSchema,
  recruiterPaddlePricingCustomDataSchema,
} from './types';
import {
  ensureOpportunityPermissions,
  OpportunityPermissions,
} from '../../opportunity/accessControl';
import {
  updateFlagsStatement,
  updateRecruiterSubscriptionFlags,
} from '../../utils';
import { OpportunityState } from '@dailydotdev/schema';
import { Organization } from '../../../entity/Organization';
import { User } from '../../../entity/user/User';
import { DeletedUser } from '../../../entity/user/DeletedUser';
import type { EntityManager } from 'typeorm';

const checkUserValid = async ({
  userId,
  con,
  event,
}: {
  userId: string;
  con: EntityManager;
  event: SubscriptionCreatedEvent | SubscriptionCanceledEvent;
}): Promise<boolean> => {
  const user = await con.getRepository(User).exists({
    where: { id: userId },
  });

  if (!user) {
    const deletedUser = await con.getRepository(DeletedUser).exists({
      where: { id: userId },
    });

    logger.warn(
      {
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Recruiter,
        data: event,
      },
      deletedUser
        ? 'User is deleted during payment processing'
        : 'User not found during payment processing',
    );

    return false;
  }

  return true;
};

export const createOpportunitySubscription = async ({
  event,
}: {
  event: SubscriptionCreatedEvent;
}) => {
  const data = getPaddleSubscriptionData({ event });
  const con = await createOrGetConnection();
  const { opportunity_id, user_id } = recruiterPaddleCustomDataSchema.parse(
    event.data.customData,
  );

  const subscriptionType = extractSubscriptionCycle(
    data.items as PaddleSubscriptionEvent['data']['items'],
  );

  if (!subscriptionType) {
    logger.error(
      {
        provider: SubscriptionProvider.Paddle,
        purchaseType: PurchaseType.Recruiter,
        data: event,
      },
      'Subscription type missing in payload',
    );

    return false;
  }

  const isUserValid = await checkUserValid({
    userId: user_id,
    con: con.manager,
    event,
  });

  if (!isUserValid) {
    return;
  }

  const opportunity: Pick<
    OpportunityJob,
    'id' | 'organizationId' | 'organization'
  > = await con.getRepository(OpportunityJob).findOneOrFail({
    select: ['id', 'organizationId', 'organization'],
    where: {
      id: opportunity_id,
    },
    relations: {
      organization: true,
    },
  });

  const organization = await opportunity.organization;

  if (!organization) {
    throw new Error(
      'Opportunity does not have organization during payment processing, can not assign subscription, manual fixup needed',
    );
  }

  if (
    organization.recruiterSubscriptionFlags?.status ===
    SubscriptionStatus.Active
  ) {
    throw new Error('Organization already has active recruiter subscription');
  }

  await ensureOpportunityPermissions({
    con: con.manager,
    userId: user_id,
    opportunityId: opportunity_id,
    permission: OpportunityPermissions.Edit,
  });

  if (event.data?.items?.length > 1) {
    throw new Error(
      'Multiple recruiter subscription items not supported on creation, check payment manually',
    );
  }

  const price = event.data?.items?.[0]?.price;

  if (!price) {
    throw new Error(
      'Price information missing from recruiter subscription data',
    );
  }

  const priceCustomData = recruiterPaddlePricingCustomDataSchema.parse(
    price.customData,
  );

  await con.transaction(async (entityManager) => {
    await entityManager.getRepository(Organization).update(
      {
        id: organization.id,
      },
      {
        recruiterSubscriptionFlags:
          updateRecruiterSubscriptionFlags<Organization>({
            cycle: subscriptionType,
            createdAt: data.startedAt ?? new Date(),
            updatedAt: new Date(),
            subscriptionId: data.id,
            provider: SubscriptionProvider.Paddle,
            status: SubscriptionStatus.Active,
            items: data.items.map((item) => {
              return {
                priceId: item.price.id,
                quantity: item.quantity,
              };
            }),
          }),
      },
    );

    await entityManager.getRepository(OpportunityJob).update(
      {
        id: opportunity.id,
      },
      {
        flags: updateFlagsStatement<OpportunityJob>({
          batchSize: priceCustomData.batch_size,
          plan: price.id,
          reminders: priceCustomData.reminders,
          showSlack: priceCustomData.show_slack,
          showFeedback: priceCustomData.show_feedback,
        }),
      },
    );
  });
};

export const cancelRecruiterSubscription = async ({
  event,
}: {
  event: SubscriptionCanceledEvent;
}) => {
  const con = await createOrGetConnection();
  const { opportunity_id, user_id } = recruiterPaddleCustomDataSchema.parse(
    event.data.customData,
  );

  const isUserValid = await checkUserValid({
    userId: user_id,
    con: con.manager,
    event,
  });

  if (!isUserValid) {
    return;
  }

  const opportunity: Pick<
    OpportunityJob,
    'id' | 'organizationId' | 'organization'
  > = await con.getRepository(OpportunityJob).findOneOrFail({
    select: ['id', 'organizationId', 'organization'],
    where: {
      id: opportunity_id,
    },
    relations: {
      organization: true,
    },
  });

  await ensureOpportunityPermissions({
    con: con.manager,
    userId: user_id,
    opportunityId: opportunity_id,
    permission: OpportunityPermissions.UpdateState,
  });

  const organization = await opportunity.organization;

  if (!organization) {
    throw new Error(
      'Opportunity does not have organization during payment processing, can not cancel subscription, manual fixup needed',
    );
  }

  const subscriptionFlags: Organization['recruiterSubscriptionFlags'] = {
    cycle: null,
    status: SubscriptionStatus.Cancelled,
    updatedAt: new Date(),
    items: [],
  };

  await con.transaction(async (entityManager) => {
    await entityManager.getRepository(Organization).update(
      {
        id: organization.id,
      },
      {
        recruiterSubscriptionFlags:
          updateRecruiterSubscriptionFlags<Organization>(subscriptionFlags),
      },
    );

    await entityManager.getRepository(OpportunityJob).update(
      {
        organizationId: organization.id,
      },
      {
        state: OpportunityState.CLOSED,
      },
    );
  });
};
