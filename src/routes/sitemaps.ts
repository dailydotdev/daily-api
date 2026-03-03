import { FastifyInstance } from 'fastify';
import {
  Keyword,
  KeywordStatus,
  Post,
  PostType,
  SentimentEntity,
  User,
} from '../entity';
import createOrGetConnection from '../db';
import { Readable } from 'stream';
import {
  DataSource,
  EntityManager,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';

const SITEMAP_CACHE_CONTROL = 'public, max-age=14400, s-maxage=14400';
const SITEMAP_LIMIT = 50_000;
const ARENA_SITEMAP_GROUP_IDS = [
  '385404b4-f0f4-4e81-a338-bdca851eca31',
  '970ab2c9-f845-4822-82f0-02169713b814',
];

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
): Readable =>
  Readable.from(
    (async function* () {
      yield '<?xml version="1.0" encoding="UTF-8"?>\n';
      yield '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      for await (const row of input as AsyncIterable<Record<string, string>>) {
        yield `  <url><loc>${escapeXml(getUrl(row))}</loc></url>\n`;
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

const buildPostsSitemapQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Post> =>
  source
    .createQueryBuilder()
    .select('p.slug', 'slug')
    .from(Post, 'p')
    .leftJoin(User, 'u', 'p."authorId" = u.id')
    .where('p.type NOT IN (:...types)', { types: [PostType.Welcome] })
    .andWhere('NOT p.private')
    .andWhere('NOT p.banned')
    .andWhere('NOT p.deleted')
    .andWhere('p."createdAt" > current_timestamp - interval \'90 day\'')
    .andWhere('(u.id is null or u.reputation > 10)')
    .orderBy('p."createdAt"', 'DESC')
    .limit(SITEMAP_LIMIT);

const buildTagsSitemapQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<Keyword> =>
  source
    .createQueryBuilder()
    .select('k.value', 'value')
    .from(Keyword, 'k')
    .where('k.status = :status', { status: KeywordStatus.Allow })
    .orderBy('value', 'ASC')
    .limit(SITEMAP_LIMIT);

const buildAgentsSitemapQuery = (
  source: DataSource | EntityManager,
): SelectQueryBuilder<SentimentEntity> =>
  source
    .createQueryBuilder()
    .select('se.entity', 'entity')
    .from(SentimentEntity, 'se')
    .where('se."groupId" IN (:...groupIds)', {
      groupIds: ARENA_SITEMAP_GROUP_IDS,
    })
    .orderBy('se.entity', 'ASC')
    .limit(SITEMAP_LIMIT);

const getSitemapIndexXml = (): string => {
  const prefix = getSitemapUrlPrefix();

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/posts.xml`)}</loc>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/tags.xml`)}</loc>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${prefix}/api/sitemaps/agents.xml`)}</loc>
  </sitemap>
</sitemapindex>`;
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/posts.txt', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();
    const input = await streamReplicaQuery(con, buildPostsSitemapQuery);
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
    const prefix = getSitemapUrlPrefix();
    const input = await streamReplicaQuery(con, buildPostsSitemapQuery);

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        toSitemapUrlSetStream(input, (row) =>
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
    const input = await streamReplicaQuery(con, buildTagsSitemapQuery);

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        toSitemapUrlSetStream(input, (row) =>
          getTagSitemapUrl(prefix, row.value),
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
        toSitemapUrlSetStream(input, (row) =>
          getAgentSitemapUrl(prefix, row.entity),
        ),
      );
  });

  fastify.get('/agents.txt', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();
    const input = await streamReplicaQuery(con, buildAgentsSitemapQuery);
    const stream = toSitemapTextStream(input, (row) =>
      getAgentSitemapUrl(prefix, row.entity),
    );

    return res
      .type('text/plain')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(stream);
  });

  fastify.get('/index.xml', async (_, res) => {
    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(getSitemapIndexXml());
  });
}
