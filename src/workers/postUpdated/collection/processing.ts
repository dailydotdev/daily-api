import {
  addRelatedPosts,
  CollectionPost,
  PostRelationType,
  PostType,
  relatePosts,
} from '../../../entity';
import type { EntityManager } from 'typeorm';
import type { Data, ProcessPostProps, ProcessedPost } from '../types';
import { resolveCommonDeps, buildCommonPostFields } from '../common';

export const processCollection = async ({
  logger,
  entityManager,
  data,
}: ProcessPostProps): Promise<ProcessedPost> => {
  const sourceId = data?.source_id;
  const keywords = data?.extra?.keywords;
  const showOnFeed = !data?.order;

  const { creatorTwitter, authorId, privacy, allowedKeywords, mergedKeywords } =
    await resolveCommonDeps({
      logger,
      entityManager,
      data,
      sourceId,
      keywords,
    });

  const contentMeta = { ...(data?.meta || {}) };

  const fixedData = buildCommonPostFields({
    data,
    authorId,
    creatorTwitter,
    sourceId,
    privacy,
    showOnFeed,
    allowedKeywords,
    contentMeta,
    contentType: PostType.Collection,
  });

  return {
    contentType: PostType.Collection,
    fixedData,
    mergedKeywords,
    questions: data?.extra?.questions || [],
    smartTitle: data?.alt_title,
  };
};

export const handleCollectionRelations = async ({
  entityManager,
  post,
  originalData,
}: {
  entityManager: EntityManager;
  post: Pick<CollectionPost, 'id' | 'type'>;
  originalData: Data;
}) => {
  if (post.type === PostType.Collection) {
    await addRelatedPosts({
      entityManager,
      postId: post.id,
      yggdrasilIds: originalData.extra?.origin_entries || [],
      relationType: PostRelationType.Collection,
    });
  } else if (originalData.collections) {
    await relatePosts({
      entityManager,
      postId: post.id,
      yggdrasilIds: originalData.collections || [],
      relationType: PostRelationType.Collection,
    });
  }
};
