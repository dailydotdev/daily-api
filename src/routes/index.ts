import { FastifyInstance } from 'fastify';

import rss from './rss';
import alerts from './alerts';
import settings from './settings';
import redirector from './redirector';
import devcards from './devcards';
import privateRoutes from './private';
import privateSnotraRoutes from './privateSnotra';
import whoami from './whoami';
import notifications from './notifications';
import boot from './boot';
import users from './users';
import redirects from './redirects';
import webhooks from './webhooks';
import localAds from './localAds';
import automations from './automations';
import sitemaps from './sitemaps';
import createOrGetConnection from '../db';
import { UserPersonalizedDigest } from '../entity';
import {
  getPersonalizedDigestPreviousSendDate,
  getPersonalizedDigestSendDate,
  notifyGeneratePersonalizedDigest,
} from '../common';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(rss, { prefix: '/rss' });
  fastify.register(alerts, { prefix: '/alerts' });
  fastify.register(settings, { prefix: '/settings' });
  fastify.register(notifications, { prefix: '/notifications' });
  fastify.register(redirector, { prefix: '/r' });
  fastify.register(devcards, { prefix: '/devcards' });
  if (process.env.ENABLE_PRIVATE_ROUTES === 'true') {
    fastify.register(privateRoutes, { prefix: '/p' });
    fastify.register(privateSnotraRoutes, { prefix: '/p/snotra' });
  }
  fastify.register(whoami, { prefix: '/whoami' });
  fastify.register(boot, { prefix: '/boot' });
  fastify.register(boot, { prefix: '/new_boot' });
  fastify.register(users, { prefix: '/v1/users' });
  fastify.register(webhooks, { prefix: '/webhooks' });
  fastify.register(redirects);
  fastify.register(automations, { prefix: '/auto' });
  fastify.register(sitemaps, { prefix: '/sitemaps' });

  fastify.get('/robots.txt', (req, res) => {
    return res.type('text/plain').send(`User-agent: *
Allow: /devcards/
Disallow: /`);
  });

  if (process.env.NODE_ENV === 'development') {
    fastify.register(localAds);
  }

  fastify.get('/id', (req, res) => {
    return res.status(200).send(req.userId);
  });

  // Debugging endpoint
  fastify.post('/e', (req, res) => {
    req.log.debug({ body: req.body }, 'events received');
    return res.status(204).send();
  });

  fastify.post('/e/x', (req, res) => {
    req.log.debug({ body: req.body }, 'allocation received');
    return res.status(204).send();
  });

  fastify.post<{ Body: { userIds: string[] } }>(
    '/digest/send',
    async (req, res) => {
      // TODO AS-122-email-schedule-endpoint authenticate here

      const userCountLimit = 100;
      res.header('content-type', 'application/json');

      const { userIds } = req.body || {};

      if (!Array.isArray(userIds)) {
        return res.status(400).send({ message: 'userIds must be an array' });
      }

      if (userIds.length > userCountLimit) {
        return res.status(400).send({
          message: `too many userIds`,
        });
      }

      const timestamp = Date.now();

      await Promise.allSettled(
        userIds.map(async (userId) => {
          const con = await createOrGetConnection();
          const personalizedDigest = await con
            .getRepository(UserPersonalizedDigest)
            .findOneBy({ userId });

          if (!personalizedDigest) {
            return;
          }

          await notifyGeneratePersonalizedDigest({
            log: req.log,
            personalizedDigest,
            emailSendTimestamp: getPersonalizedDigestSendDate({
              personalizedDigest,
              generationTimestamp: timestamp,
            }).getTime(),
            previousSendTimestamp: getPersonalizedDigestPreviousSendDate({
              personalizedDigest,
              generationTimestamp: timestamp,
            }).getTime(),
            deduplicate: false,
          });
        }),
      );

      return res.status(201).send({
        message: 'ok',
      });
    },
  );
}
