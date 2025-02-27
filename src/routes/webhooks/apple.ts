import { readFileSync } from 'node:fs';
import { env } from 'node:process';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { logger } from '../../logger';
import {
  Environment,
  SignedDataVerifier,
} from '@apple/app-store-server-library';
import { isProd } from '../../common';
import { singleRedisClient } from '../../redis';
import { isInSubnet } from 'is-in-subnet';

const bundleId = env.APPLE_APP_BUNDLE_ID;
const appAppleId = env.APPLE_APP_APPLE_ID;
const enableOnlineChecks = true;
const environment = isProd ? Environment.PRODUCTION : Environment.SANDBOX;

const appleRootCAs: Buffer[] = [
  readFileSync('/usr/local/share/ca-certificates/AppleIncRootCertificate.cer'),
  readFileSync('/usr/local/share/ca-certificates/AppleRootCA-G2.cer'),
  readFileSync('/usr/local/share/ca-certificates/AppleRootCA-G3.cer'),
];

const verifier = new SignedDataVerifier(
  appleRootCAs,
  enableOnlineChecks,
  environment,
  bundleId,
  appAppleId,
);

const allowedIPs = [
  '127.0.0.1/24',
  '192.168.0.0/16',
  '172.16.0.0/12',
  '10.0.0.0/8',
  '17.0.0.0/8',
];

interface AppleNotificationRequest {
  signedPayload: string;
}

export const apple = async (fastify: FastifyInstance): Promise<void> => {
  fastify.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
    redis: singleRedisClient,
    allowList: (request) => isInSubnet(request.ip, allowedIPs),
    nameSpace: 'webhooks:apple:',
  });

  // Endpoint for receiving App Store Server Notifications V2
  fastify.post(
    '/notifications',
    async (request: FastifyRequest<{ Body: AppleNotificationRequest }>) => {
      const { signedPayload } = request.body;
      const notification =
        await verifier.verifyAndDecodeNotification(signedPayload);

      logger.info(
        { notification },
        'Received Apple App Store Server Notification',
      );
      return {
        received: true,
      };
    },
  );
};
