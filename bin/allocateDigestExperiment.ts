import '../src/config';
import createOrGetConnection from '../src/db';
import { UserPersonalizedDigest } from '../src/entity';
import {
  ExperimentAllocationClient,
  features,
  getUserGrowthBookInstace,
  loadFeatures,
} from '../src/growthbook';
import pino from 'pino';

(async (): Promise<void> => {
  const lastSendDateArgument = process.argv[2];
  const offsetArgument = process.argv[3];
  const limitArgument = process.argv[4];

  const lastSendDate = new Date(lastSendDateArgument);

  if (Number.isNaN(lastSendDate.getTime())) {
    throw new Error(
      'lastSendDate argument is invalid, format should be ISO 6801',
    );
  }

  const offset = +offsetArgument;

  if (Number.isNaN(offset)) {
    throw new Error('offset argument is invalid, it should be a number');
  }

  const limit = +limitArgument;

  if (Number.isNaN(limit)) {
    throw new Error('limit argument is invalid, it should be a number');
  }

  const con = await createOrGetConnection();

  const personalizedDigestQuery = con
    .createQueryBuilder()
    .from(UserPersonalizedDigest, 'upd')
    .where('upd."lastSendDate" > :lastSendDate', {
      lastSendDate,
    })
    .orderBy('"userId"', 'ASC')
    .offset(offset)
    .limit(limit);

  await loadFeatures(pino());

  const personalizedDigestStream = await personalizedDigestQuery.stream();
  const allocationQueueConcurrency = +(
    process.env.ALLOCATION_QUEUE_CONCURRENCY || 1
  );
  const allocationClient = new ExperimentAllocationClient({
    concurrency: allocationQueueConcurrency,
  });

  personalizedDigestStream.on(
    'data',
    (personalizedDigest: UserPersonalizedDigest) => {
      const gbClient = getUserGrowthBookInstace(personalizedDigest.userId, {
        allocationClient,
      });

      gbClient.getFeatureValue(
        features.personalizedDigest.id,
        features.personalizedDigest.defaultValue,
      );
    },
  );

  await new Promise((resolve, reject) => {
    personalizedDigestStream.on('error', (error) => {
      console.error(error);

      reject(error);
    });
    personalizedDigestStream.on('end', resolve);
  });
  await allocationClient.waitForSend();

  process.exit();
})();
