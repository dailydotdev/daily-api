import type { DataSource, EntityManager } from 'typeorm';
import { DigestPost } from '../entity/posts/DigestPost';
import { DIGEST_SOURCE } from '../entity/Source';
import { generateShortId } from '../ids';
import type { SkadiAd } from '../integrations/skadi';
import { updateFlagsStatement } from './utils';

type DigestAdSnapshot = {
  type: string;
  index: number;
} & SkadiAd;

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
}): Promise<string> => {
  let adSnapshot: DigestAdSnapshot | null = null;
  if (ad) {
    adSnapshot = { ...ad, index: adIndex };
  }

  const flags = {
    digestPostIds: postIds,
    collectionSources: sourceIds,
    ad: adSnapshot,
  };

  const repo = con.getRepository(DigestPost);
  const existing = await repo.findOneBy({
    authorId: userId,
    sourceId: DIGEST_SOURCE,
  });

  if (existing) {
    await repo.update(existing.id, {
      flags: updateFlagsStatement<DigestPost>(flags),
      metadataChangedAt: new Date(),
    });
    return existing.id;
  }

  const postId = await generateShortId();

  const post = repo.create({
    id: postId,
    shortId: postId,
    authorId: userId,
    private: true,
    visible: true,
    sourceId: DIGEST_SOURCE,
    flags,
  });

  await repo.insert(post);

  return postId;
};
