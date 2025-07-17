import { In, type EntityManager } from 'typeorm';
import { ContentPreferenceKeyword } from '../entity/contentPreference/ContentPreferenceKeyword';
import { User } from '../entity/user/User';
import { FeedClient } from '../integrations/feed/clients';
import { GarmrService } from '../integrations/garmr';
import type { UserBriefingRequest } from '@dailydotdev/schema';
import { ContentPreferenceStatus } from '../entity/contentPreference/types';

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
      maxAttempts: 0,
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
