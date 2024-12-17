import { DataSource } from 'typeorm';
import { Feed } from '../entity/Feed';
import { ValidationError } from 'apollo-server-errors';
import { SubmissionFailErrorMessage } from '../errors';
import { isOneValidEmoji } from './utils';

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
  icon,
  maxDayRange,
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

  if (icon && !isOneValidEmoji(icon)) {
    throw new ValidationError(SubmissionFailErrorMessage.FEED_ICON_INVALID);
  }

  if (
    [maxDayRange, minUpvotes, minViews].some((item) => {
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
