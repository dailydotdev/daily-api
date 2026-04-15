import { FastifyInstance } from 'fastify';
import {
  Archive,
  Keyword,
  KeywordStatus,
  Post,
  PostType,
  SentimentEntity,
  Source,
  SourceType,
  User,
} from '../entity';
import { AGENTS_DIGEST_SOURCE } from '../entity/Source';
import { ArchivePeriodType, ArchiveScopeType } from '../common/archive';
import { getUserProfileUrl } from '../common/users';
import createOrGetConnection from '../db';
import { Readable } from 'stream';
import { ONE_HOUR_IN_SECONDS } from '../common/constants';
import {
  DataSource,
  EntityManager,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';

const SITEMAP_CACHE_CONTROL = `public, max-age=${2 * ONE_HOUR_IN_SECONDS}, s-maxage=${2 * ONE_HOUR_IN_SECONDS}`;
const DEFAULT_SITEMAP_LIMIT = 50_000;
const ARCHIVE_PAGES_LIMIT = 50_000;
const QUALIFIED_SOURCE_MIN_PUBLIC_POSTS = 10;
const ARENA_SITEMAP_GROUP_IDS = [
  '385404b4-f0f4-4e81-a338-bdca851eca31',
  '970ab2c9-f845-4822-82f0-02169713b814',
];

const getPaginatedSitemapLimit = (): number => {
  const limit = Number.parseInt(process.env.SITEMAP_LIMIT || '', 10);

  return Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_SITEMAP_LIMIT;
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const normalizePrefix = (prefix: string): string =>
  prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;

const toSitemapTextStream = (
  input: NodeJS.ReadableStream,
  getUrl: (row: Record<string, string>) => string,
): Readable =>
  Readable.from(
    (async function* () {
      for await (const row of input as AsyncIterable<Record<string, string>>) {
        yield `${getUrl(row)}\n`;
      }
    })(),
  );

const toSitemapUrlSetStream = (
  input: NodeJS.ReadableStream,
  getUrl: (row: Record<string, string>) => string,
  getLastmod?: (row: Record<string, string>) => string | undefined,
): Readable =>
  Readable.from(
    (async function* () {
      yield '<?xml version="1.0" encoding="UTF-8"?>\n';
      yield '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      for await (const row of input as AsyncIterable<Record<string, string>>) {
        const lastmod = getLastmod?.(row);
        yield lastmod
          ? `  <url><loc>${escapeXml(getUrl(row))}</loc><lastmod>${escapeXml(lastmod)}</lastmod></url>\n`
          : `  <url><loc>${escapeXml(getUrl(row))}</loc></url>\n`;
      }
      yield '</urlset>';
    })(),
  );

const getSitemapUrlPrefix = (): string =>
  normalizePrefix(process.env.COMMENTS_PREFIX || 'https://app.daily.dev');

const getPostSitemapUrl = (prefix: string, slug: string): string =>
  `${prefix}/posts/${slug}`;

const getTagSitemapUrl = (prefix: string, value: string): string =>
  `${prefix}/tags/${encodeURIComponent(value)}`;

const getAgentSitemapUrl = (prefix: string, entity: string): string =>
  `${prefix}/agents/${encodeURIComponent(entity)}`;

const getSourceSitemapUrl = (prefix: string, handle: string): string =>
  `${prefix}/sources/${encodeURIComponent(handle)}`;

const getSquadSitemapUrl = (prefix: string, handle: string): string =>
  `${prefix}/squads/${encodeURIComponent(handle)}`;

const streamReplicaQuery = async <T extends ObjectLiteral>(
  con: DataSource,
  buildQuery: (source: EntityManager) => SelectQueryBuilder<T>,
): Promise<NodeJS.ReadableStream> => {
  const queryRunner = con.createQueryRunner('slave');

  try {
    const input = await buildQuery(queryRunner.manager).stream();
    let released = false;

    const releaseRunner = async (): Promise<void> => {
      if (released) {
        return;
      }

      released = true;
      await queryRunner.release();
    };

    input.once('end', () => void releaseRunner());
    input.once('error', () => void releaseRunner());
    input.once('close', () => void releaseRunner());

    return input;
  } catch (error) {
    await queryRunner.release();
    throw error;
  }
};

const POSTS_SITEMAP_EXCLUDED_TYPES = [
  PostType.Welcome,
  PostType.Collection,
  PostType.Share,
  PostType.Brief,
  PostType.SocialTwitter,
];

const buildPostsSitemapBaseQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Post> =>
  source
    .createQueryBuilder()
    .from(Post, 'p')
    .leftJoin(User, 'u', 'p."authorId" = u.id')
    .where('p.type NOT IN (:...types)', { types: POSTS_SITEMAP_EXCLUDED_TYPES })
    .andWhere('NOT p.private')
    .andWhere('NOT p.banned')
    .andWhere('NOT p.deleted')
    .andWhere('p.visible = true')
    .andWhere('p."createdAt" > current_timestamp - interval \'90 day\'')
    .andWhere('(u.id is null or u.reputation > 10)');

const applyPostsSitemapOrder = (
  query: SelectQueryBuilder<Post>,
): SelectQueryBuilder<Post> =>
  query.orderBy('p."createdAt"', 'ASC').addOrderBy('p.id', 'ASC');

const applyPaginatedSitemapWindow = (
  query: SelectQueryBuilder<Post>,
  page: number,
): SelectQueryBuilder<Post> =>
  query
    .limit(getPaginatedSitemapLimit())
    .offset((page - 1) * getPaginatedSitemapLimit());

const buildPostsSitemapQuery = (
  source: DataSource | EntityManager,
  page: number,
): SelectQueryBuilder<Post> =>
  applyPaginatedSitemapWindow(
    applyPostsSitemapOrder(
      buildPostsSitemapBaseQuery(source)
        .select('p.slug', 'slug')
        .addSelect('p."metadataChangedAt"', 'lastmod'),
    ),
    page,
  );

const buildPaginatedPostSitemapStream = async (
  con: DataSource,
  page: number,
  buildQuery: (source: EntityManager, page: number) => SelectQueryBuilder<Post>,
): Promise<Readable> => {
  const prefix = getSitemapUrlPrefix();
  const input = await streamReplicaQuery(con, (source) =>
    buildQuery(source, page),
  );

  return toSitemapUrlSetStream(
    input,
    (row) => getPostSitemapUrl(prefix, row.slug),
    getSitemapRowLastmod,
  );
};

const buildSitemapXmlStream = async <T extends ObjectLiteral>(
  con: DataSource,
  buildQuery: (source: EntityManager) => SelectQueryBuilder<T>,
  getUrl: (row: Record<string, string>) => string,
): Promise<Readable> => {
  const input = await streamReplicaQuery(con, buildQuery);

  return toSitemapUrlSetStream(input, getUrl, getSitemapRowLastmod);
};

const getSitemapPageCount = (totalPosts: number): number =>
  Math.ceil(totalPosts / getPaginatedSitemapLimit());

const getReplicaQueryCount = async (
  con: DataSource,
  buildQuery: (source: EntityManager) => SelectQueryBuilder<Post>,
): Promise<number> => {
  const queryRunner = con.createQueryRunner('slave');

  try {
    return await buildQuery(queryRunner.manager).getCount();
  } finally {
    await queryRunner.release();
  }
};

const hasPaginatedSitemapPage = async (
  con: DataSource,
  buildQuery: (source: EntityManager, page: number) => SelectQueryBuilder<Post>,
  page: number,
): Promise<boolean> => {
  const queryRunner = con.createQueryRunner('slave');

  try {
    return !!(await buildQuery(queryRunner.manager, page).limit(1).getRawOne());
  } finally {
    await queryRunner.release();
  }
};

const buildSitemapIndexEntries = (
  prefix: string,
  sitemapCount: number,
  getPath: (page: number) => string,
): string =>
  Array.from({ length: sitemapCount }, (_, index) => {
    const page = index + 1;

    return `  <sitemap>
    <loc>${escapeXml(`${prefix}${getPath(page)}`)}</loc>
  </sitemap>`;
  }).join('\n');

const buildPostsSitemapTextQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Post> =>
  applyPostsSitemapOrder(
    buildPostsSitemapBaseQuery(source).select('p.slug', 'slug'),
  );

const buildPostSitemapStream = async (
  con: DataSource,
  page: number,
): Promise<Readable> =>
  buildPaginatedPostSitemapStream(con, page, buildPostsSitemapQuery);

const buildEvergreenSitemapBaseQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Post> =>
  source
    .createQueryBuilder()
    .from(Post, 'p')
    .leftJoin(User, 'u', 'p."authorId" = u.id')
    .where('p.type NOT IN (:...types)', { types: POSTS_SITEMAP_EXCLUDED_TYPES })
    .andWhere('NOT p.private')
    .andWhere('NOT p.banned')
    .andWhere('NOT p.deleted')
    .andWhere('p.visible = true')
    .andWhere('p."createdAt" <= current_timestamp - interval \'90 day\'')
    .andWhere('p.upvotes >= :minUpvotes', { minUpvotes: 10 })
    .andWhere('(u.id is null or u.reputation > 10)');

const buildEvergreenSitemapQuery = (
  source: DataSource | EntityManager,
  page: number,
): SelectQueryBuilder<Post> =>
  applyPaginatedSitemapWindow(
    buildEvergreenSitemapBaseQuery(source)
      .select('p.slug', 'slug')
      .addSelect('p."metadataChangedAt"', 'lastmod')
      .orderBy('p."createdAt"', 'ASC')
      .addOrderBy('p.id', 'ASC'),
    page,
  );

const buildCollectionsSitemapQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Post> =>
  applyPostsSitemapOrder(
    source
      .createQueryBuilder()
      .select('p.slug', 'slug')
      .addSelect('p."metadataChangedAt"', 'lastmod')
      .from(Post, 'p')
      .where('p.type = :type', { type: PostType.Collection })
      .andWhere('NOT p.private')
      .andWhere('NOT p.banned')
      .andWhere('NOT p.deleted')
      .andWhere('p.visible = true')
      .andWhere('p.upvotes >= :minUpvotes', { minUpvotes: 1 })
      .andWhere(
        'COALESCE(array_length(p."collectionSources", 1), 0) >= :minSources',
        {
          minSources: 3,
        },
      )
      .limit(DEFAULT_SITEMAP_LIMIT),
  );

const buildTagsSitemapQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Keyword> =>
  source
    .createQueryBuilder()
    .select('k.value', 'value')
    .addSelect('k."updatedAt"', 'lastmod')
    .from(Keyword, 'k')
    .where('k.status = :status', { status: KeywordStatus.Allow })
    .orderBy('value', 'ASC')
    .limit(DEFAULT_SITEMAP_LIMIT);

const buildAgentsSitemapQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<SentimentEntity> =>
  source
    .createQueryBuilder()
    .select('se.entity', 'entity')
    .addSelect('se."createdAt"', 'lastmod')
    .from(SentimentEntity, 'se')
    .where('se."groupId" IN (:...groupIds)', {
      groupIds: ARENA_SITEMAP_GROUP_IDS,
    })
    .orderBy('se.entity', 'ASC')
    .limit(DEFAULT_SITEMAP_LIMIT);

const buildAgentsDigestSitemapQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Post> =>
  source
    .createQueryBuilder()
    .select('p.slug', 'slug')
    .addSelect('p."createdAt"', 'lastmod')
    .from(Post, 'p')
    .where('p."sourceId" = :sourceId', { sourceId: AGENTS_DIGEST_SOURCE })
    .andWhere('NOT p.deleted')
    .orderBy('p."createdAt"', 'DESC')
    .limit(DEFAULT_SITEMAP_LIMIT);

const buildSourcesSitemapQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Source> =>
  source
    .createQueryBuilder()
    .select('s.handle', 'handle')
    .addSelect('s."createdAt"', 'lastmod')
    .from(Source, 's')
    .innerJoin(
      Post,
      'p',
      `p."sourceId" = s.id
      AND p.deleted = false
      AND p.visible = true
      AND p.private = false
      AND p.banned = false`,
    )
    .where('s.type = :type', { type: SourceType.Machine })
    .andWhere('s.active = true')
    .andWhere('s.private = false')
    .groupBy('s.id')
    .addGroupBy('s.handle')
    .addGroupBy('s."createdAt"')
    .having('COUNT(*) >= :minPublicPosts')
    .andHaving(`MAX(p."createdAt") >= current_timestamp - interval '12 months'`)
    .orderBy('s."createdAt"', 'DESC')
    .addOrderBy('s.handle', 'ASC')
    .limit(DEFAULT_SITEMAP_LIMIT)
    .setParameter('minPublicPosts', QUALIFIED_SOURCE_MIN_PUBLIC_POSTS);

const buildSquadsSitemapQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Source> =>
  source
    .createQueryBuilder()
    .select('s.handle', 'handle')
    .addSelect('s."createdAt"', 'lastmod')
    .from(Source, 's')
    .where('s.type = :type', { type: SourceType.Squad })
    .andWhere('s.active = true')
    .andWhere('s.private = false')
    .andWhere(`(s.flags->>'publicThreshold')::boolean IS TRUE`)
    .orderBy('s."createdAt"', 'DESC')
    .limit(DEFAULT_SITEMAP_LIMIT);

const buildUsersSitemapQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<User> =>
  source
    .createQueryBuilder()
    .select('u.username', 'username')
    .addSelect('u."updatedAt"', 'lastmod')
    .from(User, 'u')
    .where('u.reputation > :minRep', { minRep: 10 })
    .andWhere('u.bio IS NOT NULL')
    .andWhere(`btrim(u.bio) != ''`)
    .andWhere('u.username IS NOT NULL')
    .andWhere((qb) => {
      const subQuery = qb
        .subQuery()
        .select('1')
        .from(Post, 'p')
        .where('p."authorId" = u.id')
        .andWhere('p.deleted = false')
        .andWhere('p.visible = true')
        .andWhere('p.private = false')
        .getQuery();

      return `EXISTS ${subQuery}`;
    })
    .orderBy('u.reputation', 'DESC')
    .addOrderBy('u.username', 'ASC')
    .limit(DEFAULT_SITEMAP_LIMIT);

const zeroPadMonth = (month: number): string =>
  month.toString().padStart(2, '0');

const getArchiveBestOfUrl = (
  prefix: string,
  scopeType: ArchiveScopeType,
  scopeId: string | null,
): string => {
  switch (scopeType) {
    case ArchiveScopeType.Global:
      return `${prefix}/posts/best-of`;
    case ArchiveScopeType.Tag:
      if (!scopeId) {
        throw new Error('Archive tag sitemap URL requires a scopeId');
      }

      return `${prefix}/tags/${encodeURIComponent(scopeId)}/best-of`;
    case ArchiveScopeType.Source:
      if (!scopeId) {
        throw new Error('Archive source sitemap URL requires a scopeId');
      }

      return `${prefix}/sources/${encodeURIComponent(scopeId)}/best-of`;
  }

  throw new Error(`Unsupported archive scope type: ${scopeType}`);
};

const getArchivePageUrl = (
  prefix: string,
  scopeType: ArchiveScopeType,
  scopeId: string | null,
  periodType: ArchivePeriodType,
  periodStart: Date,
): string => {
  const base = getArchiveBestOfUrl(prefix, scopeType, scopeId);
  const year = periodStart.getUTCFullYear();

  if (periodType === ArchivePeriodType.Year) {
    return `${base}/${year}`;
  }

  const month = zeroPadMonth(periodStart.getUTCMonth() + 1);

  return `${base}/${year}/${month}`;
};

const buildArchiveIndexSitemapQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Archive> =>
  source
    .createQueryBuilder()
    .select('DISTINCT a."scopeType"', 'scopeType')
    .addSelect(
      `CASE WHEN a."scopeType" = '${ArchiveScopeType.Source}' THEN s.handle ELSE a."scopeId" END`,
      'scopeId',
    )
    .addSelect('MAX(a."createdAt")', 'lastmod')
    .from(Archive, 'a')
    .leftJoin(
      Source,
      's',
      `a."scopeType" = '${ArchiveScopeType.Source}' AND s.id = a."scopeId"`,
    )
    .where('a."scopeType" IN (:...scopeTypes)', {
      scopeTypes: [
        ArchiveScopeType.Global,
        ArchiveScopeType.Tag,
        ArchiveScopeType.Source,
      ],
    })
    .andWhere(
      `CASE WHEN a."scopeType" = '${ArchiveScopeType.Source}' THEN s.handle IS NOT NULL AND s.type != '${SourceType.Squad}' ELSE TRUE END`,
    )
    .groupBy('a."scopeType"')
    .addGroupBy(
      `CASE WHEN a."scopeType" = '${ArchiveScopeType.Source}' THEN s.handle ELSE a."scopeId" END`,
    )
    .orderBy('a."scopeType"', 'ASC')
    .addOrderBy(
      `CASE WHEN a."scopeType" = '${ArchiveScopeType.Source}' THEN s.handle ELSE a."scopeId" END`,
      'ASC',
    )
    .limit(DEFAULT_SITEMAP_LIMIT);

const VALID_ARCHIVE_SCOPE_TYPES = new Set<string>([
  ArchiveScopeType.Global,
  ArchiveScopeType.Tag,
  ArchiveScopeType.Source,
]);
const VALID_ARCHIVE_PERIOD_TYPES = new Set<string>([
  ArchivePeriodType.Month,
  ArchivePeriodType.Year,
]);

const buildArchivePagesPaginatedQuery = (
  source: DataSource | EntityManager,
  scopeType: ArchiveScopeType,
  periodType: ArchivePeriodType,
  page: number,
): SelectQueryBuilder<Archive> => {
  const qb = source
    .createQueryBuilder()
    .select('a."scopeType"', 'scopeType')
    .addSelect(
      scopeType === ArchiveScopeType.Global
        ? 'NULL'
        : scopeType === ArchiveScopeType.Source
          ? 's.handle'
          : 'a."scopeId"',
      'scopeId',
    )
    .addSelect('a."periodType"', 'periodType')
    .addSelect('a."periodStart"', 'periodStart')
    .addSelect('a."createdAt"', 'lastmod')
    .from(Archive, 'a')
    .where('a."scopeType" = :scopeType', { scopeType })
    .andWhere('a."periodType" = :periodType', { periodType });

  switch (scopeType) {
    case ArchiveScopeType.Source:
      qb.innerJoin(
        Source,
        's',
        `s.id = a."scopeId" AND s.type != '${SourceType.Squad}'`,
      );
      qb.orderBy('s.handle', 'ASC');
      break;
    case ArchiveScopeType.Tag:
      qb.orderBy('a."scopeId"', 'ASC');
      break;
  }

  qb.addOrderBy('a."periodStart"', 'ASC')
    .limit(ARCHIVE_PAGES_LIMIT)
    .offset(page * ARCHIVE_PAGES_LIMIT);

  return qb;
};

const getArchivePagesCount = async (
  con: DataSource,
): Promise<{ scopeType: string; periodType: string; count: number }[]> => {
  const queryRunner = con.createQueryRunner('slave');

  try {
    const rows = await queryRunner.manager
      .createQueryBuilder()
      .select('a."scopeType"', 'scopeType')
      .addSelect('a."periodType"', 'periodType')
      .addSelect('COUNT(*)', 'count')
      .from(Archive, 'a')
      .where('a."scopeType" IN (:...scopeTypes)', {
        scopeTypes: [
          ArchiveScopeType.Global,
          ArchiveScopeType.Tag,
          ArchiveScopeType.Source,
        ],
      })
      .groupBy('a."scopeType"')
      .addGroupBy('a."periodType"')
      .getRawMany<{ scopeType: string; periodType: string; count: string }>();

    return rows.map((row) => ({
      scopeType: row.scopeType,
      periodType: row.periodType,
      count: Number(row.count),
    }));
  } finally {
    await queryRunner.release();
  }
};

const getPostsSitemapPath = (page: number): string =>
  page === 1 ? '/api/sitemaps/posts-1.xml' : `/api/sitemaps/posts-${page}.xml`;

const getEvergreenSitemapPath = (page: number): string =>
  page === 1
    ? '/api/sitemaps/evergreen.xml'
    : `/api/sitemaps/evergreen-${page}.xml`;

const buildEvergreenSitemapStream = async (
  con: DataSource,
  page: number,
): Promise<Readable> =>
  buildPaginatedPostSitemapStream(con, page, buildEvergreenSitemapQuery);

const buildArchivePagesIndexEntries = (
  prefix: string,
  archivePageCounts: { scopeType: string; periodType: string; count: number }[],
): string =>
  archivePageCounts
    .flatMap(({ scopeType, periodType, count }) => {
      const pages = Math.max(1, Math.ceil(count / ARCHIVE_PAGES_LIMIT));

      return Array.from(
        { length: pages },
        (_, i) =>
          `  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/archive-pages-${scopeType}-${periodType}-${i}.xml`)}</loc>
  </sitemap>`,
      );
    })
    .join('\n');

const getSitemapIndexXml = (
  postsSitemapCount: number,
  evergreenSitemapCount: number,
  archivePageCounts: { scopeType: string; periodType: string; count: number }[],
): string => {
  const prefix = getSitemapUrlPrefix();
  const postsSitemaps = buildSitemapIndexEntries(
    prefix,
    postsSitemapCount,
    getPostsSitemapPath,
  );
  const evergreenSitemaps = buildSitemapIndexEntries(
    prefix,
    evergreenSitemapCount,
    getEvergreenSitemapPath,
  );
  const archivePagesSitemaps = buildArchivePagesIndexEntries(
    prefix,
    archivePageCounts,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${postsSitemaps}
${evergreenSitemaps}
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/collections.xml`)}</loc>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/tags.xml`)}</loc>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/agents.xml`)}</loc>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/agents-digest.xml`)}</loc>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/sources.xml`)}</loc>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/squads.xml`)}</loc>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/users.xml`)}</loc>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/archive-index.xml`)}</loc>
  </sitemap>
${archivePagesSitemaps}
</sitemapindex>`;
};

