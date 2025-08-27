import type { FastifyInstance } from 'fastify';
import { Post, Source, SourceMember } from '../../entity';
import createOrGetConnection from '../../db';
import { queryReadReplica } from '../../common/queryReadReplica';
import { Brackets } from 'typeorm';
import { SourceMemberRoles } from '../../roles';
import { z } from 'zod';

const postsSchema = z.object({
  postIds: z
    .array(z.string())
    .min(1, {
      error: 'No posts provided',
    })
    .max(100, {
      error: 'Too many posts to translate',
    }),
});

export const kvasir = async (fastify: FastifyInstance): Promise<void> => {
  fastify.addHook('preHandler', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    if (!req.userId) {
      return res.code(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.post<{
    Body: {
      postIds: Array<Post['id']>;
    };
  }>('/posts', async (request, response): Promise<Array<Post>> => {
    const con = await createOrGetConnection();

    return queryReadReplica(con, async ({ queryRunner }) => {
      const body = postsSchema.safeParse(request.body);

      if (body.error) {
        request.log.error(body.error);
        return response.code(400).send({
          error: {
            name: body.error.name,
            issues: body.error.issues,
          },
        });
      }

      const postIds = body.data.postIds;

      return await queryRunner.manager
        .createQueryBuilder(Post, 'post')
        .select('post')
        .leftJoin(Source, 'source', 'post.sourceId = source.id')
        .leftJoin(
          SourceMember,
          'sm',
          'sm.sourceId = source.id AND sm.userId = :userId',
          { userId: request.userId },
        )
        .where('post.id IN (:...postIds)', { postIds })
        .andWhere('post.deleted = false')
        .andWhere('post.visible = true')
        .andWhere(
          new Brackets((qb) => {
            qb.where('source.private = false').orWhere(
              'sm.userId IS NOT NULL AND sm.role != :blockedRole',
              { blockedRole: SourceMemberRoles.Blocked },
            );
          }),
        )
        .getMany();
    });
  });
};
