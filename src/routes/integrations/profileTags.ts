import createOrGetConnection from '../../db';
import { queryReadReplica } from '../../common/queryReadReplica';
import { Keyword } from '../../entity/Keyword';
import { Feed } from '../../entity/Feed';
import { FeedTag } from '../../entity/FeedTag';
import { ContentPreferenceKeyword } from '../../entity/contentPreference/ContentPreferenceKeyword';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../../entity/contentPreference/types';

export type RawExtractedTag = {
  name?: string;
  confidence?: number;
};

export type ExtractedTag = {
  name: string;
  confidence: number;
};

export type ExtractedTagsStats = {
  inputCount: number;
  droppedMissingFields: number;
  droppedNotInVocabulary: number;
  droppedBelowConfidence: number;
  dedupedLowerConfidence: number;
  outputCount: number;
};

export const getTagVocabulary = async (): Promise<Map<string, string>> => {
  const con = await createOrGetConnection();

  return queryReadReplica(con, async ({ queryRunner }) => {
    const rows = await queryRunner.manager
      .getRepository(Keyword)
      .createQueryBuilder('keyword')
      .select('keyword.value', 'value')
      .where(`(keyword.flags->'onboarding') = 'true'`)
      .orderBy('keyword.value', 'ASC')
      .getRawMany<{ value: string }>();

    const map = new Map<string, string>();
    rows.forEach(({ value }) => {
      if (!value) {
        return;
      }

      map.set(value.toLowerCase(), value);
    });

    return map;
  });
};

export const toExtractedTagsWithStats = ({
  extractedTags,
  vocabulary,
  minConfidence,
}: {
  extractedTags: RawExtractedTag[];
  vocabulary: Map<string, string>;
  minConfidence: number;
}): { extractedTags: ExtractedTag[]; stats: ExtractedTagsStats } => {
  const dedup = new Map<string, number>();
  const stats: ExtractedTagsStats = {
    inputCount: extractedTags.length,
    droppedMissingFields: 0,
    droppedNotInVocabulary: 0,
    droppedBelowConfidence: 0,
    dedupedLowerConfidence: 0,
    outputCount: 0,
  };

  extractedTags.forEach((item) => {
    if (!item?.name || typeof item.confidence !== 'number') {
      stats.droppedMissingFields += 1;
      return;
    }

    const normalizedName = item.name.trim().toLowerCase();
    const canonicalName = vocabulary.get(normalizedName);
    if (!canonicalName) {
      stats.droppedNotInVocabulary += 1;
      return;
    }

    const clampedConfidence = Math.max(0, Math.min(1, item.confidence));
    if (clampedConfidence < minConfidence) {
      stats.droppedBelowConfidence += 1;
      return;
    }

    const existing = dedup.get(canonicalName);
    if (existing === undefined || clampedConfidence > existing) {
      if (existing !== undefined) {
        stats.dedupedLowerConfidence += 1;
      }
      dedup.set(canonicalName, clampedConfidence);
      return;
    }

    stats.dedupedLowerConfidence += 1;
  });

  const filtered = [...dedup.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, confidence]) => ({ name, confidence }));

  stats.outputCount = filtered.length;
  return { extractedTags: filtered, stats };
};

export const toExtractedTags = (params: {
  extractedTags: RawExtractedTag[];
  vocabulary: Map<string, string>;
  minConfidence: number;
}): ExtractedTag[] => {
  return toExtractedTagsWithStats(params).extractedTags;
};

export const followTags = async ({
  userId,
  tags,
}: {
  userId: string;
  tags: string[];
}): Promise<void> => {
  if (tags.length === 0) {
    return;
  }

  const con = await createOrGetConnection();
  await con.transaction(async (entityManager) => {
    await entityManager
      .createQueryBuilder()
      .insert()
      .into(Feed)
      .values({
        id: userId,
        userId,
      })
      .orIgnore()
      .execute();

    await entityManager
      .createQueryBuilder()
      .insert()
      .into(ContentPreferenceKeyword)
      .values(
        tags.map((tag) => ({
          userId,
          referenceId: tag,
          keywordId: tag,
          feedId: userId,
          status: ContentPreferenceStatus.Follow,
          type: ContentPreferenceType.Keyword,
        })),
      )
      .orUpdate(['status'], ['referenceId', 'userId', 'type', 'feedId'])
      .execute();

    await entityManager
      .createQueryBuilder()
      .insert()
      .into(FeedTag)
      .values(
        tags.map((tag) => ({
          feedId: userId,
          tag,
          blocked: false,
        })),
      )
      .orUpdate(['blocked'], ['feedId', 'tag'])
      .execute();
  });
};
