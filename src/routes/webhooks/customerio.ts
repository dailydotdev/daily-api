import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import createOrGetConnection from '../../db';
import { UserMarketingCta } from '../../entity';
import { logger } from '../../logger';
import { cachePrefillMarketingCta } from '../../common/redisCache';
import { sendAnalyticsEvent } from '../../integrations/analytics';

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
    };
    event_id: string;
    trigger_event_id?: string;
    object_type: string;
    metric: string;
    timestamp: number;
  };
};

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

      fastify.delete<MarketingCtaPayload>('/', {
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
      const userId = payload.data.identifiers.id;
      // Delete personal data
      delete payload.data.identifiers;
      delete payload.data.recipient;

      const event = {
        event_timestamp: new Date(payload.timestamp * 1000),
        event_id: payload.event_id,
        session_id: payload.event_id,
        visit_id: payload.event_id,
        user_id: userId,
        event_name: `${payload.object_type} ${payload.metric}`,
        app_platform: 'customerio',
        extra: JSON.stringify(payload.data),
      };
      await sendAnalyticsEvent([event]);
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
