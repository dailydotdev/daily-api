import { In, type EntityManager, DataSource, MoreThan } from 'typeorm';
import { ContentPreferenceKeyword } from '../entity/contentPreference/ContentPreferenceKeyword';
import { User } from '../entity/user/User';
import { FeedClient } from '../integrations/feed/clients';
import { GarmrService } from '../integrations/garmr';
import { UserBriefingRequest } from '@dailydotdev/schema';
import { ContentPreferenceStatus } from '../entity/contentPreference/types';
import { BriefingModel, BriefingType } from '../integrations/feed';
import { queryReadReplica } from './queryReadReplica';
import { BriefPost } from '../entity/posts/BriefPost';
import { ConflictError } from '../errors';
import { generateShortId } from '../ids';
import { BRIEFING_SOURCE, Post, PostType } from '../entity';
import { triggerTypedEvent } from './typedPubsub';
import { logger } from '../logger';
import {
  ExperimentAllocationClient,
  getUserGrowthBookInstance,
} from '../growthbook';
import { subDays } from 'date-fns';
import { remoteConfig } from '../remoteConfig';

export const briefFeedClient = new FeedClient(process.env.BRIEFING_FEED, {
  garmr: new GarmrService({
    service: 'feed-client-generate-brief',
    breakerOpts: {
      halfOpenAfter: 5 * 1000,
      threshold: 0.1,
      duration: 10 * 1000,
      minimumRps: 1,
    },
    limits: {
      maxRequests: 150,
      queuedRequests: 100,
    },
    retryOpts: {
      maxAttempts: 3,
      backoff: 5 * 1000,
    },
  }),
});

export const getUserConfigForBriefingRequest = async ({
  con,
  userId,
}: {
  con: EntityManager;
  userId: string;
}): Promise<Pick<UserBriefingRequest, 'allowedTags' | 'seniorityLevel'>> => {
  if (!userId) {
    throw new Error('User id is required');
  }

  const [user, keywords] = await Promise.all([
    con.getRepository(User).findOneOrFail({
      select: ['id', 'experienceLevel'],
      where: {
        id: userId,
      },
    }),
    con.getRepository(ContentPreferenceKeyword).find({
      select: ['keywordId'],
      where: {
        userId: userId,
        feedId: userId,
        status: In([
          ContentPreferenceStatus.Follow,
          ContentPreferenceStatus.Subscribed,
        ]),
      },
    }),
  ]);

  return {
    allowedTags: keywords.map((item) => item.keywordId),
    seniorityLevel: user.experienceLevel ?? undefined,
  };
};

const throwIfExceedDailyLimit = async (
  con: DataSource,
  userId: string,
): Promise<void> => {
  const dailyLimit = remoteConfig.vars.dailyBriefLimit ?? 1;

  const now = new Date();
  const startDate = subDays(now, dailyLimit);

  const todayCount = await con.getRepository(BriefPost).count({
    where: {
      authorId: userId,
      createdAt: MoreThan(startDate),
    },
  });

  if (todayCount >= dailyLimit) {
    throw new ConflictError(
      'Daily brief limit reached. You can only generate one brief per day.',
      {
        dailyLimit,
        todayCount,
        now,
        startDate,
      },
    );
  }
};

const throwIfAnyPendingBrief = async (
  con: DataSource,
  userId: string,
): Promise<void> => {
  const pendingBrief = await queryReadReplica(con, async ({ queryRunner }) => {
    return queryRunner.manager.getRepository(BriefPost).findOne({
      select: ['id', 'createdAt'],
      where: { visible: false, authorId: userId },
    });
  });

  if (pendingBrief) {
    throw new ConflictError('There is already a briefing being generated', {
      postId: pendingBrief.id,
      createdAt: pendingBrief.createdAt,
    });
  }
};

export const requestBriefGeneration = async (
  con: DataSource,
  {
    userId,
    type,
    isTeamMember,
  }: { userId: string; type: BriefingType; isTeamMember?: boolean },
) => {
  await throwIfAnyPendingBrief(con, userId);

  // Check daily limit for non-team members
  if (!isTeamMember) {
    await throwIfExceedDailyLimit(con, userId);
  }

  const postId = await generateShortId();

  const post = con.getRepository(BriefPost).create({
    id: postId,
    shortId: postId,
    authorId: userId,
    private: true,
    visible: false,
    sourceId: BRIEFING_SOURCE,
  });

  await con.getRepository(BriefPost).insert(post);

  triggerTypedEvent(logger, 'api.v1.brief-generate', {
    payload: new UserBriefingRequest({
      userId,
      frequency: type,
      modelName: BriefingModel.Default,
    }),
    postId,
  });

  return { postId };
};

const allocationClient = new ExperimentAllocationClient();
export const getBriefGenerationCost = async (
  con: DataSource,
  { userId, type }: { userId: string; type: BriefingType },
) => {
  const hasAlreadyGeneratedOne = await con
    .getRepository(Post)
    .existsBy({ authorId: userId, type: PostType.Brief });

  if (!hasAlreadyGeneratedOne) {
    return 0;
  }

  const gbClient = getUserGrowthBookInstance(userId, {
    allocationClient,
  });
  const pricingConfig = gbClient.getFeatureValue('brief_generate_pricing', {
    [BriefingType.Daily]: 300,
    [BriefingType.Weekly]: 500,
  }) as Record<BriefingType, number>;

  await allocationClient.waitForSend();

  return pricingConfig[type];
};

export const briefingPostIdsMaxItems = 10;
