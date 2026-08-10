import { DataSource, EntityManager, Not } from 'typeorm';
import { Feed, FeedOrigin } from '../entity/Feed';
import { ValidationError } from 'apollo-server-errors';
import { SubmissionFailErrorMessage } from '../errors';
import { ContentPreferenceKeyword } from '../entity/contentPreference/ContentPreferenceKeyword';
import { ContentPreferenceStatus } from '../entity/contentPreference/types';

export const getUserOnboardingTags = async ({
  con,
  userId,
  limit,
}: {
  con: DataSource | EntityManager;
  userId: string;
  limit?: number;
}): Promise<string[]> => {
  const preferences = await con.getRepository(ContentPreferenceKeyword).find({
    select: ['referenceId'],
    where: {
      userId,
      feedId: userId,
      status: Not(ContentPreferenceStatus.Blocked),
    },
    ...(typeof limit === 'number' && { take: limit }),
  });

  return preferences.map((preference) => preference.referenceId);
};

export const countUserOwnedFeeds = ({
  con,
  userId,
}: {
  con: DataSource | EntityManager;
  userId: string;
}): Promise<number> =>
  con
    .getRepository(Feed)
    .createQueryBuilder('f')
    .where('f."userId" = :userId', { userId })
    .andWhere(`(f.flags->>'origin' IS DISTINCT FROM :agentOrigin)`, {
      agentOrigin: FeedOrigin.Agent,
    })
    .getCount();

export const getFeedByIdentifiersOrFail = async ({
  con,
  feedIdOrSlug,
  userId,
}: {
  con: DataSource;
  feedIdOrSlug: string;
  userId: string;
}): Promise<Feed | never> => {
  const feed = await con.getRepository(Feed).findOneOrFail({
    where: [
      {
        id: feedIdOrSlug,
        userId: userId,
      },
      {
        slug: feedIdOrSlug,
        userId: userId,
      },
    ],
  });

  return feed;
};

export const maxFeedNameLength = 50;

export const feedNameMatcher = /^[a-z0-9 ]+$/i;

export const feedThresholdMin = 0;

export const feedThresholdMax = 1000;

export const validateFeedPayload = ({
  name,
  minDayRange,
  minUpvotes,
  minViews,
}: Feed['flags']): never | undefined => {
  if (!name) {
    throw new ValidationError(SubmissionFailErrorMessage.FEED_NAME_REQUIRED);
  }

  if (name.length > maxFeedNameLength) {
    throw new ValidationError(SubmissionFailErrorMessage.FEED_NAME_LENGTH);
  }

  if (!feedNameMatcher.test(name)) {
    throw new ValidationError(SubmissionFailErrorMessage.FEED_NAME_INVALID);
  }

  if (
    [minDayRange, minUpvotes, minViews].some((item) => {
      if (!item) {
        return false;
      }

      return item < feedThresholdMin || item > feedThresholdMax;
    })
  ) {
    throw new ValidationError(
      SubmissionFailErrorMessage.FEED_THRESHOLD_INVALID,
    );
  }
};
