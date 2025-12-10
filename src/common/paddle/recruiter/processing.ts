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
import { recruiterPaddleCustomDataSchema } from './types';
import {
  ensureOpportunityPermissions,
  OpportunityPermissions,
} from '../../opportunity/accessControl';
import { updateSubscriptionFlags } from '../../utils';

export const createOpportunitySubscription = async ({
  event,
}: {
  event: SubscriptionCreatedEvent;
}) => {
  const data = getPaddleSubscriptionData({ event });
  const con = await createOrGetConnection();
  const { opportunity_id, user_id } = recruiterPaddleCustomDataSchema.parse(
    data.customData,
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

  const opportunity = await con.getRepository(OpportunityJob).findOneOrFail({
    where: {
      id: opportunity_id,
    },
  });

  await ensureOpportunityPermissions({
    con: con.manager,
    userId: user_id,
    opportunityId: opportunity_id,
    permission: OpportunityPermissions.Edit,
  });

  await con.getRepository(OpportunityJob).update(
    {
      id: opportunity.id,
    },
    {
      subscriptionFlags: updateSubscriptionFlags<OpportunityJob>({
        cycle: subscriptionType,
        createdAt: data.startedAt ?? undefined,
        subscriptionId: data.id,
        priceId: data.items[0].price.id,
        provider: SubscriptionProvider.Paddle,
        status: SubscriptionStatus.Active,
      }),
    },
  );
};

export const cancelRecruiterSubscription = async ({
  event,
}: {
  event: SubscriptionCanceledEvent;
}) => {
  const data = getPaddleSubscriptionData({ event });
  const con = await createOrGetConnection();
  const { opportunity_id, user_id } = recruiterPaddleCustomDataSchema.parse(
    data.customData,
  );

  const opportunity = await con.getRepository(OpportunityJob).findOneOrFail({
    where: {
      id: opportunity_id,
    },
  });

  await ensureOpportunityPermissions({
    con: con.manager,
    userId: user_id,
    opportunityId: opportunity_id,
    permission: OpportunityPermissions.Edit,
  });

  const subscriptionFlags = {
    cycle: null,
    status: SubscriptionStatus.Expired,
  };

  con.getRepository(OpportunityJob).update(
    {
      id: opportunity.id,
    },
    {
      subscriptionFlags:
        updateSubscriptionFlags<OpportunityJob>(subscriptionFlags),
    },
  );
};
