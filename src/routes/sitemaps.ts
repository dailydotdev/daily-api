import { FastifyInstance } from 'fastify';
import { Keyword, Post, PostType, User } from '../entity';
import createOrGetConnection from '../db';
import { Readable } from 'stream';

const SITEMAP_CACHE_CONTROL = 'public, max-age=14400, s-maxage=14400';

const toSitemapUrlSetStream = (
  input: NodeJS.ReadableStream,
): Readable =>
  Readable.from(
    (async function* () {
      yield '<?xml version="1.0" encoding="UTF-8"?>\n';
      yield '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      for await (const row of input) {
        yield `  <url><loc>${row.url}</loc></url>\n`;
      }
      yield '</urlset>';
    })(),
  );

const getSitemapUrlPrefix = (): string =>
  process.env.COMMENTS_PREFIX || 'https://app.daily.dev';

const getSitemapIndexXml = (): string => {
  const prefix = getSitemapUrlPrefix();

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${prefix}/api/sitemaps/posts.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${prefix}/api/sitemaps/tags.xml</loc>
  </sitemap>
</sitemapindex>`;
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/posts.txt', async (req, res) => {
    const con = await createOrGetConnection();
    const query = con
      .createQueryBuilder()
      .select(
        `concat('${process.env.COMMENTS_PREFIX}', '/posts/', slug)`,
        'url',
      )
      .from(Post, 'p')
      .leftJoin(User, 'u', 'p."authorId" = u.id')
      .where('type NOT IN (:...types)', { types: [PostType.Welcome] })
      .andWhere('NOT private')
      .andWhere('NOT banned')
      .andWhere('NOT deleted')
      .andWhere('p."createdAt" > current_timestamp - interval \'90 day\'')
      .andWhere('(u.id is null or u.reputation > 10)')
      .orderBy('p."createdAt"', 'DESC')
      .limit(50_000);

    const input = await query.stream();
    const stream = input.map((row) => `${row.url}\n`);

    return res
      .type('text/plain')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(stream);
  });

  fastify.get('/posts.xml', async (req, res) => {
    const con = await createOrGetConnection();
    const query = con
      .createQueryBuilder()
      .select(
        `concat('${process.env.COMMENTS_PREFIX}', '/posts/', slug)`,
        'url',
      )
      .from(Post, 'p')
      .leftJoin(User, 'u', 'p."authorId" = u.id')
      .where('type NOT IN (:...types)', { types: [PostType.Welcome] })
      .andWhere('NOT private')
      .andWhere('NOT banned')
      .andWhere('NOT deleted')
      .andWhere('p."createdAt" > current_timestamp - interval \'90 day\'')
      .andWhere('(u.id is null or u.reputation > 10)')
      .orderBy('p."createdAt"', 'DESC')
      .limit(50_000);

    const input = await query.stream();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(toSitemapUrlSetStream(input));
  });

  fastify.get('/tags.txt', async (req, res) => {
    const con = await createOrGetConnection();
    const query = con
      .createQueryBuilder()
      .select(
        `concat('${process.env.COMMENTS_PREFIX}', '/tags/', value)`,
        'url',
      )
      .from(Keyword, 'k')
      .where('status = :status', { status: 'allow' })
      .orderBy('value', 'ASC')
      .limit(50_000);

    const input = await query.stream();
    const stream = input.map((row) => `${row.url}\n`);

    return res
      .type('text/plain')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(stream);
  });

  fastify.get('/tags.xml', async (req, res) => {
    const con = await createOrGetConnection();
    const query = con
      .createQueryBuilder()
      .select(
        `concat('${process.env.COMMENTS_PREFIX}', '/tags/', value)`,
        'url',
      )
      .from(Keyword, 'k')
      .where('status = :status', { status: 'allow' })
      .orderBy('value', 'ASC')
      .limit(50_000);

    const input = await query.stream();

    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(toSitemapUrlSetStream(input));
  });

  fastify.get('/index.xml', async (req, res) => {
    return res
      .type('application/xml')
      .header('cache-control', SITEMAP_CACHE_CONTROL)
      .send(getSitemapIndexXml());
  });
}
