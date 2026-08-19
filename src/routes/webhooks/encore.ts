import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import createOrGetConnection from '../../db';
import { EncoreOfferCompletion } from '../../entity/EncoreOfferCompletion';
import { encoreOfferCompletedSchema } from '../../common/schema/encoreWebhook';
import { logger } from '../../logger';

// Encore signs hex-encoded HMAC-SHA256 over `<timestamp>.<raw body>`; a stale
// timestamp outside this window is treated as a replay.
const signatureFreshnessSeconds = 5 * 60;

const verifyEncoreSignature = (
  webhookSecret: string,
  req: FastifyRequest,
): boolean => {
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;

  if (!signature || !timestamp || !req.rawBody) {
    return false;
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > signatureFreshnessSeconds) {
    return false;
  }

  const hmac = createHmac('sha256', webhookSecret);
  hmac.update(`${timestamp}.${req.rawBody}`);
  const expectedSignature = hmac.digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch {
    return false;
  }
};

export const encore = async (fastify: FastifyInstance): Promise<void> => {
  fastify.post('/', {
    config: {
      rawBody: true,
    },
    handler: async (req, res) => {
      const webhookSecret = process.env.ENCORE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.warn('ENCORE_WEBHOOK_SECRET not configured');
        return res.status(503).send({ error: 'Webhook not configured' });
      }

      if (!verifyEncoreSignature(webhookSecret, req)) {
        req.log.warn('encore webhook invalid signature');
        return res.status(403).send({ error: 'Invalid signature' });
      }

      const parsed = encoreOfferCompletedSchema.safeParse(req.body);
      if (!parsed.success) {
        // Delivery is one attempt with no retries: a non-2xx is logged and
        // dropped on Encore's side, so unknown shapes are acknowledged and
        // logged rather than rejected.
        req.log.warn(
          { issues: parsed.error.issues },
          'encore webhook payload rejected',
        );
        return res.status(200).send({ success: true });
      }

      const payload = parsed.data;

      try {
        const con = await createOrGetConnection();
        // transactionId is Encore's idempotency key — duplicates are ignored
        await con
          .createQueryBuilder()
          .insert()
          .into(EncoreOfferCompletion)
          .values({
            transactionId: payload.transactionId,
            userId: payload.userId,
            campaignName: payload.campaignName,
            payout: payload.payout,
            completedAt: new Date(payload.timestamp),
          })
          .orIgnore()
          .execute();
      } catch (err) {
        // Never bubble a 5xx back: Encore won't retry, so the event would be
        // lost either way — keep the 200 and surface the failure in logs.
        req.log.error(
          { err, transactionId: payload.transactionId },
          'failed to store encore offer completion',
        );
      }

      return res.status(200).send({ success: true });
    },
  });
};
