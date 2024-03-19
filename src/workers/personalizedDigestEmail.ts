import { getPersonalizedDigestEmailPayload, sendEmail } from '../common';
import { User, UserPersonalizedDigest } from '../entity';
import { messageToJson, Worker, workerToExperimentWorker } from './worker';
import { isSameDay } from 'date-fns';
import { DataSource } from 'typeorm';
import { features, getUserGrowthBookInstace } from '../growthbook';

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

const worker: Worker = workerToExperimentWorker({
  subscription: 'api.personalized-digest-email',
  handler: async (message, con, logger, pubsub, allocationClient) => {
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

    const user = await con.getRepository(User).findOne({
      where: {
        id: personalizedDigest.userId,
      },
      relations: {
        streak: true,
      },
    });

    if (!user?.infoConfirmed) {
      return;
    }

    const growthbookClient = getUserGrowthBookInstace(user.id, {
      enableDevMode: process.env.NODE_ENV !== 'production',
      subscribeToChanges: false,
      allocationClient,
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
  },
});

export default worker;
