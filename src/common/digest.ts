import type { DataSource, EntityManager } from 'typeorm';
import { DigestPost } from '../entity/posts/DigestPost';
import { DIGEST_SOURCE } from '../entity/Source';
import { generateShortId } from '../ids';
import type { SkadiAd } from '../integrations/skadi';

type DigestAdSnapshot = {
  type: string;
  index: number;
} & SkadiAd;

export const createDigestPost = async ({
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
}): Promise<string> => {
  const postId = await generateShortId();

  let adSnapshot: DigestAdSnapshot | null = null;
  if (ad) {
    adSnapshot = { ...ad, index: adIndex };
  }

  const post = con.getRepository(DigestPost).create({
    id: postId,
    shortId: postId,
    authorId: userId,
    private: true,
    visible: true,
    sourceId: DIGEST_SOURCE,
    flags: {
      digestPostIds: postIds,
      collectionSources: sourceIds,
      ad: adSnapshot,
    },
  });

  await con.getRepository(DigestPost).insert(post);

  return postId;
};
