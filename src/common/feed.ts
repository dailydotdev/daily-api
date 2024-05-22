import { DataSource } from 'typeorm';
import { Feed } from '../entity/Feed';

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
