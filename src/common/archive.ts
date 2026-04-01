import { ValidationError } from 'apollo-server-errors';
import { randomUUID } from 'crypto';
import {
  addMonths,
  addYears,
  startOfMonth,
  startOfYear,
  subMonths,
  subYears,
} from 'date-fns';
import type {
  DataSource,
  EntityManager,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { Archive } from '../entity/Archive';
import { PostKeyword } from '../entity/PostKeyword';
import { Source } from '../entity/Source';
import { Post, PostType } from '../entity/posts/Post';

export enum ArchiveSubjectType {
  Post = 'post',
  User = 'user',
  Squad = 'squad',
}

export enum ArchiveRankingType {
  Best = 'best',
}

export enum ArchiveScopeType {
  Global = 'global',
  Tag = 'tag',
  Source = 'source',
}

export enum ArchivePeriodType {
  Month = 'month',
  Year = 'year',
}

type DataSourceOrManager = DataSource | EntityManager;

type ArchiveKey = {
  subjectType: ArchiveSubjectType;
  rankingType: ArchiveRankingType;
  scopeType: ArchiveScopeType;
  scopeId: string | null;
  periodType: ArchivePeriodType;
  periodStart: Date;
};

type MaterializeArchiveArgs = ArchiveKey & {
  con: DataSourceOrManager;
};

const eligiblePostTypes = [
  PostType.Article,
  PostType.VideoYouTube,
  PostType.Freeform,
  PostType.Collection,
  PostType.Share,
];

const publishedArchiveItemsLimit = 100;

const archiveThresholds: Record<
  Exclude<ArchiveScopeType, ArchiveScopeType.Global>,
  number
> = {
  tag: 3,
  source: 3,
};

const getRepositoryContext = (con: DataSourceOrManager) =>
  'manager' in con ? con.manager : con;

export const getArchivePeriodStart = ({
  periodType,
  year,
  month,
}: {
  periodType: ArchivePeriodType;
  year: number;
  month?: number | null;
}): Date => {
  if (periodType === ArchivePeriodType.Year) {
    return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  }

  if (!month) {
    throw new ValidationError('month is required for monthly archives');
  }

  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
};

const getArchivePeriodEnd = ({
  periodType,
  periodStart,
}: Pick<ArchiveKey, 'periodType' | 'periodStart'>): Date =>
  periodType === ArchivePeriodType.Month
    ? addMonths(periodStart, 1)
    : addYears(periodStart, 1);

const applyEligiblePostFilters = ({
  queryBuilder,
  postAlias,
  periodStart,
  periodEnd,
}: {
  queryBuilder: SelectQueryBuilder<ObjectLiteral>;
  postAlias: string;
  periodStart: Date;
  periodEnd: Date;
}): SelectQueryBuilder<ObjectLiteral> =>
  queryBuilder
    .andWhere(`${postAlias}."createdAt" >= :periodStart`, { periodStart })
    .andWhere(`${postAlias}."createdAt" < :periodEnd`, { periodEnd })
    .andWhere(`${postAlias}.type = ANY(:eligiblePostTypes)`, {
      eligiblePostTypes,
    })
    .andWhere(`${postAlias}.upvotes >= :minimumUpvotes`, { minimumUpvotes: 10 })
    .andWhere(`${postAlias}.banned = false`)
    .andWhere(`${postAlias}.deleted = false`)
    .andWhere(`${postAlias}.visible = true`)
    .andWhere(`${postAlias}.private = false`)
    .andWhere(`${postAlias}."showOnFeed" = true`);

const createEligiblePostsQuery = ({
  con,
  scopeType,
  scopeId,
  periodType,
  periodStart,
}: Pick<
  MaterializeArchiveArgs,
  'con' | 'scopeType' | 'scopeId' | 'periodType' | 'periodStart'
>): SelectQueryBuilder<Post> => {
  const queryBuilder = getRepositoryContext(con)
    .getRepository(Post)
    .createQueryBuilder('post')
    .innerJoin(Source, 'source', 'source.id = post."sourceId"');

  applyEligiblePostFilters({
    queryBuilder,
    postAlias: 'post',
    periodStart,
    periodEnd: getArchivePeriodEnd({ periodType, periodStart }),
  });

  queryBuilder
    .andWhere('source.private = false')
    .andWhere('source.active = true');

  switch (scopeType) {
    case ArchiveScopeType.Tag:
      if (!scopeId) {
        throw new ValidationError('scopeId is required for non-global scopes');
      }
      queryBuilder.innerJoin(
        PostKeyword,
        'postkeyword',
        'postkeyword."postId" = post.id AND postkeyword.keyword = :scopeId AND postkeyword.status = :keywordStatus',
        {
          scopeId,
          keywordStatus: 'allow',
        },
      );
      break;
    case ArchiveScopeType.Source:
      if (!scopeId) {
        throw new ValidationError('scopeId is required for non-global scopes');
      }
      queryBuilder.andWhere('post."sourceId" = :scopeId', { scopeId });
      break;
  }

  return queryBuilder;
};

const getEligibleSourceScopes = async ({
  con,
  periodType,
  periodStart,
}: Pick<MaterializeArchiveArgs, 'con' | 'periodType' | 'periodStart'>) => {
  const queryBuilder = getRepositoryContext(con)
    .getRepository(Post)
    .createQueryBuilder('post')
    .innerJoin(Source, 'source', 'source.id = post."sourceId"')
    .select('post."sourceId"', 'scopeId')
    .addSelect('COUNT(DISTINCT post.id)', 'eligibleCount')
    .groupBy('post."sourceId"')
    .orderBy('post."sourceId"', 'ASC');

  applyEligiblePostFilters({
    queryBuilder,
    postAlias: 'post',
    periodStart,
    periodEnd: getArchivePeriodEnd({ periodType, periodStart }),
  });

  queryBuilder
    .andWhere('source.private = false')
    .andWhere('source.active = true')
    .having('COUNT(DISTINCT post.id) >= :minimumEligiblePosts', {
      minimumEligiblePosts: archiveThresholds.source,
    });

  const rows = await queryBuilder.getRawMany<{ scopeId: string }>();

  return rows.map((row) => row.scopeId);
};

const getEligibleTagScopes = async ({
  con,
  periodType,
  periodStart,
}: Pick<MaterializeArchiveArgs, 'con' | 'periodType' | 'periodStart'>) => {
  const queryBuilder = getRepositoryContext(con)
    .getRepository(PostKeyword)
    .createQueryBuilder('postkeyword')
    .innerJoin(Post, 'post', 'post.id = postkeyword."postId"')
    .innerJoin(Source, 'source', 'source.id = post."sourceId"')
    .select('postkeyword.keyword', 'scopeId')
    .addSelect('COUNT(DISTINCT post.id)', 'eligibleCount')
    .where('postkeyword.status = :keywordStatus', { keywordStatus: 'allow' })
    .groupBy('postkeyword.keyword')
    .orderBy('postkeyword.keyword', 'ASC');

  applyEligiblePostFilters({
    queryBuilder,
    postAlias: 'post',
    periodStart,
    periodEnd: getArchivePeriodEnd({ periodType, periodStart }),
  });

  queryBuilder
    .andWhere('source.private = false')
    .andWhere('source.active = true');

  queryBuilder.having('COUNT(DISTINCT post.id) >= :minimumEligiblePosts', {
    minimumEligiblePosts: archiveThresholds.tag,
  });

  const rows = await queryBuilder.getRawMany<{ scopeId: string }>();

  return rows.map((row) => row.scopeId);
};

export const materializeArchive = async ({
  con,
  subjectType,
  rankingType,
  scopeType,
  scopeId,
  periodType,
  periodStart,
}: MaterializeArchiveArgs): Promise<Archive | null> => {
  if (
    subjectType !== ArchiveSubjectType.Post ||
    rankingType !== ArchiveRankingType.Best
  ) {
    throw new ValidationError('Only best post archives are supported in v1');
  }

  return getRepositoryContext(con).transaction(async (manager) => {
    const archiveId = randomUUID();
    const insertResult = await manager
      .createQueryBuilder()
      .insert()
      .into(Archive)
      .values({
        id: archiveId,
        subjectType,
        rankingType,
        scopeType,
        scopeId,
        periodType,
        periodStart,
      })
      .returning('id')
      .orIgnore()
      .execute();

    if (!insertResult.raw.length) {
      return null;
    }

    const eligiblePostsQuery = createEligiblePostsQuery({
      con: manager,
      scopeType,
      scopeId,
      periodType,
      periodStart,
    })
      .select('post.id', 'id')
      .addSelect('post.upvotes', 'upvotes')
      .addSelect('post."createdAt"', 'createdAt')
      .distinct(true)
      .orderBy('post.upvotes', 'DESC')
      .addOrderBy('post."createdAt"', 'DESC')
      .addOrderBy('post.id', 'ASC')
      .limit(publishedArchiveItemsLimit);

    const rankedArchiveItemsQuery = manager
      .createQueryBuilder()
      .select(':archiveId', 'archiveId')
      .addSelect('eligible.id', 'subjectId')
      .addSelect(
        'ROW_NUMBER() OVER (ORDER BY eligible.upvotes DESC, eligible."createdAt" DESC, eligible.id ASC)',
        'rank',
      )
      .from(`(${eligiblePostsQuery.getQuery()})`, 'eligible')
      .setParameters({
        archiveId,
        ...eligiblePostsQuery.getParameters(),
      });

    const [rankedArchiveItemsSql, rankedArchiveItemsParameters] =
      rankedArchiveItemsQuery.getQueryAndParameters();

    await manager.query(
      `INSERT INTO "archive_item" ("archiveId", "subjectId", "rank") ${rankedArchiveItemsSql}`,
      rankedArchiveItemsParameters,
    );

    return manager.getRepository(Archive).create({
      id: archiveId,
      subjectType,
      rankingType,
      scopeType,
      scopeId,
      periodType,
      periodStart,
    });
  });
};

export const materializePeriodArchives = async ({
  con,
  now = new Date(),
  periodType,
}: {
  con: DataSourceOrManager;
  now?: Date;
  periodType: ArchivePeriodType;
}): Promise<void> => {
  const periodStart =
    periodType === ArchivePeriodType.Month
      ? startOfMonth(subMonths(now, 1))
      : startOfYear(subYears(now, 1));

  await materializeArchivesForPeriodStart({
    con,
    periodType,
    periodStart,
  });
};

export const materializeArchivesForPeriodStart = async ({
  con,
  periodType,
  periodStart,
}: {
  con: DataSourceOrManager;
  periodType: ArchivePeriodType;
  periodStart: Date;
}): Promise<void> => {
  if (
    (periodType === ArchivePeriodType.Month &&
      startOfMonth(periodStart).getTime() !== periodStart.getTime()) ||
    (periodType === ArchivePeriodType.Year &&
      startOfYear(periodStart).getTime() !== periodStart.getTime())
  ) {
    throw new ValidationError('periodStart must align with the period type');
  }

  await materializeArchive({
    con,
    subjectType: ArchiveSubjectType.Post,
    rankingType: ArchiveRankingType.Best,
    scopeType: ArchiveScopeType.Global,
    scopeId: null,
    periodType,
    periodStart,
  });

  const tagScopeIds = await getEligibleTagScopes({
    con,
    periodType,
    periodStart,
  });

  for (const tagScopeId of tagScopeIds) {
    await materializeArchive({
      con,
      subjectType: ArchiveSubjectType.Post,
      rankingType: ArchiveRankingType.Best,
      scopeType: ArchiveScopeType.Tag,
      scopeId: tagScopeId,
      periodType,
      periodStart,
    });
  }

  const sourceScopeIds = await getEligibleSourceScopes({
    con,
    periodType,
    periodStart,
  });

  for (const sourceScopeId of sourceScopeIds) {
    await materializeArchive({
      con,
      subjectType: ArchiveSubjectType.Post,
      rankingType: ArchiveRankingType.Best,
      scopeType: ArchiveScopeType.Source,
      scopeId: sourceScopeId,
      periodType,
      periodStart,
    });
  }
};
