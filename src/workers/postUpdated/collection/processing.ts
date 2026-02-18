import {
  addRelatedPosts,
  CollectionPost,
  PostRelationType,
  PostType,
  relatePosts,
} from '../../../entity';
import type { FastifyBaseLogger } from 'fastify';
import type { EntityManager } from 'typeorm';
import type { Data } from '../types';

export const handleCollectionRelations = async ({
  entityManager,
  post,
  originalData,
}: {
  entityManager: EntityManager;
  logger: FastifyBaseLogger;
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
