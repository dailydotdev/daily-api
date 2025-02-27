import { readFileSync } from 'node:fs';
import { env } from 'node:process';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { logger } from '../../logger';
import {
  Environment,
  SignedDataVerifier,
} from '@apple/app-store-server-library';
import { isTest } from '../../common';
import { isInSubnet } from 'is-in-subnet';

const loadAppleRootCAs = (): Buffer[] => {
  if (isTest) {
    return [readFileSync('__tests__/fixture/testCA.der')];
  }

  return [
    readFileSync(
      '/usr/local/share/ca-certificates/AppleIncRootCertificate.cer',
    ),
    readFileSync('/usr/local/share/ca-certificates/AppleRootCA-G2.cer'),
    readFileSync('/usr/local/share/ca-certificates/AppleRootCA-G3.cer'),
  ];
};

const getVerifierEnvironment = (): Environment => {
  switch (env.NODE_ENV) {
    case 'development':
      return Environment.SANDBOX;
    case 'test':
      return Environment.LOCAL_TESTING;
    default:
      return Environment.PRODUCTION;
  }
};

const bundleId = isTest ? 'com.example' : env.APPLE_APP_BUNDLE_ID;
const appAppleId = env.APPLE_APP_APPLE_ID;
const enableOnlineChecks = true;
const environment = getVerifierEnvironment();
const appleRootCAs = loadAppleRootCAs();

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
  fastify.addHook('onRequest', async (request, res) => {
    if (!isInSubnet(request.ip, allowedIPs)) {
      return res.status(403).send({ error: 'Forbidden' });
    }
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
