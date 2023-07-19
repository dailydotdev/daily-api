import {
  FeatureDefinition,
  GrowthBook,
  setPolyfills,
} from '@growthbook/growthbook';
import { encrypt } from './common';

setPolyfills({
  EventSource: require('eventsource'),
});

const gb = new GrowthBook({
  apiHost: 'https://cdn.growthbook.io',
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
});

let encryptedFeatures: string;

const updateFeatures = async () => {
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
  console.log('updated features');
};

export type Features = Record<string, FeatureDefinition<unknown>>;

export async function loadFeatures(): Promise<void> {
  await gb.loadFeatures({ autoRefresh: true });
  await updateFeatures();
  gb.setRenderer(updateFeatures);
}

export function getEncryptedFeatures(): string {
  return encryptedFeatures;
}
