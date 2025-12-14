import { FastifyInstance, type FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';

const ads = [
  {
    tagLine: 'Ready to take your app to the next level?',
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
    backgroundColor: '#fff',
    matchingTags: [
      'cicd',
      'devtools',
      'automation',
      'kubernetes',
      'infrastructure',
      'sre',
      'docker',
      'observability',
    ],
    adDomain: 'getstream.io',
  },
  {
    tagLine: 'Ready to take your app to the next level?',
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
    backgroundColor: '#fff',
    matchingTags: [
      'cicd',
      'devtools',
      'automation',
      'kubernetes',
      'infrastructure',
      'sre',
      'docker',
      'observability',
    ],
    adDomain: 'getstream.io',
  },
  {
    tagLine: 'Ready to take your app to the next level?',
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
    backgroundColor: '#fff',
    matchingTags: [
      'cicd',
      'devtools',
      'automation',
      'kubernetes',
      'infrastructure',
      'sre',
      'docker',
      'observability',
    ],
    adDomain: 'getstream.io',
  },
  {
    tagLine: 'Ready to take your app to the next level?',
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
    backgroundColor: '#fff',
    matchingTags: [
      'cicd',
      'devtools',
      'automation',
      'kubernetes',
      'infrastructure',
      'sre',
      'docker',
      'observability',
    ],
    adDomain: 'getstream.io',
  },
];

const skadiGenerationIdHeader = 'x-generation-id';

const addSkadiGenerationHeaders = (reply: FastifyReply) => {
  return reply.headers({
    [skadiGenerationIdHeader]: randomUUID(),
    'access-control-expose-headers': skadiGenerationIdHeader,
  });
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/v1/a', (req, res) => {
    return addSkadiGenerationHeaders(res)
      .status(200)
      .send([ads[Math.floor(Math.random() * ads.length)]]);
  });

  fastify.get('/v1/a/post', (req, res) => {
    return addSkadiGenerationHeaders(res)
      .status(200)
      .send([ads[Math.floor(Math.random() * ads.length)]]);
  });
}
