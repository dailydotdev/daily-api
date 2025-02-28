import { readFile } from 'node:fs/promises';
import { env } from 'node:process';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { logger } from '../../logger';
import {
  Environment,
  SignedDataVerifier,
} from '@apple/app-store-server-library';
import { isTest } from '../../common';
import { isInSubnet } from 'is-in-subnet';
import { isNullOrUndefined } from '../../common/object';

const certificatesToLoad = isTest
  ? ['__tests__/fixture/testCA.der']
  : [
      '/usr/local/share/ca-certificates/AppleIncRootCertificate.cer',
      '/usr/local/share/ca-certificates/AppleRootCA-G2.cer',
      '/usr/local/share/ca-certificates/AppleRootCA-G3.cer',
    ];

const loadAppleRootCAs = async (): Promise<Buffer[]> => {
  const appleRootCAs: Buffer[] = await Promise.all(
    certificatesToLoad.map(async (certPath) => await readFile(certPath)),
  );

  logger.debug(`Loaded ${appleRootCAs.length} Apple's Root CAs`);
  return appleRootCAs;
};

const getVerifierEnvironment = (): Environment => {
  switch (env.NODE_ENV) {
    case 'production':
      return Environment.PRODUCTION;
    case 'development':
      return Environment.SANDBOX;
    case 'test':
      return Environment.LOCAL_TESTING;
    default:
      throw new Error("Invalid 'NODE_ENV' value");
  }
};

const bundleId = isTest ? 'dev.fylla' : env.APPLE_APP_BUNDLE_ID;
const appAppleId = env.APPLE_APP_APPLE_ID;
const enableOnlineChecks = true;
const environment = getVerifierEnvironment();

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
        enableOnlineChecks,
        environment,
        bundleId,
        appAppleId,
      );

      const { signedPayload } = request.body || {};

      if (isNullOrUndefined(signedPayload)) {
        logger.info(
          { body: request.body },
          "Missing 'signedPayload' in request body",
        );
        return response.status(403).send({ error: 'Invalid Payload' });
      }

      try {
        const notification =
          await verifier.verifyAndDecodeNotification(signedPayload);

        logger.info(
          { notification },
          'Received Apple App Store Server Notification',
        );
        return {
          received: true,
        };
      } catch (_err) {
        const err = _err as Error;
        logger.error(
          { err },
          'Failed to verify Apple App Store Server Notification',
        );
        return response.status(403).send({ error: 'Invalid Payload' });
      }
    },
  );
};
