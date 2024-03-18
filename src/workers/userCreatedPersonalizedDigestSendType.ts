import { updateFlagsStatement, User } from '../common';
import { UserPersonalizedDigest } from '../entity';
import { features, getUserGrowthBookInstace } from '../growthbook';
import {
  ExperimentAllocationEvent,
  sendExperimentAllocationEvent,
} from '../integrations/analytics';
import { messageToJson, Worker } from './worker';
import fastq from 'fastq';

interface Data {
  user: User;
}

const worker: Worker = {
  subscription: 'api.user-created-personalized-digest-send-type',
  handler: async (message, con) => {
    const data = messageToJson<Data>(message);
    const { user } = data;

    const analyticsQueue = fastq.promise(
      async (data: ExperimentAllocationEvent) => {
        await sendExperimentAllocationEvent(data);
      },
      1,
    );

    const growthbookClient = getUserGrowthBookInstace(user.id, {
      enableDevMode: process.env.NODE_ENV !== 'production',
      subscribeToChanges: false,
      trackingCallback: async (experiment, result) => {
        analyticsQueue.push({
          event_timestamp: new Date(),
          user_id: user.id,
          experiment_id: experiment.key,
          variation_id: result.variationId.toString(),
        });
      },
    });

    const sendType = growthbookClient.getFeatureValue(
      features.personalizedDigestSendType.id,
      features.personalizedDigestSendType.defaultValue,
    ) as typeof features.personalizedDigestSendType.defaultValue;

    await con.getRepository(UserPersonalizedDigest).update(
      {
        userId: user.id,
      },
      {
        flags: updateFlagsStatement<UserPersonalizedDigest>({
          sendType,
        }),
      },
    );

    await analyticsQueue.drained();
  },
};

export default worker;
