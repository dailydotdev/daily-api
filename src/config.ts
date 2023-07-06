import dotenv from 'dotenv';

const env = process.env.NODE_ENV || 'development';

dotenv.config({ path: `.env.${env}` });
dotenv.config({ path: '.env' });

export const fallbackImages = {
  avatar:
    'https://daily-now-res.cloudinary.com/image/upload/f_auto/v1664367305/placeholders/placeholder3',
};

export const REDIS_CHANGELOG_KEY = 'boot:latest_changelog';

export enum StorageTopic {
  Boot = 'boot',
}

export const generateStorageKey = (
  topic: StorageTopic,
  key: string,
  identifier = 'global',
): string => `${topic}:${key}:${identifier}`;
