import dotenv from 'dotenv';

const env = process.env.NODE_ENV || 'development';

dotenv.config({ path: `.env.${env}` });
dotenv.config({ path: '.env' });

export const fallbackImages = {
  avatar:
    'https://res.cloudinary.com/daily-now/image/upload/s--O0TOmw4y--/f_auto/v1715772965/public/noProfile',
};

export const REDIS_BANNER_KEY = 'boot:latest_banner';

export enum StorageTopic {
  Boot = 'boot',
  Search = 'search',
  CIO = 'customer_io',
  Streak = 'streak',
}

export enum StorageKey {
  MarketingCta = 'marketing_cta',
  Reporting = 'reporting',
  Reset = 'reset',
}

export const generateStorageKey = (
  topic: StorageTopic,
  key: string,
  identifier: string, // mostly used for user id - "global" for global keys
): string => `${topic}:${key}:${identifier}`;

export const FEED_SURVEY_INTERVAL = 30;
