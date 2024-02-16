import { FastifyInstance } from 'fastify';
import { Post, PostType } from '../entity';
import createOrGetConnection from '../db';

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
      .header('cache-control', 'public, max-age=14400, s-maxage=14400')
      .send(stream);
  });
}
