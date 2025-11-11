import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../../logger';
import {
  Environment,
  NotificationTypeV2,
  SignedDataVerifier,
  VerificationException,
} from '@apple/app-store-server-library';
import { isInSubnet } from 'is-in-subnet';
import { isNullOrUndefined } from '../../common/object';
import createOrGetConnection from '../../db';
import { User } from '../../entity';
import { JsonContains } from 'typeorm';
import { remoteConfig } from '../../remoteConfig';
import {
  getAppleTransactionType,
  verifyAndDecodeAppleSignedData,
} from '../../common/apple/utils';
import {
  allowedIPs,
  appAppleId,
  bundleId,
  appleEnableOnlineChecks,
  appleEnvironment,
  type AppleNotificationRequest,
  AppleTransactionType,
} from '../../common/apple/types';
import {
  handleCoresConsumptionRequest,
  handleCoresPurchase,
  isCorePurchaseApple,
} from '../../common/apple/purchase';
import { handleAppleSubscription } from '../../common/apple/subscription';
import { loadAppleRootCAs } from '../../common/apple/utils';
import { SubscriptionProvider } from '../../common/plus';

const handleNotifcationRequest = async (
  verifier: SignedDataVerifier,
  request: FastifyRequest<{ Body: AppleNotificationRequest }>,
  response: FastifyReply,
  environment: Environment,
) => {
  const { signedPayload } = request.body || {};

  if (isNullOrUndefined(signedPayload)) {
    logger.error(
      {
        environment,
        body: request.body,
        provider: SubscriptionProvider.AppleStoreKit,
      },
      "Missing 'signedPayload' in request body",
    );
    return response.status(403).send({ error: 'Invalid Payload' });
  }

  try {
    const notification =
      await verifier.verifyAndDecodeNotification(signedPayload);

    // Don't proceed any further if it's a test notification
    if (notification.notificationType === NotificationTypeV2.TEST) {
      logger.info(
        {
          environment,
          notification,
          provider: SubscriptionProvider.AppleStoreKit,
        },
        'Received Test Notification',
      );
      return response.status(200).send({ received: true });
    }

    const { transactionInfo, renewalInfo } =
      await verifyAndDecodeAppleSignedData({
        notification,
        environment,
        verifier,
      });

    if (!transactionInfo) {
      return response.status(400).send({ error: 'Invalid Payload' });
    }

    const con = await createOrGetConnection();
    const user: Pick<
      User,
      'id' | 'subscriptionFlags' | 'coresRole' | 'createdAt'
    > | null = await con.getRepository(User).findOne({
      select: ['id', 'subscriptionFlags', 'coresRole', 'createdAt'],
      where: {
        subscriptionFlags: JsonContains({
          appAccountToken: transactionInfo.appAccountToken,
        }),
      },
    });

    if (!user) {
      logger.error(
        {
          environment,
          notification,
          provider: SubscriptionProvider.AppleStoreKit,
        },
        'User not found with matching app account token',
      );
      return response.status(404).send({ error: 'Invalid Payload' });
    }

    // Only allow sandbox requests from approved users
    if (
      environment === Environment.SANDBOX &&
      !remoteConfig.vars.approvedStoreKitSandboxUsers?.includes(user.id)
    ) {
      logger.error(
        {
          environment,
          notification,
          user,
          provider: SubscriptionProvider.AppleStoreKit,
        },
        'User not approved for sandbox',
      );
      return response.status(403).send({ error: 'Invalid Payload' });
    }

    switch (getAppleTransactionType({ transactionInfo })) {
      case AppleTransactionType.Consumable:
        if (isCorePurchaseApple({ transactionInfo })) {
          switch (notification.notificationType) {
            case NotificationTypeV2.ONE_TIME_CHARGE:
              await handleCoresPurchase({
                transactionInfo,
                user,
                environment,
                notification,
              });
              break;
            case NotificationTypeV2.CONSUMPTION_REQUEST:
              await handleCoresConsumptionRequest({
                transactionInfo,
                user,
                environment,
              });
              break;
            case NotificationTypeV2.REFUND_DECLINED:
              // No action needed for refund declined on consumables
              break;
            case NotificationTypeV2.REFUND: // TODO: Handle refunds for consumables if needed - since it is Apple who decides if a refund is given, we may need to revoke the consumable
            default:
              throw new Error('Unsupported Apple Consumable notification type');
          }
        } else {
          throw new Error('Unsupported Apple Consumable transaction type');
        }
        break;
      case AppleTransactionType.AutoRenewableSubscription:
        if (!renewalInfo) {
          throw new Error('Missing renewal info for subscription');
        }

        await handleAppleSubscription({
          transactionInfo,
          renewalInfo,
          user,
          environment,
          notification,
        });
        break;
      default:
        throw new Error('Unsupported Apple transaction type');
    }

    logger.info(
      {
        transactionInfo,
        renewalInfo,
        user,
        environment,
        provider: SubscriptionProvider.AppleStoreKit,
        notification: {
          notificationType: notification.notificationType,
          subtype: notification.subtype,
        },
      },
      'Received Apple App Store Server Notification',
    );

    return response.status(200).send({ received: true });
  } catch (_err) {
    const err = _err as Error;
    if (err instanceof VerificationException) {
      logger.error(
        {
          err,
          signedPayload,
          environment,
          provider: SubscriptionProvider.AppleStoreKit,
        },
        'Failed to verify Apple App Store Server Notification',
      );
      return response.status(403).send({ error: 'Invalid Payload' });
    } else {
      logger.error(
        {
          err,
          signedPayload,
          environment,
          provider: SubscriptionProvider.AppleStoreKit,
        },
        'Failed to process Apple App Store Server Notification',
      );
      return response.status(500).send({ error: 'Internal Server Error' });
    }
  }
};

export const apple = async (fastify: FastifyInstance): Promise<void> => {
  let appleRootCAs: Buffer[] = [];
  fastify.addHook('onRequest', async (request, res) => {
    if (!isInSubnet(request.ip, allowedIPs)) {
      return res.status(403).send({ error: 'Forbidden' });
    }

    if (appleRootCAs.length === 0) {
      appleRootCAs = await loadAppleRootCAs();
    }
  });

  // Endpoint for receiving App Store Server Notifications V2
  fastify.post(
    '/notifications',
    async (
      request: FastifyRequest<{ Body: AppleNotificationRequest }>,
      response,
    ) => {
      const verifier = new SignedDataVerifier(
        appleRootCAs,
        appleEnableOnlineChecks,
        appleEnvironment,
        bundleId,
        appAppleId,
      );

      await handleNotifcationRequest(
        verifier,
        request,
        response,
        appleEnvironment,
      );
    },
  );

  fastify.post(
    '/notifications/sandbox',
    async (
      request: FastifyRequest<{ Body: AppleNotificationRequest }>,
      response,
    ) => {
      const verifier = new SignedDataVerifier(
        appleRootCAs,
        appleEnableOnlineChecks,
        Environment.SANDBOX,
        bundleId,
        appAppleId,
      );

      await handleNotifcationRequest(
        verifier,
        request,
        response,
        Environment.SANDBOX,
      );
    },
  );
};
