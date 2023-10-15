import { FastifyInstance } from 'fastify';

const ads = [
  {
    description:
      'Increase your dev team productivity by using feature-rich JavaScript UI widgets',
    image:
      'https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/1',
    link: 'https://daily.dev',
    source: 'daily',
    company: 'DAILY',
    providerId: 'direct',
    id: 'daily_ad1',
    placeholder: '',
    ratio: 2,
  },
  {
    description:
      'Instantly find bottlenecks, slow SQL queries and request calls',
    image:
      'https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/2',
    link: 'https://daily.dev',
    source: 'EthicalAds',
    company: 'EthicalAds',
    providerId: 'ethical',
    pixel: [],
    referralLink: 'https://daily.dev',
  },
  {
    description:
      'Let us know what you think of the daily.dev extension on the chrome store!',
    image:
      'https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/3',
    link: 'https://daily.dev',
    source: 'cs1_glass',
    company: 'daily.dev',
    providerId: '',
    id: 'cs1_glass',
    placeholder: '',
    ratio: 2,
  },
  {
    description:
      'Add passwordless login to your app in minutes. Passkeys, 2FA, Social Logins, & more. Start for free.',
    image:
      'https://res.cloudinary.com/daily-now/image/upload/f_auto/v1/placeholders/4',
    link: 'https://daily.dev',
    source: 'Carbon',
    company: 'Carbon',
    providerId: 'carbon',
    pixel: [],
    referralLink: 'https://daily.dev',
  },
];

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/v1/a', (req, res) => {
    return res.status(200).send([ads[Math.floor(Math.random() * ads.length)]]);
  });
}
