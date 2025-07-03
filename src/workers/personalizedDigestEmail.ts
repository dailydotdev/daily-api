import {
  dedupedSend,
  getPersonalizedDigestEmailPayload,
  sendEmail,
  triggerTypedEvent,
} from '../common';
import {
  Settings,
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../entity';
import { messageToJson, Worker, workerToExperimentWorker } from './worker';
import { DataSource } from 'typeorm';
import {
  ExperimentAllocationClient,
  Feature,
  features,
  getUserGrowthBookInstance,
  PersonalizedDigestFeatureConfig,
} from '../growthbook';

import deepmerge from 'deepmerge';
import { FastifyBaseLogger } from 'fastify';
import { sendReadingReminderPush, sendStreakReminderPush } from '../onesignal';
import { isSameDayInTimezone } from '../common/timezone';
import { UserBriefingRequest } from '@dailydotdev/schema';
import { BriefingModel } from '../integrations/feed/types';
import { generateShortId } from '../ids';
import { BriefPost } from '../entity/posts/BriefPost';

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
  [UserPersonalizedDigestSendType.daily]: features.dailyDigest,
};

const digestTypeToFunctionMap: Record<
  UserPersonalizedDigestType,
  (
    data: Data,
    con: DataSource,
    logger: FastifyBaseLogger,
    allocationClient?: ExperimentAllocationClient,
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
      sendTypeToFeatureMap[
        personalizedDigest.flags.sendType as UserPersonalizedDigestSendType
      ] || features.personalizedDigest;
    let featureValue: PersonalizedDigestFeatureConfig;
    const defaultValue =
      featureInstance.defaultValue as PersonalizedDigestFeatureConfig;

    if (config) {
      featureValue = config;
    } else {
      const growthbookClient = getUserGrowthBookInstance(user.id, {
        enableDevMode: process.env.NODE_ENV !== 'production',
        subscribeToChanges: false,
        allocationClient,
      });

      featureValue = growthbookClient.getFeatureValue(
        featureInstance.id,
        defaultValue,
      );
    }

    // gb does not handle default values for nested objects
    const digestFeature = deepmerge(defaultValue, featureValue);

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
    const { personalizedDigest, deduplicate = true } = data;
    const { userId } = personalizedDigest;

    const currentDate = new Date();
    const userSettings = await con
      .getRepository(Settings)
      .findOneBy({ userId });

    // Safety measure to prevent sending streak reminders to users who have opted out
    // but for some reason still have a streak reminder scheduled
    if (userSettings?.optOutReadingStreak) {
      return;
    }

    const user = await con.getRepository(User).findOne({
      where: {
        id: userId,
      },
      relations: {
        streak: true,
      },
    });

    if (!user) {
      logger.debug(
        `User not found for user ${userId} when sending streak reminder.`,
      );
      return;
    }

    const userStreak = await user.streak;

    if (!userStreak) {
      logger.debug(
        `User streak not found for user ${personalizedDigest.userId} when sending streak reminder.`,
      );
      return;
    }

    if (
      (userStreak.lastViewAt &&
        isSameDayInTimezone(
          currentDate,
          userStreak.lastViewAt,
          user.timezone,
        )) ||
      userStreak.currentStreak === 0
    ) {
      return;
    }

    await dedupedSend(
      () => sendStreakReminderPush([personalizedDigest.userId]),
      {
        con,
        personalizedDigest,
        date: currentDate,
        deduplicate,
      },
    );
  },
  [UserPersonalizedDigestType.Brief]: async (data, con, logger) => {
    const currentDate = new Date();

    const { personalizedDigest, deduplicate = true } = data;

    await con.transaction(async (entityManager) => {
      await dedupedSend(
        async () => {
          const { userId } = personalizedDigest;
          const postId = await generateShortId();

          const post = entityManager.getRepository(BriefPost).create({
            id: postId,
            shortId: postId,
            authorId: userId,
            private: true,
            visible: false,
          });

          await entityManager.getRepository(BriefPost).save(post);

          triggerTypedEvent(logger, 'api.v1.brief-generate', {
            payload: new UserBriefingRequest({
              userId,
              frequency: data.personalizedDigest.flags.sendType,
              modelName: BriefingModel.Default,
            }),
            postId,
          });
        },
        {
          con: entityManager,
          personalizedDigest,
          date: currentDate,
          deduplicate,
        },
      );
    });
  },
};

const worker: Worker = workerToExperimentWorker({
  subscription: 'api.personalized-digest-email',
  handler: async (message, con, logger, pubsub, allocationClient) => {
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
