import { getPersonalizedDigestEmailPayload, sendEmail } from '../common';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../entity';
import { messageToJson, Worker, workerToExperimentWorker } from './worker';
import { isSameDay } from 'date-fns';
import { DataSource } from 'typeorm';
import {
  ExperimentAllocationClient,
  Feature,
  features,
  getUserGrowthBookInstace,
  PersonalizedDigestFeatureConfig,
} from '../growthbook';

import deepmerge from 'deepmerge';
import { FastifyBaseLogger } from 'fastify';
import { sendReadingReminderPush } from '../onesignal';

interface Data {
  personalizedDigest: UserPersonalizedDigest;
  emailSendTimestamp: number;
  previousSendTimestamp: number;
  emailBatchId?: string;
  deduplicate?: boolean;
  config?: PersonalizedDigestFeatureConfig;
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
      type: personalizedDigest.type,
    },
    {
      lastSendDate: date,
    },
  );
};

const sendTypeToFeatureMap: Record<
  UserPersonalizedDigestSendType,
  Feature<PersonalizedDigestFeatureConfig>
> = {
  [UserPersonalizedDigestSendType.weekly]: features.personalizedDigest,
  [UserPersonalizedDigestSendType.workdays]: features.dailyDigest,
};

const dedupedSend = async (
  send: () => Promise<unknown>,
  { con, personalizedDigest, deduplicate, date }: SetEmailSendDateProps,
): Promise<void> => {
  const { lastSendDate = null } =
    (await con.getRepository(UserPersonalizedDigest).findOne({
      select: ['lastSendDate'],
      where: {
        userId: personalizedDigest.userId,
        type: personalizedDigest.type,
      },
    })) || {};

  if (deduplicate && lastSendDate && isSameDay(date, lastSendDate)) {
    return;
  }

  await setEmailSendDate({
    con,
    personalizedDigest,
    date,
    deduplicate,
  });

  try {
    await send();
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
};

const digestTypeToFunctionMap: Record<
  UserPersonalizedDigestType,
  (
    data: Data,
    con: DataSource,
    logger: FastifyBaseLogger,
    allocationClient: ExperimentAllocationClient,
  ) => Promise<void>
> = {
  [UserPersonalizedDigestType.digest]: async (
    data,
    con,
    logger,
    allocationClient,
  ) => {
    const {
      personalizedDigest,
      emailSendTimestamp,
      previousSendTimestamp,
      emailBatchId,
      deduplicate = true,
      config,
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

    const featureInstance =
      sendTypeToFeatureMap[personalizedDigest.flags.sendType] ||
      features.personalizedDigest;
    let featureValue: PersonalizedDigestFeatureConfig;

    if (config) {
      featureValue = config;
    } else {
      const growthbookClient = getUserGrowthBookInstace(user.id, {
        enableDevMode: process.env.NODE_ENV !== 'production',
        subscribeToChanges: false,
        allocationClient,
      });

      featureValue = growthbookClient.getFeatureValue(
        featureInstance.id,
        featureInstance.defaultValue,
      );
    }

    // gb does not handle default values for nested objects
    const digestFeature = deepmerge(featureInstance.defaultValue, featureValue);

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

    await dedupedSend(() => sendEmail(emailPayload), {
      con,
      personalizedDigest,
      date: currentDate,
      deduplicate,
    });
  },
  [UserPersonalizedDigestType.reading_reminder]: async (data, con) => {
    const { personalizedDigest, emailSendTimestamp, deduplicate = true } = data;
    const emailSendDate = new Date(emailSendTimestamp);
    const currentDate = new Date();
    await dedupedSend(
      () => sendReadingReminderPush([personalizedDigest.userId], emailSendDate),
      {
        con,
        personalizedDigest,
        date: currentDate,
        deduplicate,
      },
    );
  },
};

const worker: Worker = workerToExperimentWorker({
  subscription: 'api.personalized-digest-email',
  handler: async (message, con, logger, pubsub, allocationClient) => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const data = messageToJson<Data>(message);
    await digestTypeToFunctionMap[data.personalizedDigest.type](
      data,
      con,
      logger,
      allocationClient,
    );
  },
});

export default worker;
