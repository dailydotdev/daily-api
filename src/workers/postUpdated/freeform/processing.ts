import { PostType } from '../../../entity';
import type { ProcessPostProps, ProcessedPost } from '../types';
import { resolveCommonDeps, buildCommonPostFields } from '../common';

export const freeformAllowedFields = [
  'contentCuration',
  'description',
  'metadataChangedAt',
  'readTime',
  'summary',
  'tagsStr',
  'contentMeta',
];

export const processFreeform = async ({
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
    contentType: PostType.Freeform,
  });

  return {
    contentType: PostType.Freeform,
    fixedData,
    mergedKeywords,
    questions: data?.extra?.questions || [],
    smartTitle: data?.alt_title,
    allowedUpdateFields: freeformAllowedFields,
  };
};
