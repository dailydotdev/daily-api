import type { DataSource, EntityManager } from 'typeorm';
import { DigestPost } from '../entity/posts/DigestPost';
import { DIGEST_SOURCE } from '../entity/Source';
import { logger } from '../logger';
import type { SkadiAd } from '../integrations/skadi';

type DigestAdSnapshot = {
  type: string;
  index: number;
} & SkadiAd;

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
  let adSnapshot: DigestAdSnapshot | null = null;
  if (ad) {
    adSnapshot = { ...ad, index: adIndex };
  }

  const flags = {
    digestPostIds: postIds,
    collectionSources: sourceIds,
    ad: adSnapshot,
  };

  const result = await con
    .getRepository(DigestPost)
    .createQueryBuilder()
    .update(DigestPost)
    .set({
      flags: () => `flags || :flags`,
      visible: true,
      metadataChangedAt: () => 'NOW()',
    })
    .where(
      '"authorId" = :userId AND "sourceId" = :sourceId AND "type" = \'digest\'',
      {
        userId,
        sourceId: DIGEST_SOURCE,
      },
    )
    .setParameter('flags', JSON.stringify(flags))
    .returning('"id"')
    .execute();

  if (!result.affected || result.affected === 0) {
    logger.warn({ userId }, 'DigestPost stub not found for user');

    return null;
  }

  return result.raw[0].id;
};
