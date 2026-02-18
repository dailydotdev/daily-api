import { PostType } from '../../../entity';
import type { Data } from '../types';

export const resolveYouTubeKeywords = (data: Data): string[] | undefined => {
  if (!data?.extra?.keywords && data?.content_type === PostType.VideoYouTube) {
    return data?.extra?.keywords_native;
  }
  return data?.extra?.keywords;
};
