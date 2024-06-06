import {
  dedupedSend,
  getPersonalizedDigestEmailPayload,
  sendEmail,
} from '../common';
import {
  Settings,
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
  UserStreak,
} from '../entity';
import { messageToJson, Worker, workerToExperimentWorker } from './worker';
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
import { sendReadingReminderPush, sendStreakReminderPush } from '../onesignal';
import { isSameDay } from 'date-fns';

interface Data {
  personalizedDigest: UserPersonalizedDigest;
  emailSendTimestamp: number;
  previousSendTimestamp: number;
  emailBatchId?: string;
  deduplicate?: boolean;
  config?: PersonalizedDigestFeatureConfig;
}

const sendTypeToFeatureMap: Record<
  UserPersonalizedDigestSendType,
  Feature<PersonalizedDigestFeatureConfig>
> = {
  [UserPersonalizedDigestSendType.weekly]: features.personalizedDigest,
  [UserPersonalizedDigestSendType.workdays]: features.dailyDigest,
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
  [UserPersonalizedDigestType.Digest]: async (
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
  [UserPersonalizedDigestType.ReadingReminder]: async (data, con) => {
    const { personalizedDigest, emailSendTimestamp, deduplicate = true } = data;
    const notificationSendTimestamp = new Date(emailSendTimestamp);
    const currentDate = new Date();
    await dedupedSend(
      () =>
        sendReadingReminderPush(
          [personalizedDigest.userId],
          notificationSendTimestamp,
        ),
      {
        con,
        personalizedDigest,
        date: currentDate,
        deduplicate,
      },
    );
  },
  [UserPersonalizedDigestType.StreakReminder]: async (data, con, logger) => {
    const { personalizedDigest, emailSendTimestamp, deduplicate = true } = data;
    const { userId } = personalizedDigest;

    const notificationSendTimestamp = new Date(emailSendTimestamp);
    const currentDate = new Date();
    const userSettings = await con
      .getRepository(Settings)
      .findOneBy({ userId });

    // Safety measure to prevent sending streak reminders to users who have opted out
    // but for some reason still have a streak reminder scheduled
    if (userSettings?.optOutReadingStreak) {
      return;
    }

    const userStreak = await con
      .getRepository(UserStreak)
      .findOneBy({ userId });

    if (!userStreak) {
      logger.error(
        `User streak not found for user ${personalizedDigest.userId} when sending streak reminder.`,
      );
      return;
    }

    if (
      isSameDay(currentDate, userStreak.lastViewAt) ||
      userStreak.currentStreak === 0
    ) {
      return;
    }

    await dedupedSend(
      () =>
        sendStreakReminderPush(
          [personalizedDigest.userId],
          notificationSendTimestamp,
        ),
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
