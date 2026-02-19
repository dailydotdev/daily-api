import { PostType } from '../../../entity';
import type { Data, ProcessPostProps, ProcessedPost } from '../types';
import { resolveCommonDeps, buildCommonPostFields } from '../common';

export const resolveYouTubeKeywords = (data: Data): string[] | undefined => {
  if (!data?.extra?.keywords && data?.content_type === PostType.VideoYouTube) {
    return data?.extra?.keywords_native;
  }
  return data?.extra?.keywords;
};

export const processVideoYouTube = async ({
  logger,
  entityManager,
  data,
}: ProcessPostProps): Promise<ProcessedPost> => {
  const sourceId = data?.source_id;
  const keywords = resolveYouTubeKeywords(data);
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
    contentType: PostType.VideoYouTube,
  });

  return {
    contentType: PostType.VideoYouTube,
    fixedData,
    mergedKeywords,
    questions: data?.extra?.questions || [],
    smartTitle: data?.alt_title,
  };
};
