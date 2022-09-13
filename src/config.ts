import dotenv from 'dotenv';

const env = process.env.NODE_ENV || 'development';

dotenv.config({ path: `.env.${env}` });
dotenv.config({ path: '.env' });

export const fallbackImages = {
  avatar:
    'https://daily-now-res.cloudinary.com/image/upload/t_logo,f_auto/v1635938111/logos/placeholder2',
};
