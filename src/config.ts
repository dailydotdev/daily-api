import process from 'node:process';
import dotenv from 'dotenv';

const env = process.env.NODE_ENV || 'development';

dotenv.config({ path: `.env.${env}`, quiet: true });
dotenv.config({ path: '.env', quiet: true });

export const fallbackImages = {
  avatar:
    'https://media.daily.dev/image/upload/s--O0TOmw4y--/f_auto/v1715772965/public/noProfile',
  organization:
    'https://media.daily.dev/image/upload/s--yc7EcfBs--/f_auto,q_auto/v1/public/organization_fallback',
};

export const GQL_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MiB

export const REDIS_BANNER_KEY = 'boot:latest_banner';

export const DEFAULT_SUBMISSION_LIMIT = '3';
export const DEFAULT_SUBMISSION_ACCESS_THRESHOLD = '250';

export const submissionLimit = parseInt(
  process.env.SCOUT_SUBMISSION_LIMIT || DEFAULT_SUBMISSION_LIMIT,
);

export const submissionAccessThreshold = parseInt(
  process.env.SCOUT_SUBMISSION_ACCESS_THRESHOLD ||
    DEFAULT_SUBMISSION_ACCESS_THRESHOLD,
);

export const RESUME_BUCKET_NAME = process.env.RESUME_BUCKET_NAME;
export const EMPLOYMENT_AGREEMENT_BUCKET_NAME =
  process.env.EMPLOYMENT_AGREEMENT_BUCKET_NAME;
export const YEAR_IN_REVIEW_BUCKET_NAME = 'daily-dev-year-in-review';

export enum StorageTopic {
  Boot = 'boot',
  Search = 'search',
  CIO = 'customer_io',
  Streak = 'streak',
  Njord = 'njord',
  Paddle = 'paddle',
  RedisCounter = 'redis_counter',
  Cron = 'cron',
}

export enum StorageKey {
  MarketingCta = 'marketing_cta',
  Reporting = 'reporting',
  Reset = 'reset',
  CoresBalance = 'cores_balance',
  OpenExchangeRates = 'open_exchange_rates',
  PricingPreviewPlus = 'pricing_preview_plus',
  PricingPreviewCores = 'pricing_preview_cores',
  OrganizationSubscriptionUpdatePreview = 'organization_subscription_update_preview',
  UserLastOnline = 'ulo',
}

export const generateStorageKey = (
  topic: StorageTopic,
  key: string,
  identifier: string, // mostly used for user id - "global" for global keys
): string => `${topic}:${key}:${identifier}`;

export const FEED_SURVEY_INTERVAL = 30;

export const WEBAPP_MAGIC_IMAGE_PREFIX = `/image-generator`;

export const SQL_QUERIES_PATH = '/opt/app/queries';

export const MODERATORS = [
  '1d339aa5b85c4e0ba85fdedb523c48d4',
  '28849d86070e4c099c877ab6837c61f0',
  '5e0af68445e04c02b0656c3530664aff',
  'a491ef61599a4b3e84b6dfa602e6bdfe',
];
