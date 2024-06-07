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
import { UserPersonalizedDigest, UserPersonalizedDigestType } from '../entity';
import { notifyGeneratePersonalizedDigest } from '../common';
import { PersonalizedDigestFeatureConfig } from '../growthbook';
import privateRpc from './privateRpc';
import { connectRpcPlugin } from '../common/connectRpc';

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
    fastify.register(connectRpcPlugin, {
      routes: privateRpc,
      prefix: '/p/rpc',
    });
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

  fastify.get('/v1/auth/authorize', async (req, res) => {
    return res.type('text/plain').send(
      `Firefox has recently changed their approval process and in their wisdom have set us back to a 2022 version of the daily.dev extension.
You can follow the discussion here.
https://x.com/dailydotdev/status/1798960336667893866

In the interim we suggest using the web version.
https://app.daily.dev`,
    );
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

  fastify.post<{
    Body: { userIds: string[]; config?: PersonalizedDigestFeatureConfig };
  }>('/digest/send', async (req, res) => {
    const authorization = req.headers.authorization;

    if (
      !authorization ||
      authorization !== `Bearer ${process.env.PERSONALIZED_DIGEST_SECRET}`
    ) {
      return res.status(401).send({
        message: 'unauthorized',
      });
    }

    const userCountLimit = 100;
    res.header('content-type', 'application/json');

    const { userIds, config } = req.body || {};

    if (!Array.isArray(userIds)) {
      return res.status(400).send({ message: 'userIds must be an array' });
    }

    if (userIds.length > userCountLimit) {
      return res.status(400).send({
        message: `too many userIds`,
      });
    }

    const timestamp = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const previousDate = new Date(timestamp - oneWeek);

    await Promise.allSettled(
      userIds.map(async (userId) => {
        const con = await createOrGetConnection();
        const personalizedDigest = await con
          .getRepository(UserPersonalizedDigest)
          .findOneBy({ userId, type: UserPersonalizedDigestType.Digest });

        if (!personalizedDigest) {
          return;
        }

        await notifyGeneratePersonalizedDigest({
          log: req.log,
          personalizedDigest,
          emailSendTimestamp: timestamp,
          previousSendTimestamp: previousDate.getTime(),
          deduplicate: false,
          config,
        });
      }),
    );

    return res.status(201).send({
      message: 'ok',
    });
  });
}
