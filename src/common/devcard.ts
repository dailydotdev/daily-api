import { getUserReadingRank, ReadingRank } from './users';
import { Post, PostKeyword, Source, View } from '../entity';
import { Connection } from 'typeorm';
import { User } from '../entity/User';

const getMostReadTags = (
  con: Connection,
  userId: string,
): Promise<{ value: string; count: number }[]> =>
  con
    .createQueryBuilder()
    .select('pk.keyword', 'value')
    .addSelect('count(*)', 'count')
    .from(View, 'v')
    .innerJoin(PostKeyword, 'pk', 'v."postId" = pk."postId"')
    .where('v."userId" = :id', { id: userId })
    .andWhere(`pk.status = 'allow'`)
    .andWhere(`pk.keyword != 'general-programming'`)
    .groupBy('pk.keyword')
    .orderBy('2', 'DESC')
    .limit(4)
    .getRawMany();

const getFavoriteSourcesLogos = async (
  con: Connection,
  userId: string,
): Promise<string[]> => {
  const sources = await con
    .createQueryBuilder()
    .select('min(source.image)', 'image')
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
  return sources.map((source) => source.image);
};

type DevCardData = {
  user: User;
  articlesRead: number;
  tags: { value: string; count: number }[];
  sourcesLogos: string[];
  rank: ReadingRank;
};

export async function getDevCardData(
  userId: string,
  con: Connection,
): Promise<DevCardData> {
  const user = await con.getRepository(User).findOne(userId);
  const [articlesRead, tags, sourcesLogos, rank] = await Promise.all([
    con.getRepository(View).count({ userId }),
    getMostReadTags(con, userId),
    getFavoriteSourcesLogos(con, userId),
    getUserReadingRank(con, userId, user?.timezone),
  ]);
  return { user, articlesRead, tags, sourcesLogos, rank };
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
