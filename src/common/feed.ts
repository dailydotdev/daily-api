import { DataSource } from 'typeorm';
import { Feed } from '../entity/Feed';
import { ValidationError } from 'apollo-server-errors';
import { SubmissionFailErrorMessage } from '../errors';

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

export const validateFeedPayload = ({
  name,
}: {
  name: Feed['flags']['name'];
}): never | undefined => {
  if (!name) {
    throw new ValidationError(SubmissionFailErrorMessage.FEED_NAME_REQUIRED);
  }

  if (!feedNameMatcher.test(name)) {
    throw new ValidationError(SubmissionFailErrorMessage.FEED_NAME_INVALID);
  }
};

export const feedNameMatcher = /^[A-z0-9 ]+$/;
