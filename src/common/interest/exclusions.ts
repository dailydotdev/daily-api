import type { DataSource, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { Post, PostType } from '../../entity/posts/Post';
import {
  AGENTS_DIGEST_SOURCE,
  BRIEFING_SOURCE,
  DIGEST_SOURCE,
  X_TRENDS_SOURCE,
} from '../../entity/Source';
import { getChannelDigestSourceIds } from '../channelDigest/definitions';

export const COLLECTIONS_SOURCE = 'collections';
export const TRENDS_SOURCE = 'trends';

export const deliverablePostPredicate = (alias: string): string =>
  `${alias}.deleted = false AND ${alias}.banned = false`;

export const whereFindingDeliverable = <T extends ObjectLiteral>(
  builder: SelectQueryBuilder<T>,
  alias: string,
): SelectQueryBuilder<T> =>
  builder.andWhereExists(
    builder
      .subQuery()
      .select('1')
      .from(Post, 'p')
      .where(`p.id = ${alias}."postId"`)
      .andWhere(deliverablePostPredicate('p')),
  );

export const excludedInterestPostTypes: string[] = [
  PostType.Collection,
  PostType.Digest,
  PostType.Brief,
];

const staticExcludedSourceIds = [
  COLLECTIONS_SOURCE,
  TRENDS_SOURCE,
  X_TRENDS_SOURCE,
  DIGEST_SOURCE,
  BRIEFING_SOURCE,
  AGENTS_DIGEST_SOURCE,
];

export const getExcludedInterestSourceIds = async ({
  con,
}: {
  con: DataSource;
}): Promise<string[]> => {
  const channelDigestSourceIds = await getChannelDigestSourceIds({ con });
  return [...new Set([...staticExcludedSourceIds, ...channelDigestSourceIds])];
};
