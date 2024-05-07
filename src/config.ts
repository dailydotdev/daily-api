import dotenv from 'dotenv';
import { WATERCOOLER_ID } from './common';

const env = process.env.NODE_ENV || 'development';

dotenv.config({ path: `.env.${env}` });
dotenv.config({ path: '.env' });

export const fallbackImages = {
  avatar:
    'https://daily-now-res.cloudinary.com/image/upload/f_auto/v1664367305/placeholders/placeholder3',
};

export const REDIS_BANNER_KEY = 'boot:latest_banner';

export enum StorageTopic {
  Boot = 'boot',
  Search = 'search',
}

export enum StorageKey {
  MarketingCta = 'marketing_cta',
}

export const generateStorageKey = (
  topic: StorageTopic,
  key: string,
  identifier: string, // mostly used for user id - "global" for global keys
): string => `${topic}:${key}:${identifier}`;

export const highRateLimitedSquads = [WATERCOOLER_ID];
