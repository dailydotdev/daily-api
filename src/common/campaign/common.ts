import { ValidationError } from 'apollo-server-errors';
import { Campaign, CampaignState } from '../../entity';
import { UserTransaction } from '../../entity/user/UserTransaction';
import { parseBigInt } from '../utils';
import { TransferError } from '../../errors';
import { transferCores, throwUserTransactionError } from '../njord';
import type { AuthContext } from '../../Context';
import type { EntityManager } from 'typeorm';
import { CAMPAIGN_VALIDATION_SCHEMA } from '../schema/campaigns';
import {
  type ConnectionArguments,
  cursorToOffset,
  offsetToCursor,
  type Connection,
} from 'graphql-relay';
import graphorm from '../../graphorm';
import { getLimit } from '../pagination';
import type { GraphQLResolveInfo } from 'graphql';
import type { GQLPost } from '../../schema/posts';
import type { GQLSource } from '../../schema/sources';
import type { GraphORMBuilder } from '../../graphorm/graphorm';

export interface StartCampaignArgs {
  value: string;
  duration: number;
  budget: number;
}

export interface StartCampaignMutationArgs {
  ctx: AuthContext;
  args: StartCampaignArgs;
}

export const validateCampaignArgs = (
  args: Pick<StartCampaignArgs, 'budget' | 'duration'>,
) => {
  const result = CAMPAIGN_VALIDATION_SCHEMA.safeParse(args);

  if (result.error) {
    throw new ValidationError(result.error.errors[0].message);
  }
};

interface StartCampaignTransferCoresProps {
  ctx: AuthContext;
  campaignId: string;
  userTransaction: UserTransaction;
  manager: EntityManager;
}

export const startCampaignTransferCores = async ({
  ctx,
  campaignId,
  userTransaction,
  manager,
}: StartCampaignTransferCoresProps) => {
  try {
    const transfer = await transferCores({
      ctx,
      transaction: userTransaction,
      entityManager: manager,
    });

    return {
      transfer,
      transaction: {
        referenceId: campaignId,
        transactionId: userTransaction.id,
        balance: {
          amount: parseBigInt(transfer.senderBalance?.newBalance),
        },
      },
    };
  } catch (error) {
    if (error instanceof TransferError) {
      await throwUserTransactionError({
        ctx,
        entityManager: manager,
        error,
        transaction: userTransaction,
      });
    }

    throw error;
  }
};

export const stopCampaignTransferCores = async ({
  ctx,
  campaignId,
  userTransaction,
  manager,
}: StartCampaignTransferCoresProps) => {
  try {
    const transfer = await transferCores({
      ctx,
      transaction: userTransaction,
      entityManager: manager,
    });

    return {
      transfer,
      transaction: {
        referenceId: campaignId,
        transactionId: userTransaction.id,
        balance: {
          amount: parseBigInt(transfer.receiverBalance?.newBalance),
        },
      },
    };
  } catch (error) {
    if (error instanceof TransferError) {
      await throwUserTransactionError({
        ctx,
        entityManager: manager,
        error,
        transaction: userTransaction,
      });
    }

    throw error;
  }
};

export interface StopCampaignProps {
  campaign: Campaign;
  ctx: AuthContext;
}

interface GQLCampaign
  extends Pick<
    Campaign,
    'id' | 'type' | 'flags' | 'createdAt' | 'endedAt' | 'referenceId' | 'state'
  > {
  post: GQLPost;
  source: GQLSource;
}

export const fetchCampaignsList = async (
  args: ConnectionArguments,
  ctx: AuthContext,
  info: GraphQLResolveInfo,
  qb?: (builder: GraphORMBuilder) => GraphORMBuilder,
): Promise<Connection<GQLCampaign>> => {
  const { userId } = ctx;
  const { after, first = 20 } = args;
  const offset = after ? cursorToOffset(after) : 0;

  return graphorm.queryPaginated(
    ctx,
    info,
    () => !!after,
    (nodeSize) => nodeSize === first,
    (_, i) => offsetToCursor(offset + i + 1),
    (builder) => {
      const { alias } = builder;

      builder.queryBuilder.andWhere(`"${alias}"."userId" = :userId`, {
        userId,
      });

      builder.queryBuilder.orderBy(
        `CASE WHEN "${alias}"."state" = '${CampaignState.Active}' THEN 0 ELSE 1 END`,
      );
      builder.queryBuilder.addOrderBy(`"${alias}"."createdAt"`, 'DESC');
      builder.queryBuilder.limit(getLimit({ limit: first ?? 20 }));

      if (after) {
        builder.queryBuilder.offset(offset);
      }

      return qb ? qb(builder) : builder;
    },
  );
};
