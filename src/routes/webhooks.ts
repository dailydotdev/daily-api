import { FastifyInstance, FastifyRequest } from 'fastify';
import { EventWebhook, EventWebhookHeader } from '@sendgrid/eventwebhook';
import createOrGetConnection from '../db';
import { User } from '../entity';
import { In } from 'typeorm';
import { sendAnalyticsEvent } from '../integrations/analytics';
import { customerio } from './webhooks/customerio';
import { counters } from '../telemetry';
import { paddle } from './webhooks/paddle';
import { apple } from './webhooks/apple';
import { linear } from './webhooks/linear';

type SendgridEvent = {
  email: string;
  timestamp: number;
  'smtp-id': string;
  event: string;
  category: string;
  sg_event_id: string;
  sg_message_id: string;
  url?: string;
  useragent?: string;
  asm_group_id?: number;
  type?: string;
  url_offset?: {
    index: number;
  };
  sg_machine_open?: boolean;
  template_id?: string;
  template_version_id?: string;
  sg_template_id?: string;
} & Record<string, unknown>;

const verifySendgridRequest = (
  publicKey: string,
  req: FastifyRequest,
): boolean => {
  const eventWebhook = new EventWebhook();
  const ecPublicKey = eventWebhook.convertPublicKeyToECDSA(publicKey);

  const signature = req.headers[
    EventWebhookHeader.SIGNATURE().toLowerCase()
  ] as string;
  const timestamp = req.headers[
    EventWebhookHeader.TIMESTAMP().toLowerCase()
  ] as string;

  return eventWebhook.verifySignature(
    ecPublicKey,
    req.rawBody!,
    signature,
    timestamp,
  );
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: SendgridEvent[] }>('/sendgrid/analytics', {
    config: {
      rawBody: true,
    },
    handler: async (req, res) => {
      const body = req.body as SendgridEvent[];

      // Verify the signature provided by SendGrid: https://www.twilio.com/docs/serverless/functions-assets/quickstart/validate-webhook-requests-from-sendgrid
      const valid = verifySendgridRequest(
        process.env.SENDGRID_WEBHOOK_ANALYTICS_KEY,
        req,
      );
      if (!valid) {
        return res.status(204).send();
      }

      // Look for the users of the emails in the events
      const emails = Array.from(new Set(body.map((event) => event.email)));
      const con = await createOrGetConnection();
      const userIds = await con.getRepository(User).find({
        select: ['id', 'email'],
        where: { email: In(emails) },
      });
      const userIdsMap = userIds.reduce(
        (acc, user) => {
          acc[user.email] = user.id;
          return acc;
        },
        {} as Record<string, string>,
      );

      // Transform events and push to analytics
      const events = body
        .map((event) => ({
          event_id: event.sg_event_id,
          session_id: event.sg_event_id,
          visit_id: event.sg_event_id,
          user_id: userIdsMap[event.email],
          event_timestamp: new Date(event.timestamp * 1000),
          event_name: `email ${event.event}`,
          user_agent: event.useragent,
          app_platform: 'sendgrid',
          feed_item_target_url: event.url,
          target_type: event.template_id || event.sg_template_id,
          target_id: event.template_version_id,
          extra: JSON.stringify({
            category: event.category,
            sg_machine_open: event.sg_machine_open,
            asm_group_id: event.asm_group_id,
          }),
        }))
        .filter((event) => !!event.user_id);
      if (events.length) {
        await sendAnalyticsEvent(events);
      }

      counters?.api?.sendgridEvents?.add(events.length);
      return res.status(204).send();
    },
  });

  fastify.register(customerio, { prefix: '/customerio' });
  fastify.register(paddle, { prefix: '/paddle' });
  fastify.register(apple, { prefix: '/apple' });
  fastify.register(linear, { prefix: '/linear' });
}
