import type { FastifyInstance } from 'fastify';
import { paddleInstance } from '../common/paddle';
import type { CountryCode } from '@paddle/paddle-node-sdk';
import { remoteConfig } from '../remoteConfig';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const region = req.headers['x-client-region'] as CountryCode | undefined;
    try {
      const pricePreview = await paddleInstance?.pricingPreview.preview({
        items: Object.keys(remoteConfig.vars.pricingIds!).map((priceId) => ({
          priceId,
          quantity: 1,
        })),
        address: region ? { countryCode: region } : undefined,
      });

      return res.send(pricePreview);
    } catch (e) {
      return res.status(500).send();
    }
  });
}
