import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import createOrGetConnection from '../../db';
import { UserMarketingCta } from '../../entity';
import { cachePrefillMarketingCta } from '../../schema/users';
import { logger } from '../../logger';

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

export const customerio = async (fastify: FastifyInstance): Promise<void> => {
  fastify.addHook<MarketingCtaPayload>('preValidation', async (req, res) => {
    const valid = verifyCIOSignature(process.env.CIO_WEBHOOK_SECRET, req);
    if (!valid) {
      return res.status(403).send({ error: 'Invalid signature' });
    }
  });

  fastify.post<MarketingCtaPayload>('/marketing_cta', {
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

  fastify.delete<MarketingCtaPayload>('/marketing_cta', {
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
};
