import type { DataSource, EntityManager } from 'typeorm';
import { DigestPost, type DigestPostFlags } from '../entity/posts/DigestPost';
import { DIGEST_SOURCE } from '../entity/Source';
import { logger } from '../logger';
import type { SkadiAd } from '../integrations/skadi';

/**
 * Update digest post with latest data.
 *
 * Currently always updates because post is created on user creation.
 *
 * @param {({
 *   con: DataSource | EntityManager;
 *   userId: string;
 *   postIds: string[];
 *   sourceIds: string[];
 *   ad: ({ type: string } & SkadiAd) | null;
 *   adIndex: number;
 * })} {
 *   con,
 *   userId,
 *   postIds,
 *   sourceIds,
 *   ad,
 *   adIndex,
 * }
 * @return {*}  {(Promise<string | null>)}
 */
export const upsertDigestPost = async ({
  con,
  userId,
  postIds,
  sourceIds,
  ad,
  adIndex,
}: {
  con: DataSource | EntityManager;
  userId: string;
  postIds: string[];
  sourceIds: string[];
  ad: ({ type: string } & SkadiAd) | null;
  adIndex: number;
}): Promise<string | null> => {
  const digestFlags: DigestPostFlags = {
    digestPostIds: postIds,
    collectionSources: sourceIds,
    ad: ad ? { ...ad, index: adIndex } : null,
    date: new Date(),
  };

  const result = await con
    .getRepository(DigestPost)
    .createQueryBuilder()
    .update(DigestPost)
    .set({
      digestFlags,
      visible: true,
    })
    .where(
      '"authorId" = :userId AND "sourceId" = :sourceId AND "type" = \'digest\'',
      {
        userId,
        sourceId: DIGEST_SOURCE,
      },
    )
    .returning('"id"')
    .execute();

  if (!result.affected || result.affected === 0) {
    logger.warn({ userId }, 'DigestPost stub not found for user');

    return null;
  }

  return result.raw[0].id;
};
