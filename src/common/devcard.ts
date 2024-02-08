import { subYears } from 'date-fns';
import { getUserReadingTags } from './users';
import { Post, Source, View } from '../entity';
import { User } from '../entity';
import { ReadingDaysArgs } from './users';
import { ActiveView } from '../entity/ActiveView';
import { DataSource } from 'typeorm';
import { getSourceLink } from './links';

export interface MostReadTag {
  value: string;
  count: number;
  percentage?: number;
}

export const getMostReadTags = async (
  con: DataSource,
  args: ReadingDaysArgs,
): Promise<MostReadTag[]> => {
  const result = await getUserReadingTags(con, args);

  return result.map(({ tag, readingDays, ...props }) => ({
    value: tag,
    count: readingDays,
    ...props,
  }));
};

interface DevCardSource extends Pick<Source, 'image' | 'name'> {
  permalink: string;
}

const getFavoriteSources = async (
  con: DataSource,
  userId: string,
): Promise<DevCardSource[]> => {
  const sources = await con
    .createQueryBuilder()
    .select('min(source.image)', 'image')
    .addSelect('min(source.name)', 'name')
    .addSelect('min(source.handle)', 'handle')
    .addSelect('min(source.type)', 'type')
    .from(View, 'v')
    .innerJoin(Post, 'p', 'v."postId" = p.id')
    .innerJoin(
      (qb) =>
        qb
          .select('"sourceId"')
          .addSelect('count(*)', 'count')
          .from(Post, 'post')
          .groupBy('"sourceId"'),
      's',
      's."sourceId" = p."sourceId"',
    )
    .innerJoin(
      Source,
      'source',
      'source.id = p."sourceId" and source.active = true and source.private = false',
    )
    .where('v."userId" = :id', { id: userId })
    .andWhere(`s.count > 10`)
    .groupBy('p."sourceId"')
    .orderBy('count(*) * 1.0 / min(s.count)', 'DESC')
    .limit(5)
    .getRawMany();
  return sources.map((source) => ({
    ...source,
    permalink: getSourceLink(source),
  }));
};

export interface DevCardData {
  user: User;
  articlesRead: number;
  tags: string[];
  sources: DevCardSource[];
}

export async function getDevCardData(
  userId: string,
  con: DataSource,
): Promise<DevCardData> {
  const now = new Date();
  const start = subYears(now, 1).toISOString();
  const end = now.toISOString();

  const user = await con.getRepository(User).findOneByOrFail({ id: userId });
  const [articlesRead, tags, sources] = await Promise.all([
    con.getRepository(ActiveView).countBy({ userId }),
    (
      await getMostReadTags(con, {
        userId,
        limit: 5,
        dateRange: { start, end },
      })
    ).map(({ value }) => value),
    getFavoriteSources(con, userId),
  ]);

  return {
    user,
    articlesRead,
    tags,
    sources,
  };
}

const uppercaseTags = ['css', 'html', 'aws', 'gcp'];

export function transformTag(tag: string): string {
  if (uppercaseTags.indexOf(tag) > -1) {
    return tag.toUpperCase();
  }
  const separateWord = tag.replace(/-/g, ' ').split(' ');
  for (let i = 0; i < separateWord.length; i++) {
    separateWord[i] =
      separateWord[i].charAt(0).toUpperCase() + separateWord[i].substring(1);
  }
  return separateWord.join(' ');
}

export function largeNumberFormat(value: number): string {
  let newValue = value;
  const suffixes = ['', 'K', 'M', 'B', 'T'];
  let suffixNum = 0;
  while (newValue >= 1000) {
    newValue /= 1000;
    suffixNum++;
  }
  if (suffixNum > 0) {
    return newValue.toFixed(1) + suffixes[suffixNum];
  }
  return newValue.toString();
}
