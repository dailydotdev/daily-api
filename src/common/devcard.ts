import { subYears } from 'date-fns';
import { ReadingRank, getUserReadingRank, getUserReadingTags } from './users';
import { Post, Source, View } from '../entity';
import { User } from '../entity';
import { ReadingDaysArgs } from './users';
import { DataSource } from 'typeorm';
import { getSourceLink } from './links';
import { isPlusMember } from '../paddle';

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
  user: Pick<
    User,
    | 'id'
    | 'name'
    | 'image'
    | 'username'
    | 'bio'
    | 'createdAt'
    | 'reputation'
    | 'cover'
  > & { isPlus?: boolean };
  articlesRead: number;
  tags: string[];
  sources: DevCardSource[];
}

export interface DevCardDataV1 {
  user: User;
  articlesRead: number;
  tags: { value: string; count: number }[];
  sourcesLogos: string[];
  rank: ReadingRank;
}

export async function getDevCardDataV1(
  userId: string,
  con: DataSource,
): Promise<DevCardDataV1> {
  const now = new Date();
  const start = subYears(now, 1).toISOString();
  const end = now.toISOString();
  const user = await con.getRepository(User).findOneByOrFail({ id: userId });
  const [articlesRead, tags, sources, rank] = await Promise.all([
    con.getRepository(View).countBy({ userId }),
    getMostReadTags(con, { userId, limit: 4, dateRange: { start, end } }),
    getFavoriteSources(con, userId),
    getUserReadingRank(con, userId, user?.timezone, 2),
  ]);
  return {
    user,
    articlesRead,
    tags,
    sourcesLogos: sources.map((source) => source.image),
    rank,
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
      'subscriptionFlags',
    ],
  });
  const [articlesRead, tags, sources] = await Promise.all([
    con.getRepository(View).countBy({ userId }),
    (
      await getMostReadTags(con, {
        userId,
        limit: 5,
        dateRange: { start, end },
      })
    ).map(({ value }) => value),
    getFavoriteSources(con, userId),
  ]);

  const isPlus = isPlusMember(user.subscriptionFlags?.cycle);

  delete user.subscriptionFlags;

  return {
    user: {
      ...user,
      isPlus,
    },
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
