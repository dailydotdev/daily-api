import dotenv from 'dotenv';

const env = process.env.NODE_ENV || 'development';

dotenv.config({ path: `.env.${env}` });
dotenv.config({ path: '.env' });

export const fallbackImages = {
  avatar:
    'https://daily-now-res.cloudinary.com/image/upload/f_auto/v1664367305/placeholders/placeholder3',
};

export const REDIS_CHANGELOG_KEY = 'boot:latest_changelog';

export const cookies = {
  tracking: {
    opts: {
      maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
      overwrite: true,
      httpOnly: false,
      signed: false,
      secure: false,
      sameSite: 'lax',
    },
    key: 'da2',
  },
  session: {
    opts: {
      maxAge: 1000 * 60 * 30,
      overwrite: true,
      httpOnly: false,
      signed: false,
      secure: false,
      sameSite: 'lax',
    },
    key: 'das',
  },
  auth: {
    opts: {
      maxAge: 1000 * 60 * 15,
      overwrite: true,
      httpOnly: true,
      signed: true,
      secure: env === 'production',
      sameSite: 'lax',
    },
    key: 'da3',
  },
  kratos: {
    key: 'ory_kratos_session',
    opts: {
      signed: false,
      overwrite: true,
      httpOnly: true,
      secure: env === 'production',
      sameSite: 'lax',
    },
  },
};
