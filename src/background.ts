import 'reflect-metadata';
import fastify from 'fastify';
import { FastifyInstance } from 'fastify';
import helmet from 'fastify-helmet';

import './config';
import './profiler';

import trace from './trace';

import { createOrGetConnection } from './db';
import { stringifyHealthCheck } from './common';
import { workers } from './workers';
import { crons } from './cron';
import { PubSub } from '@google-cloud/pubsub';

export default async function app(): Promise<FastifyInstance> {
  const isProd = process.env.NODE_ENV === 'production';
  const connection = await createOrGetConnection();
  const pubsub = new PubSub();

  const app = fastify({
    logger: true,
    disableRequestLogging: true,
    trustProxy: isProd,
  });

  app.register(helmet);
  app.register(trace, { enabled: isProd });

  app.get('/health', (req, res) => {
    res.type('application/health+json');
    res.send(stringifyHealthCheck({ status: 'ok' }));
  });

  workers.forEach((worker) => {
    app.post(`/${worker.subscription}`, async (req, res) => {
      const { body } = req;
      if (!body?.message) {
        req.log.warn('empty worker body');
        return res.status(400).send();
      }
      await worker.handler(body.message, connection, req.log, pubsub);
      return res.status(204).send();
    });
  });

  crons.forEach((worker) => {
    app.post(`/${worker.name}`, async (req, res) => {
      const { body } = req;
      await worker.handler(connection, app.log, pubsub, body);
      return res.status(204).send();
    });
  });

  return app;
}
