import { FastifyInstance } from 'fastify';
import { Environment, EventName, Paddle } from '@paddle/paddle-node-sdk';
import createOrGetConnection from '../../db';
import { updateFlagsStatement, updateSubscriptionFlags } from '../../common';
import { User } from '../../entity';

const paddleInstance = new Paddle('test_4194076987e44d19d7e0c3388d6', {
  environment: Environment.sandbox,
});

export const paddle = async (fastify: FastifyInstance): Promise<void> => {
  fastify.register(async (fastify: FastifyInstance): Promise<void> => {
    fastify.post('/', {
      config: {
        rawBody: true,
      },
      handler: async (req, res) => {
        const signature = (req.headers['paddle-signature'] as string) || '';
        // req.body should be of type `buffer`, convert to string before passing it to `unmarshal`.
        // If express returned a JSON, remove any other middleware that might have processed raw request to object
        const rawRequestBody = req.rawBody;
        // Replace `WEBHOOK_SECRET_KEY` with the secret key in notifications from vendor dashboard
        const secretKey =
          process.env['WEBHOOK_SECRET_KEY'] ||
          'pdl_ntfset_01jcffndcm8v6b3zp5vtr0z5z9_Mnd68UYYsasjyAVgfituphFldYtJaAy3';

        try {
          if (signature && rawRequestBody) {
            // The `unmarshal` function will validate the integrity of the webhook and return an entity
            const eventData = paddleInstance.webhooks.unmarshal(
              rawRequestBody,
              secretKey,
              signature,
            );
            const con = await createOrGetConnection();
            switch (eventData?.eventType) {
              case EventName.SubscriptionCreated:
                await con.getRepository(User).update(
                  {
                    id: eventData.data.customData?.user_id,
                  },
                  {
                    subscriptionFlags: updateSubscriptionFlags({
                      monthly: true,
                    }),
                  },
                );
                break;
              default:
                console.log(eventData.eventType);
            }
          } else {
            console.log('Signature missing in header');
          }
        } catch (e) {
          // Handle signature mismatch or other runtime errors
          console.log(e);
        }
        // Return a response to acknowledge
        res.send('Processed webhook event');
      },
    });
  });
};
