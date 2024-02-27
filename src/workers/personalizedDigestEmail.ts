import { getPersonalizedDigestEmailPayload, sendEmail } from '../common';
import { User, UserPersonalizedDigest } from '../entity';
import { messageToJson, Worker } from './worker';
import { isSameDay } from 'date-fns';
import { DataSource } from 'typeorm';
import { features, getUserGrowthBookInstace } from '../growthbook';
import {
  ExperimentAllocationEvent,
  sendExperimentAllocationEvent,
} from '../integrations/analytics';
import fastq from 'fastq';
import deepmerge from 'deepmerge';

interface Data {
  personalizedDigest: UserPersonalizedDigest;
  emailSendTimestamp: number;
  previousSendTimestamp: number;
  emailBatchId?: string;
  deduplicate?: boolean;
}

type SetEmailSendDateProps = Pick<
  Data,
  'personalizedDigest' | 'deduplicate'
> & {
  con: DataSource;
  date: Date;
};

const setEmailSendDate = async ({
  con,
  personalizedDigest,
  date,
  deduplicate,
}: SetEmailSendDateProps) => {
  if (!deduplicate) {
    return;
  }

  return con.getRepository(UserPersonalizedDigest).update(
    {
      userId: personalizedDigest.userId,
    },
    {
      lastSendDate: date,
    },
  );
};

const worker: Worker = {
  subscription: 'api.personalized-digest-email',
  handler: async (message, con, logger) => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const data = messageToJson<Data>(message);

    const {
      personalizedDigest,
      emailSendTimestamp,
      previousSendTimestamp,
      emailBatchId,
      deduplicate = true,
    } = data;
    const emailSendDate = new Date(emailSendTimestamp);
    const previousSendDate = new Date(previousSendTimestamp);

    const user = await con.getRepository(User).findOneBy({
      id: personalizedDigest.userId,
    });

    if (!user?.infoConfirmed) {
      return;
    }

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

    const featureValue = growthbookClient.getFeatureValue(
      features.personalizedDigest.id,
      features.personalizedDigest.defaultValue,
    );

    // gb does not handle default values for nested objects
    const digestFeature = deepmerge(
      features.personalizedDigest.defaultValue,
      featureValue,
    );

    const currentDate = new Date();

    const emailPayload = await getPersonalizedDigestEmailPayload({
      con,
      logger,
      personalizedDigest,
      user,
      emailBatchId,
      emailSendDate,
      currentDate,
      previousSendDate,
      feature: digestFeature,
    });

    if (!emailPayload) {
      return;
    }

    const { lastSendDate = null } =
      (await con.getRepository(UserPersonalizedDigest).findOne({
        select: ['lastSendDate'],
        where: {
          userId: personalizedDigest.userId,
        },
      })) || {};

    if (deduplicate && lastSendDate && isSameDay(currentDate, lastSendDate)) {
      return;
    }

    await setEmailSendDate({
      con,
      personalizedDigest,
      date: currentDate,
      deduplicate,
    });

    try {
      await sendEmail(emailPayload);
    } catch (error) {
      // since email did not send we revert the lastSendDate
      // so worker can do it again in retry
      await setEmailSendDate({
        con,
        personalizedDigest,
        date: lastSendDate,
        deduplicate,
      });

      throw error;
    }

    await analyticsQueue.drained();
  },
};

export default worker;
