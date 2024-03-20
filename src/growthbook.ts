import {
  Context as GrowthBookContext,
  FeatureDefinition,
  GrowthBook,
  setPolyfills,
  JSONValue,
} from '@growthbook/growthbook';
import { encrypt } from './common';
import { FastifyBaseLogger } from 'fastify';
import { UserPersonalizedDigestSendType } from './entity';
import {
  ExperimentAllocationEvent,
  sendExperimentAllocationEvent,
} from './integrations/analytics';
import fastq from 'fastq';

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
  log.debug('updated features');
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

export function getUserGrowthBookInstace(
  userId: string,
  params?: Omit<GrowthBookContext, 'features' | 'trackingCallback'> & {
    allocationClient?: ExperimentAllocationClient;
  },
): GrowthBook {
  const { allocationClient, ...restParams } = params || {};

  const gbContext: GrowthBookContext = {
    ...restParams,
    clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
    attributes: {
      ...restParams.attributes,
      userId,
    },
    features: gb.getFeatures(),
  };

  if (allocationClient) {
    gbContext.trackingCallback = (experiment, result) => {
      allocationClient.push({
        event_timestamp: new Date(),
        user_id: userId,
        experiment_id: experiment.key,
        variation_id: result.variationId.toString(),
      });
    };
  }

  return new GrowthBook(gbContext);
}
export class Feature<T extends JSONValue> {
  readonly id: string;

  readonly defaultValue?: T;

  constructor(id: string, defaultValue?: T) {
    this.id = id;
    this.defaultValue = defaultValue;
  }
}

export const features = {
  personalizedDigest: new Feature('personalized_digest', {
    templateId: 'd-328d1104d2e04fa1ab91e410e02751cb',
    meta: {
      from: {
        email: 'informer@daily.dev',
        name: 'daily.dev',
      },
      category: 'Digests',
      asmGroupId: 23809,
    },
    feedConfig: 'digest',
    maxPosts: 5,
    longTextLimit: 150,
  }),
  personalizedDigestSendType: new Feature(
    'personalized_digest_send_type',
    UserPersonalizedDigestSendType.weekly,
  ),
};

export class ExperimentAllocationClient {
  private readonly queue: fastq.queueAsPromised<
    ExperimentAllocationEvent,
    void
  >;

  constructor(options?: { concurrency: number }) {
    this.queue = fastq.promise(async (data: ExperimentAllocationEvent) => {
      await sendExperimentAllocationEvent(data);
    }, options?.concurrency || 1);
  }

  /**
   * Push an allocation event to the send queue
   *
   * @param {ExperimentAllocationEvent} data
   * @memberof GrowthbookAllocationClient
   */
  push(data: ExperimentAllocationEvent): void {
    this.queue.push(data);
  }

  /**
   * Wait for all pushed allocations to be sent
   *
   * @return {*}  {Promise<void>}
   * @memberof GrowthbookAllocationClient
   */
  async waitForSend(): Promise<void> {
    await this.queue.drained();
  }
}
