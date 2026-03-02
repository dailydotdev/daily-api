import { FastifyInstance } from 'fastify';
import { Keyword, KeywordStatus, Post, PostType, User } from '../entity';
import createOrGetConnection from '../db';
import { Readable } from 'stream';
import { DataSource, SelectQueryBuilder } from 'typeorm';

const SITEMAP_CACHE_CONTROL = 'public, max-age=14400, s-maxage=14400';
const SITEMAP_LIMIT = 50_000;

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

const buildPostsSitemapQuery = (con: DataSource): SelectQueryBuilder<Post> =>
  con
    .createQueryBuilder()
    .select('p.slug', 'slug')
    .from(Post, 'p')
    .leftJoin(User, 'u', 'p."authorId" = u.id')
    .where('type NOT IN (:...types)', { types: [PostType.Welcome] })
    .andWhere('NOT private')
    .andWhere('NOT banned')
    .andWhere('NOT deleted')
    .andWhere('p."createdAt" > current_timestamp - interval \'90 day\'')
    .andWhere('(u.id is null or u.reputation > 10)')
    .orderBy('p."createdAt"', 'DESC')
    .limit(SITEMAP_LIMIT);

const buildTagsSitemapQuery = (con: DataSource): SelectQueryBuilder<Keyword> =>
  con
    .createQueryBuilder()
    .select('k.value', 'value')
    .from(Keyword, 'k')
    .where('status = :status', { status: KeywordStatus.Allow })
    .orderBy('value', 'ASC')
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
</sitemapindex>`;
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/posts.txt', async (_, res) => {
    const con = await createOrGetConnection();
    const prefix = getSitemapUrlPrefix();
    const input = await buildPostsSitemapQuery(con).stream();
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
    const input = await buildPostsSitemapQuery(con).stream();

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
    const input = await buildTagsSitemapQuery(con).stream();
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
    const input = await buildTagsSitemapQuery(con).stream();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(
        toSitemapUrlSetStream(input, (row) =>
          getTagSitemapUrl(prefix, row.value),
        ),
      );
  });

  fastify.get('/index.xml', async (_, res) => {
    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(getSitemapIndexXml());
  });
}
