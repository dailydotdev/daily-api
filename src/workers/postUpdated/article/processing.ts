import { PostType } from '../../../entity';
import type { ProcessPostProps, ProcessedPost } from '../types';
import { resolveCommonDeps, buildCommonPostFields } from '../common';

export const processArticle = async ({
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

  const contentType = (data?.content_type as PostType) || PostType.Article;

  const fixedData = buildCommonPostFields({
    data,
    authorId,
    creatorTwitter,
    sourceId,
    privacy,
    showOnFeed,
    allowedKeywords,
    contentMeta,
    contentType,
  });

  return {
    contentType,
    fixedData,
    mergedKeywords,
    questions: data?.extra?.questions || [],
    smartTitle: data?.alt_title,
  };
};
