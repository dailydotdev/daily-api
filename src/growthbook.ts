import {
  FeatureDefinition,
  GrowthBook,
  setPolyfills,
} from '@growthbook/growthbook';
import { encrypt } from './common';
import { FastifyBaseLogger } from 'fastify';

setPolyfills({
  EventSource: require('eventsource'),
});

const gb = new GrowthBook({
  apiHost: 'https://cdn.growthbook.io',
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
});

let encryptedFeatures: string;

const updateFeatures = (log: FastifyBaseLogger) => async () => {
  const features = gb.getFeatures();
  if (process.env.NODE_ENV === 'production') {
    encryptedFeatures = await encrypt(
      JSON.stringify(features),
      process.env.EXPERIMENTATION_KEY,
      'AES-CBC',
      128,
    );
  } else {
    encryptedFeatures = JSON.stringify(features);
  }
  log.info('updated features');
};

export type Features = Record<string, FeatureDefinition<unknown>>;

export async function loadFeatures(log: FastifyBaseLogger): Promise<void> {
  try {
    await gb.loadFeatures({ autoRefresh: true });
    const renderer = updateFeatures(log);
    await renderer();
    gb.setRenderer(renderer);
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    log.error({ err }, 'failed to load features');
    encryptedFeatures = JSON.stringify({});
  }
}

export function getEncryptedFeatures(): string {
  return encryptedFeatures;
}
