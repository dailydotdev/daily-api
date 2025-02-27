import { readFileSync } from 'node:fs';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { logger } from '../../logger';
import {
  Environment,
  SignedDataVerifier,
} from '@apple/app-store-server-library';
import { isProd } from '../../common';
import { env } from 'node:process';

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

interface AppleNotificationRequest {
  signedPayload: string;
}

export const apple = async (fastify: FastifyInstance): Promise<void> => {
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