export const getSitemapRowLastmod = (
  row: Record<string, string | Date | null | undefined>,
): string | undefined => {
  const rawLastmod = row.lastmod;

  if (!rawLastmod) {
    return undefined;
  }

  if (rawLastmod instanceof Date) {
    if (Number.isNaN(rawLastmod.getTime())) {
      return undefined;
    }

    return rawLastmod.toISOString();
  }

  const normalizedLastmod = rawLastmod.includes('T')
    ? rawLastmod
    : rawLastmod.replace(' ', 'T');
  const withTimezone =
    normalizedLastmod.endsWith('Z') ||
    /[+-]\d{2}:?\d{2}$/.test(normalizedLastmod)
      ? normalizedLastmod
      : `${normalizedLastmod}Z`;
  const timestamp = new Date(withTimezone);

  if (Number.isNaN(timestamp.getTime())) {
    return undefined;
  }

  return timestamp.toISOString();
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/posts.txt', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();
    const input = await streamReplicaQuery(con, buildPostsSitemapTextQuery);
    const stream = toSitemapTextStream(input, (row) =>
      getPostSitemapUrl(prefix, row.slug),
    );

    return res
      .type('text/plain')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(stream);
  });

  fastify.get('/posts.xml', async (_, res) => {
    const con = await createOrGetConnection();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(await buildPostSitemapStream(con, 1));
  });

  fastify.get<{
    Params: { page: string };
  }>('/posts-:page.xml', async (req, res) => {
    const page = Number.parseInt(req.params.page, 10);

    if (!Number.isInteger(page) || page < 1) {
      return res.code(404).send();
    }

    const con = await createOrGetConnection();

    if (
      !(await hasPaginatedSitemapPage(con, buildPostsSitemapQuery, page))
    ) {
      return res.code(404).send();
    }

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(await buildPostSitemapStream(con, page));
  });

  fastify.get('/evergreen.xml', async (_, res) => {
    const con = await createOrGetConnection();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(await buildEvergreenSitemapStream(con, 1));
  });

  fastify.get<{
    Params: { page: string };
  }>('/evergreen-:page.xml', async (req, res) => {
    const page = Number.parseInt(req.params.page, 10);

    if (!Number.isInteger(page) || page < 1) {
      return res.code(404).send();
    }

    const con = await createOrGetConnection();

    if (
      !(await hasPaginatedSitemapPage(con, buildEvergreenSitemapQuery, page))
    ) {
      return res.code(404).send();
    }

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(await buildEvergreenSitemapStream(con, page));
  });

  fastify.get('/collections.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        await buildSitemapXmlStream(con, buildCollectionsSitemapQuery, (row) =>
          getPostSitemapUrl(prefix, row.slug),
        ),
      );
  });

  fastify.get('/tags.txt', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();
    const input = await streamReplicaQuery(con, buildTagsSitemapQuery);
    const stream = toSitemapTextStream(input, (row) =>
      getTagSitemapUrl(prefix, row.value),
    );

    return res
      .type('text/plain')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(stream);
  });

  fastify.get('/tags.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        await buildSitemapXmlStream(con, buildTagsSitemapQuery, (row) =>
          getTagSitemapUrl(prefix, row.value),
        ),
      );
  });

  fastify.get('/agents.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        await buildSitemapXmlStream(con, buildAgentsSitemapQuery, (row) =>
          getAgentSitemapUrl(prefix, row.entity),
        ),
      );
  });

  fastify.get('/agents-digest.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        await buildSitemapXmlStream(con, buildAgentsDigestSitemapQuery, (row) =>
          getPostSitemapUrl(prefix, row.slug),
        ),
      );
  });

  fastify.get('/sources.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        await buildSitemapXmlStream(con, buildSourcesSitemapQuery, (row) =>
          getSourceSitemapUrl(prefix, row.handle),
        ),
      );
  });

  fastify.get('/squads.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        await buildSitemapXmlStream(con, buildSquadsSitemapQuery, (row) =>
          getSquadSitemapUrl(prefix, row.handle),
        ),
      );
  });

  fastify.get('/users.xml', async (_, res) => {
    const con = await createOrGetConnection();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        await buildSitemapXmlStream(con, buildUsersSitemapQuery, (row) =>
          getUserProfileUrl(row.username),
        ),
      );
  });

  fastify.get('/archive-index.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        await buildSitemapXmlStream(con, buildArchiveIndexSitemapQuery, (row) =>
          getArchiveBestOfUrl(
            prefix,
            row.scopeType as ArchiveScopeType,
            row.scopeId,
          ),
        ),
      );
  });

  fastify.get<{
    Params: { scopeType: string; periodType: string; page: string };
  }>('/archive-pages-:scopeType-:periodType-:page.xml', async (req, res) => {
    const { scopeType, periodType } = req.params;
    const page = Number.parseInt(req.params.page, 10);

    if (
      !VALID_ARCHIVE_SCOPE_TYPES.has(scopeType) ||
      !VALID_ARCHIVE_PERIOD_TYPES.has(periodType) ||
      !Number.isInteger(page) ||
      page < 0
    ) {
      return res.code(404).send();
    }

    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        await buildSitemapXmlStream(
          con,
          (source) =>
            buildArchivePagesPaginatedQuery(
              source,
              scopeType as ArchiveScopeType,
              periodType as ArchivePeriodType,
              page,
            ),
          (row) =>
            getArchivePageUrl(
              prefix,
              row.scopeType as ArchiveScopeType,
              row.scopeId,
              row.periodType as ArchivePeriodType,
              new Date(row.periodStart),
            ),
        ),
      );
  });

  fastify.get('/index.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const [postsSitemapCount, evergreenSitemapCount, archivePageCounts] =
      await Promise.all([
        getReplicaQueryCount(con, buildPostsSitemapBaseQuery).then(
          getSitemapPageCount,
        ),
        getReplicaQueryCount(con, buildEvergreenSitemapBaseQuery).then(
          getSitemapPageCount,
        ),
        getArchivePagesCount(con),
      ]);

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        getSitemapIndexXml(
          postsSitemapCount,
          evergreenSitemapCount,
          archivePageCounts,
        ),
      );
  });
}
