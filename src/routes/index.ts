import { FastifyInstance } from 'fastify';

import rss from './rss';
import alerts from './alerts';
import settings from './settings';
import redirector from './redirector';
import devcards from './devcards';
import privateRoutes from './private';
import whoami from './whoami';
import notifications from './notifications';
import boot from './boot';
import flagsmith from './flagsmith';
import users from './users';
import redirects from './redirects';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(rss, { prefix: '/rss' });
  fastify.register(alerts, { prefix: '/alerts' });
  fastify.register(settings, { prefix: '/settings' });
  fastify.register(notifications, { prefix: '/notifications' });
  fastify.register(redirector, { prefix: '/r' });
  fastify.register(devcards, { prefix: '/devcards' });
  if (process.env.ENABLE_PRIVATE_ROUTES === 'true') {
    fastify.register(privateRoutes, { prefix: '/p' });
  }
  fastify.register(whoami, { prefix: '/whoami' });
  fastify.register(boot, { prefix: '/boot' });
  fastify.register(boot, { prefix: '/new_boot' });
  fastify.register(flagsmith, { prefix: '/flagsmith' });
  fastify.register(users, { prefix: '/v1/users' });
  fastify.register(redirects);

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
}
