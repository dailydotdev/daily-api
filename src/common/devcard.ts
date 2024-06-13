import { subYears } from 'date-fns';
import { ReadingRank, getUserReadingRank, getUserReadingTags } from './users';
import { Post, Source, UserStreak, View } from '../entity';
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
      Source,
      'source',
      'source.id = p."sourceId" and source.active = true and source.private = false',
    )
    .where('v."userId" = :id', { id: userId })
    .andWhere('v."timestamp" > now() - interval \'1 year\'')
    .groupBy('p."sourceId"')
    .orderBy('count(*)', 'DESC')
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
  longestStreak: number;
}

export interface DevCardDataV1 {
  user: User;
  articlesRead: number;
  tags: { value: string; count: number }[];
  sourcesLogos: string[];
  rank: ReadingRank;
  longestStreak: number;
}

export async function getDevCardDataV1(
  userId: string,
  con: DataSource,
): Promise<DevCardDataV1> {
  const now = new Date();
  const start = subYears(now, 1).toISOString();
  const end = now.toISOString();
  const user = await con.getRepository(User).findOneByOrFail({ id: userId });
  const [articlesRead, tags, sources, rank, streak] = await Promise.all([
    con.getRepository(ActiveView).countBy({ userId }),
    getMostReadTags(con, { userId, limit: 4, dateRange: { start, end } }),
    getFavoriteSources(con, userId),
    getUserReadingRank(con, userId, user?.timezone, 2),
    await con.getRepository(UserStreak).findOneOrFail({
      where: { userId },
      select: ['maxStreak'],
    }),
  ]);
  return {
    user,
    articlesRead,
    tags,
    sourcesLogos: sources.map((source) => source.image),
    rank,
    longestStreak: streak?.maxStreak ?? 0,
  };
}

export async function getDevCardData(
  userId: string,
  con: DataSource,
): Promise<DevCardData> {
  const now = new Date();
  const start = subYears(now, 1).toISOString();
  const end = now.toISOString();

  const user = await con.getRepository(User).findOneOrFail({
    where: { id: userId },
    select: [
      'id',
      'name',
      'image',
      'username',
      'bio',
      'createdAt',
      'reputation',
      'cover',
    ],
  });

  const [articlesRead, tags, sources, streak] = await Promise.all([
    con.getRepository(ActiveView).countBy({ userId }),
    (
      await getMostReadTags(con, {
        userId,
        limit: 5,
        dateRange: { start, end },
      })
    ).map(({ value }) => value),
    getFavoriteSources(con, userId),
    await con.getRepository(UserStreak).findOneOrFail({
      where: { userId },
      select: ['maxStreak'],
    }),
  ]);

  return {
    user,
    articlesRead,
    tags,
    sources,
    longestStreak: streak?.maxStreak ?? 0,
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
