import { Environment } from '@apple/app-store-server-library';
import { env } from 'node:process';
import { isTest } from '../utils';
import { SubscriptionCycles } from '../../paddle';

export const certificatesToLoad = isTest
  ? ['__tests__/fixture/testCA.der']
  : [
      '/usr/local/share/ca-certificates/AppleIncRootCertificate.cer',
      '/usr/local/share/ca-certificates/AppleRootCA-G2.cer',
      '/usr/local/share/ca-certificates/AppleRootCA-G3.cer',
    ];

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

export const bundleId = isTest ? 'dev.fylla' : env.APPLE_APP_BUNDLE_ID;
export const appAppleId = parseInt(env.APPLE_APP_APPLE_ID);
export const appleEnableOnlineChecks = true;
export const appleEnvironment = getVerifierEnvironment();
export const appleIssuerId = env.APPLE_ISSUER_ID;
export const appleAppStoreServerClientKey =
  env.APPLE_APP_STORE_SERVER_CLIENT_KEY;
export const appleAppStoreServerClientKeyId =
  env.APPLE_APP_STORE_SERVER_CLIENT_KEY_ID;

export const allowedIPs = [
  '127.0.0.1/24',
  '192.168.0.0/16',
  '172.16.0.0/12',
  '10.0.0.0/8',

  // Production IPs. These are the IPs that Apple uses to send notifications.
  // https://developer.apple.com/documentation/appstoreservernotifications/enabling-app-store-server-notifications#Configure-an-allow-list
  '17.0.0.0/8',
];

export interface AppleNotificationRequest {
  signedPayload: string;
}

export const productIdToCycle = {
  annualSpecial: SubscriptionCycles.Yearly,
  annual: SubscriptionCycles.Yearly,
  monthly: SubscriptionCycles.Monthly,
};

export enum AppleTransactionType {
  AutoRenewableSubscription = 'Auto-Renewable Subscription',
  NonConsumable = 'Non-Consumable',
  Consumable = 'Consumable',
  NonRenewingSubscription = 'Non-Renewing Subscription',
}
