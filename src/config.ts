import dotenv from 'dotenv';

const env = process.env.NODE_ENV || 'development';

export const WEBAPP_URL =
  env === 'development' ? 'http://localhost:5002' : 'https://app.daily.dev';

dotenv.config({ path: `.env.${env}` });
dotenv.config({ path: '.env' });
