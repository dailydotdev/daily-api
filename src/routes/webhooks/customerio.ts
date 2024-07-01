import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import createOrGetConnection from '../../db';
import { UserMarketingCta } from '../../entity';
import { logger } from '../../logger';
import { cachePrefillMarketingCta } from '../../common/redisCache';
import { sendAnalyticsEvent } from '../../integrations/analytics';
import { triggerTypedEvent } from '../../common';
import { addDays } from 'date-fns';
import { pushToRedisList } from '../../redis';
import { StorageKey, StorageTopic, generateStorageKey } from '../../config';

const verifyCIOSignature = (
  webhookSigningSecret: string,
  req: FastifyRequest,
): boolean => {
  const timestamp = req.headers['x-cio-timestamp'] as string;
  const signature = req.headers['x-cio-signature'] as string;

  if (!timestamp || !signature) {
    return false;
  }

  const hmac = createHmac('sha256', webhookSigningSecret);
  hmac.update(`v0:${timestamp}:`);
  hmac.update(req.rawBody);

  const hash = hmac.digest();
  if (!timingSafeEqual(hash, Buffer.from(signature, 'hex'))) {
    logger.debug("CIO Signature didn't match");
    return false;
  }

  logger.debug('CIO Signature matched!');
  return true;
};

type MarketingCtaPayload = {
  Body: {
    userId: string;
    marketingCtaId: string;
  };
};

type PromotedPostPayload = {
  Body: {
    userId: string;
    postId: string;
  };
};

type ReportingEvent = {
  Body: {
    data: {
      action_id?: number;
      broadcast_id?: number;
      customer_id: string;
      identifiers: {
        id: string;
      };
      delivery_id: string;
      recipient?: string;
      email_address?: string;
    };
    event_id: string;
    trigger_event_id?: string;
    object_type: string;
    metric: string;
    timestamp: number;
  };
};

const subscriptionMetrics = [
  'cio_subscription_preferences_changed',
  'subscribed',
  'unsubscribed',
];

async function trackCioEvent(payload: ReportingEvent['Body']): Promise<void> {
  const dupPayload = { ...payload, data: { ...payload.data } };
  const userId = dupPayload.data.identifiers.id;
  // Delete personal data
  delete dupPayload.data.identifiers;
  delete dupPayload.data.recipient;

  const event = {
    event_timestamp: new Date(dupPayload.timestamp * 1000),
    event_id: dupPayload.event_id,
    session_id: dupPayload.event_id,
    visit_id: dupPayload.event_id,
    user_id: userId,
    event_name: `${dupPayload.object_type} ${dupPayload.metric}`,
    app_platform: 'customerio',
    extra: JSON.stringify(dupPayload.data),
  };
  await sendAnalyticsEvent([event]);
}

export const customerio = async (fastify: FastifyInstance): Promise<void> => {
  fastify.register(
    async (fastify: FastifyInstance): Promise<void> => {
      fastify.addHook<MarketingCtaPayload>(
        'preValidation',
        async (req, res) => {
          const valid = verifyCIOSignature(process.env.CIO_WEBHOOK_SECRET, req);
          if (!valid) {
            return res.status(403).send({ error: 'Invalid signature' });
          }
        },
      );

      fastify.post<MarketingCtaPayload>('/', {
        config: {
          rawBody: true,
        },
        handler: async (req, res) => {
          try {
            const { userId, marketingCtaId } = req.body;

            const con = await createOrGetConnection();
            await con.getRepository(UserMarketingCta).upsert(
              {
                userId: userId,
                marketingCtaId: marketingCtaId,
              },
              ['userId', 'marketingCtaId'],
            );

            await cachePrefillMarketingCta(con, userId);

            return res.send({ success: true });
          } catch (err) {
            logger.error({ err }, 'Error processing CIO webhook');
            return res.status(400).send({ success: false });
          }
        },
      });

      fastify.post<MarketingCtaPayload>('/delete', {
        config: {
          rawBody: true,
        },
        handler: async (req, res) => {
          try {
            const { userId, marketingCtaId } = req.body;

            const con = await createOrGetConnection();
            await con.getRepository(UserMarketingCta).delete({
              userId: userId,
              marketingCtaId: marketingCtaId,
            });

            await cachePrefillMarketingCta(con, userId);

            return res.send({ success: true });
          } catch (err) {
            logger.error({ err }, 'Error processing CIO webhook');
            return res.status(400).send({ success: false });
          }
        },
      });
    },
    { prefix: '/marketing_cta' },
  );

  fastify.post<PromotedPostPayload>('/promote_post', {
    config: {
      rawBody: true,
    },
    handler: async (req, res) => {
      const valid = verifyCIOSignature(process.env.CIO_WEBHOOK_SECRET, req);
      if (!valid) {
        req.log.warn('cio promote post webhook invalid signature');
        return res.status(403).send({ error: 'Invalid signature' });
      }

      try {
        const { userId, postId } = req.body;

        const validUntil = addDays(new Date(), 7);

        await triggerTypedEvent(logger, 'api.v1.user-post-promoted', {
          userId: userId,
          postId: postId,
          validUntil: validUntil.toISOString(),
        });

        return res.send({ success: true });
      } catch (err) {
        logger.error({ err }, 'Error processing CIO webhook');
        return res.status(400).send({ success: false });
      }
    },
  });

  fastify.post<ReportingEvent>('/reporting', {
    config: {
      rawBody: true,
    },
    handler: async (req, res) => {
      const valid = verifyCIOSignature(
        process.env.CIO_REPORTING_WEBHOOK_SECRET,
        req,
      );
      if (!valid) {
        req.log.warn('cio reporting webhook invalid signature');
        return res.status(403).send({ error: 'Invalid signature' });
      }

      const payload = req.body;

      if (subscriptionMetrics.includes(payload.metric)) {
        // const con = await createOrGetConnection();
        // await syncSubscription(payload.data.identifiers.id, con);
        pushToRedisList(
          generateStorageKey(StorageTopic.CIO, StorageKey.Reporting, 'global'),
          payload.data.identifiers.id,
        );
      }

      await trackCioEvent(payload);
      if (req.meter) {
        req.meter
          .createCounter('cio_events', {
            description: 'How many customerio events were sent to analytics',
          })
          .add(1);
      }

      return res.send({ success: true });
    },
  });
};
