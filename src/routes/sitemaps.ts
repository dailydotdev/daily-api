import { FastifyInstance } from 'fastify';
import { Post, PostType, User } from '../entity';
import createOrGetConnection from '../db';
import { BotUser } from '../entity/user/BotUser';
import { PassThrough } from 'node:stream';
import { Readable } from 'stream';

export const BASE_ROBOTS = `User-agent: *
Disallow: /join
Disallow: /error
Disallow: /callback
`;

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/posts.txt', async (req, res) => {
    const con = await createOrGetConnection();
    const query = con
      .createQueryBuilder()
      .select(`concat('${process.env.COMMENTS_PREFIX}', '/posts/', id)`, 'url')
      .from(Post, 'p')
      .where('type NOT IN (:...types)', { types: [PostType.Welcome] })
      .andWhere('NOT private')
      .andWhere('NOT banned')
      .andWhere('NOT deleted')
      .andWhere('"createdAt" > current_timestamp - interval \'90 day\'')
      .orderBy('"createdAt"', 'DESC')
      .limit(50_000);

    const input = await query.stream();
    const stream = input.map((row) => `${row.url}\n`);

    return res
      .type('text/plain')
      .header('cache-control', 'public, max-age=14400')
      .send(stream);
  });

  fastify.get('/robots.txt', async (req, res) => {
    const con = await createOrGetConnection();
    const bots = con
      .createQueryBuilder()
      .select('username')
      .from(BotUser, 'b')
      .orderBy('"createdAt"', 'DESC')
      .limit(10_000)
      .getQuery();

    const freshUsers = con
      .createQueryBuilder()
      .select('username')
      .from(User, 'u')
      .orderBy('"createdAt"', 'DESC')
      .where('"createdAt" > now() - interval \'14 day\'')
      .andWhere('reputation <= 10')
      .limit(10_000)
      .getQuery();

    const queryStream = await con
      .createQueryBuilder()
      .select('*')
      .from(`((${bots}) UNION (${freshUsers}))`, 'a')
      .stream();

    const usersStream = queryStream.map(
      (row: Pick<User, 'username'>) => `Disallow: /${row.username}\n`,
    );

    const baseRobotsStream = new Readable();
    baseRobotsStream._read = () => {};
    baseRobotsStream.push(BASE_ROBOTS);
    baseRobotsStream.push(null);

    let stream = new PassThrough();
    stream = baseRobotsStream.pipe(stream, { end: false });
    stream = usersStream.pipe(stream, { end: true });

    return res
      .type('text/plain')
      .header('cache-control', 'public, max-age=3600')
      .send(stream);
  });
}
