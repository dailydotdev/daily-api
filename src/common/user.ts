import { DataSource } from 'typeorm';
import {
  Alerts,
  ArticlePost,
  Bookmark,
  BookmarkList,
  Comment,
  DevCard,
  Feed,
  Post,
  PostReport,
  Settings,
  SourceDisplay,
  SourceRequest,
  User,
  View,
} from '../entity';
import { ghostUser } from './index';
import { cancelSubscription } from './paddle';
import type { AuthContext, Context } from '../Context';
import { ForbiddenError } from 'apollo-server-errors';
import { logger } from '../logger';
import { CoresRole } from '../types';
import { remoteConfig } from '../remoteConfig';
import { UserTransaction } from '../entity/user/UserTransaction';
import { SubscriptionProvider, SubscriptionStatus } from './plus';
import { deleteUserResume } from './googleCloud';

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

    // Delete user's resume if exists
    await deleteUserResume(userId);

    await con.transaction(async (entityManager): Promise<void> => {
      await entityManager.getRepository(View).delete({ userId });
      await entityManager.getRepository(Alerts).delete({ userId });
      await entityManager.getRepository(BookmarkList).delete({ userId });
      await entityManager.getRepository(Bookmark).delete({ userId });
      await entityManager.getRepository(Comment).update(
        { userId },
        {
          userId: ghostUser.id,
        },
      );
      await entityManager.getRepository(Comment).delete({ userId });
      await entityManager.getRepository(DevCard).delete({ userId });
      await entityManager.getRepository(Feed).delete({ userId });
      await entityManager.getRepository(PostReport).delete({ userId });
      await entityManager.getRepository(Settings).delete({ userId });
      await entityManager.getRepository(SourceDisplay).delete({ userId });
      await entityManager.getRepository(SourceRequest).delete({ userId });
      await entityManager
        .getRepository(ArticlePost)
        .update({ authorId: userId }, { authorId: null });
      // Manually set shared post to 404 dummy user
      await entityManager
        .getRepository(Post)
        .update({ authorId: userId }, { authorId: ghostUser.id });
      await entityManager
        .getRepository(Post)
        .update({ scoutId: userId }, { scoutId: null });
      await entityManager.getRepository(UserTransaction).update(
        {
          senderId: userId,
        },
        {
          senderId: ghostUser.id,
        },
      );
      await entityManager.getRepository(UserTransaction).update(
        {
          receiverId: userId,
        },
        {
          receiverId: ghostUser.id,
        },
      );
      await entityManager.getRepository(User).delete(userId);
    });
    logger.info(
      {
        userId,
        messageId,
      },
      'deleted user',
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
