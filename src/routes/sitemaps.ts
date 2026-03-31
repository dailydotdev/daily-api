import { FastifyInstance } from 'fastify';
import {
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
  `${prefix}/tags/${value}`;

const getAgentSitemapUrl = (prefix: string, entity: string): string =>
  `${prefix}/agents/${encodeURIComponent(entity)}`;

const getSquadSitemapUrl = (prefix: string, handle: string): string =>
  `${prefix}/squads/${encodeURIComponent(handle)}`;

const getUserSitemapUrl = (prefix: string, username: string): string =>
  `${prefix}/${encodeURIComponent(username)}`;

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

const buildPostsSitemapBaseQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Post> =>
  source
    .createQueryBuilder()
    .from(Post, 'p')
    .leftJoin(User, 'u', 'p."authorId" = u.id')
    .where('p.type NOT IN (:...types)', { types: [PostType.Welcome] })
    .andWhere('NOT p.private')
    .andWhere('NOT p.banned')
    .andWhere('NOT p.deleted')
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

const getSitemapPageCount = (totalPosts: number): number =>
  Math.max(1, Math.ceil(totalPosts / getPaginatedSitemapLimit()));

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
    .where('p.type NOT IN (:...types)', { types: [PostType.Welcome] })
    .andWhere('NOT p.private')
    .andWhere('NOT p.banned')
    .andWhere('NOT p.deleted')
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
    .andWhere(`u.bio != ''`)
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
    .limit(getPaginatedSitemapLimit());

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

const getSitemapIndexXml = (
  postsSitemapCount: number,
  evergreenSitemapCount: number,
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

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${postsSitemaps}
${evergreenSitemaps}
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
    <loc>${escapeXml(`${prefix}/api/sitemaps/squads.xml`)}</loc>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/users.xml`)}</loc>
  </sitemap>
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

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(await buildEvergreenSitemapStream(con, page));
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
    const input = await streamReplicaQuery(con, buildTagsSitemapQuery);

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        toSitemapUrlSetStream(
          input,
          (row) => getTagSitemapUrl(prefix, row.value),
          getSitemapRowLastmod,
        ),
      );
  });

  fastify.get('/agents.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();
    const input = await streamReplicaQuery(con, buildAgentsSitemapQuery);

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        toSitemapUrlSetStream(
          input,
          (row) => getAgentSitemapUrl(prefix, row.entity),
          getSitemapRowLastmod,
        ),
      );
  });

  fastify.get('/agents-digest.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();
    const input = await streamReplicaQuery(con, buildAgentsDigestSitemapQuery);

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        toSitemapUrlSetStream(
          input,
          (row) => getPostSitemapUrl(prefix, row.slug),
          getSitemapRowLastmod,
        ),
      );
  });

  fastify.get('/squads.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();
    const input = await streamReplicaQuery(con, buildSquadsSitemapQuery);

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        toSitemapUrlSetStream(
          input,
          (row) => getSquadSitemapUrl(prefix, row.handle),
          getSitemapRowLastmod,
        ),
      );
  });

  fastify.get('/users.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();
    const input = await streamReplicaQuery(con, buildUsersSitemapQuery);

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        toSitemapUrlSetStream(
          input,
          (row) => getUserSitemapUrl(prefix, row.username),
          getSitemapRowLastmod,
        ),
      );
  });

  fastify.get('/index.xml', async (_, res) => {
    const con = await createOrGetConnection();
    const postsSitemapCount = getSitemapPageCount(
      await getReplicaQueryCount(con, buildPostsSitemapBaseQuery),
    );
    const evergreenSitemapCount = getSitemapPageCount(
      await getReplicaQueryCount(con, buildEvergreenSitemapBaseQuery),
    );

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(getSitemapIndexXml(postsSitemapCount, evergreenSitemapCount));
  });
}
