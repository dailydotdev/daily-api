import { DataSource } from 'typeorm';
import { Organization, User } from '../entity';
import { OpportunityJob } from '../entity/opportunities/OpportunityJob';
import { OpportunityUser } from '../entity/opportunities/user';
import { updateFlagsStatement } from './utils';
import { cancelSubscription } from './paddle';
import type { AuthContext, Context } from '../Context';
import { ForbiddenError } from 'apollo-server-errors';
import { logger } from '../logger';
import { CoresRole } from '../types';
import { remoteConfig } from '../remoteConfig';
import { SubscriptionProvider, SubscriptionStatus } from './plus';
import {
  deleteEmploymentAgreementByUserId,
  deleteResumeByUserId,
} from './googleCloud';
import { ConflictError } from '../errors';

export const deleteUser = async (
  con: DataSource,
  userId: string,
  messageId?: string,
) => {
  try {
    const { subscriptionFlags } = await con.getRepository(User).findOneOrFail({
      select: ['subscriptionFlags'],
      where: { id: userId },
    });

    // If the user has a subscription, we need to handle it before deletion
    if (subscriptionFlags?.subscriptionId) {
      if (
        subscriptionFlags?.provider === SubscriptionProvider.AppleStoreKit &&
        subscriptionFlags?.status === SubscriptionStatus.Active
      ) {
        throw new Error(
          'Apple subscriptions are not supported for user deletion',
        );
      }

      if (subscriptionFlags?.provider === SubscriptionProvider.Paddle) {
        const isGifted = !!subscriptionFlags.giftExpirationDate;
        // gifted subscription is a one-time payment hence not considered subscription in Paddle's terms
        if (!isGifted) {
          await cancelSubscription({
            subscriptionId: subscriptionFlags.subscriptionId,
          });
        }
        logger.info(
          {
            provider: SubscriptionProvider.Paddle,
            userId,
            isGifted,
            subscriptionId: subscriptionFlags.subscriptionId,
          },
          'Subscription cancelled user deletion',
        );
      }
    }

    // Check organization recruiter subscription conflicts before marking for deletion
    const opportunityOrganization = await con
      .getRepository(OpportunityUser)
      .createQueryBuilder('ou')
      .select('ou."opportunityId"', 'opportunityId')
      .addSelect('oj."organizationId"', 'organizationId')
      .innerJoin(OpportunityJob, 'oj', 'oj.id = ou."opportunityId"')
      .where('ou."userId" = :userId', { userId })
      .getRawMany<{
        opportunityId: string;
        organizationId: string;
      }>();

    if (opportunityOrganization.length > 0) {
      const orgsWithActiveSubscription = await con
        .getRepository(Organization)
        .createQueryBuilder('org')
        .where('org.id IN (:...ids)', {
          ids: opportunityOrganization.map((item) => item.organizationId),
        })
        .andWhere(`org."recruiterSubscriptionFlags"->>'status' = :status`, {
          status: SubscriptionStatus.Active,
        })
        .getCount();

      if (orgsWithActiveSubscription > 0) {
        throw new ConflictError(
          'Cannot delete your account because one of your organizations has an active recruiter subscription. Please cancel the subscription first.',
        );
      }
    }

    // Delete user's resume if exists
    await deleteResumeByUserId(userId);
    await deleteEmploymentAgreementByUserId({ userId, logger });

    // Mark user for async deletion — CDC will trigger the cleanup worker
    await con.getRepository(User).update(userId, {
      flags: updateFlagsStatement<User>({ inDeletion: true }),
    });

    // Immediately invalidate all sessions
    await con.query('DELETE FROM ba_session WHERE "userId" = $1', [userId]);
    await con.query(
      'DELETE FROM ba_verification WHERE identifier IN ($1, $2)',
      [`change-email:${userId}`, `signup-verify:${userId}`],
    );

    logger.info(
      {
        userId,
        messageId,
      },
      'user marked for deletion',
    );
  } catch (err) {
    logger.error(
      {
        userId,
        messageId,
        err,
      },
      'failed to delete user',
    );
    throw err;
  }
};

export /**
 * Function creator that wraps a function with auth protection
 * In this case it checks ctx contains userId but it can be expanded
 * in the future to check more advanced things.
 * This is a DX layer to make sure auth required stuff like cores
 * is protected on the function level.
 *
 * @template Props
 * @template Result
 * @param {(props: Props) => Result} fn
 * @return {Result}
 */
const createAuthProtectedFn = <
  Props extends { ctx: Pick<AuthContext, 'userId'> },
  Result,
>(
  fn: (props: Props) => Result,
) => {
  return (props: Props): Result => {
    if (!props.ctx.userId) {
      throw new ForbiddenError('Auth is required');
    }

    return fn(props);
  };
};

export const getUserCoresRole = ({ region }: { region?: string }) => {
  if (!region) {
    return CoresRole.None;
  }

  const ruleForRegion = remoteConfig.vars.coresRoleRules?.find((rule) =>
    rule.regions.includes(region),
  );

  if (ruleForRegion) {
    return ruleForRegion.role;
  }

  return CoresRole.Creator;
};

export const checkUserCoresAccess = ({
  user,
  requiredRole,
}: {
  user: Pick<User, 'id' | 'coresRole'>;
  requiredRole: CoresRole;
}): boolean => {
  if (!user) {
    return false;
  }

  if (typeof user.coresRole !== 'number') {
    return false;
  }

  if (user.coresRole < requiredRole) {
    return false;
  }

  return true;
};

export const checkCoresAccess = async ({
  ctx,
  userId,
  requiredRole,
}: {
  ctx: Context;
  userId: string;
  requiredRole: CoresRole;
}): Promise<boolean> => {
  const user = await ctx.dataLoader.user.load({
    userId,
    select: ['id', 'coresRole'],
  });

  if (!user) {
    return false;
  }

  return checkUserCoresAccess({ user, requiredRole });
};

export const hasUserProfileAnalyticsPermissions = ({
  ctx,
  userId,
}: {
  ctx: AuthContext;
  userId: string;
}): boolean => {
  const { userId: requesterId, isTeamMember } = ctx;

  if (isTeamMember) {
    return true;
  }

  if (!requesterId) {
    return false;
  }

  return requesterId === userId;
};
