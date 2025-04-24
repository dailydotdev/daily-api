import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../../logger';
import {
  Environment,
  NotificationTypeV2,
  SignedDataVerifier,
  VerificationException,
  type JWSRenewalInfoDecodedPayload,
} from '@apple/app-store-server-library';
import { concatTextToNewline, isTest, webhooks } from '../../common';
import { isInSubnet } from 'is-in-subnet';
import { isNullOrUndefined } from '../../common/object';
import createOrGetConnection from '../../db';
import { SubscriptionProvider, User } from '../../entity';
import { JsonContains } from 'typeorm';
import type { Block, KnownBlock } from '@slack/web-api';
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
  handleCoresPurchase,
  isCorePurchaseApple,
} from '../../common/apple/purchase';
import { handleAppleSubscription } from '../../common/apple/subscription';
import { loadAppleRootCAs } from '../../common/apple/utils';

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

    const decodedInfo = await verifyAndDecodeAppleSignedData({
      notification,
      environment,
      verifier,
    });

    if (!decodedInfo) {
      return response.status(400).send({ error: 'Invalid Payload' });
    }

    const con = await createOrGetConnection();
    const user = await con.getRepository(User).findOne({
      select: ['id', 'subscriptionFlags'],
      where: {
        subscriptionFlags: JsonContains({
          appAccountToken: decodedInfo.appAccountToken,
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

    switch (getAppleTransactionType({ decodedInfo })) {
      case AppleTransactionType.Consumable:
        if (isCorePurchaseApple({ decodedInfo })) {
          await handleCoresPurchase({
            decodedInfo,
            user,
            environment,
            notification,
          });
        } else {
          throw new Error('Unsupported Apple Consumable transaction type');
        }
        break;
      case AppleTransactionType.AutoRenewableSubscription:
        await handleAppleSubscription({
          decodedInfo,
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
        decodedInfo,
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

export const notifyNewStoreKitSubscription = async (
  data: JWSRenewalInfoDecodedPayload,
  user: User,
  currencyInUSD: number,
) => {
  if (isTest) {
    return;
  }

  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'New Plus subscriber :moneybag: :apple-ico:',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Transaction ID:*', data.appTransactionId),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*App Account Token:*',
            data.appAccountToken,
          ),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Type:*', data.autoRenewProductId),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Purchased by:*',
            `<https://app.daily.dev/${user.id}|${user.id}>`,
          ),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Cost:*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(currencyInUSD || 0),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency:*', 'USD'),
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: concatTextToNewline(
            '*Cost (local):*',
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: data.currency,
            }).format((data.renewalPrice || 0) / 1000),
          ),
        },
        {
          type: 'mrkdwn',
          text: concatTextToNewline('*Currency (local):*', data.currency),
        },
      ],
    },
  ];

  await webhooks.transactions.send({ blocks });
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
