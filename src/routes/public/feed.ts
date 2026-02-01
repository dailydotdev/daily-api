import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { ArticlePost, PostKeyword, Source, User } from '../../entity';
import { queryReadReplica } from '../../common/queryReadReplica';

interface FeedQuery {
  limit?: string;
  cursor?: string;
}

interface PostResponse {
  id: string;
  title: string;
  url: string;
  image: string | null;
  publishedAt: string | null;
  createdAt: string;
  source: {
    id: string;
    name: string;
    image: string | null;
  };
  tags: string[];
  readTime: number | null;
  upvotes: number;
  comments: number;
  author: {
    name: string;
    image: string | null;
  } | null;
}

interface PaginationResponse {
  hasNextPage: boolean;
  cursor: string | null;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const transformPost = (
  post: ArticlePost,
  source: Source | undefined,
  tags: string[],
  author: User | null,
): PostResponse => ({
  id: post.id,
  title: post.title || '',
  url: post.url || '',
  image: post.image ?? null,
  publishedAt: post.publishedAt?.toISOString() || null,
  createdAt: post.createdAt.toISOString(),
  source: {
    id: source?.id ?? post.sourceId,
    name: source?.name ?? '',
    image: source?.image ?? null,
  },
  tags,
  readTime: post.readTime ?? null,
  upvotes: post.upvotes,
  comments: post.comments,
  author: author
    ? {
        name: author.name,
        image: author.image ?? null,
      }
    : null,
});

export default async function (
  fastify: FastifyInstance,
  con: DataSource,
): Promise<void> {
  fastify.get<{ Querystring: FeedQuery }>('/', async (request, reply) => {
    const userId = request.apiUserId;
    if (!userId) {
      return reply.status(401).send({
        error: 'unauthorized',
        message: 'User not authenticated',
      });
    }

    const limit = Math.min(
      Math.max(
        1,
        parseInt(request.query.limit || String(DEFAULT_LIMIT), 10) ||
          DEFAULT_LIMIT,
      ),
      MAX_LIMIT,
    );
    const cursor = request.query.cursor;

    const posts = await queryReadReplica(con, async ({ queryRunner }) => {
      const qb = queryRunner.manager
        .getRepository(ArticlePost)
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.author', 'author')
        .where('post.visible = true')
        .andWhere('post.deleted = false')
        .andWhere('post.banned = false')
        .orderBy('post.createdAt', 'DESC')
        .take(limit + 1);

      if (cursor) {
        const cursorDate = new Date(
          Buffer.from(cursor, 'base64').toString('utf-8'),
        );
        qb.andWhere('post.createdAt < :cursor', { cursor: cursorDate });
      }

      return qb.getMany();
    });

    const hasNextPage = posts.length > limit;
    const resultPosts = hasNextPage ? posts.slice(0, limit) : posts;

    const postIds = resultPosts.map((p) => p.id);
    const sourceIds = [...new Set(resultPosts.map((p) => p.sourceId))];
    const tagsMap = new Map<string, string[]>();
    const sourcesMap = new Map<string, Source>();

    if (postIds.length > 0) {
      const [keywords, sources] = await Promise.all([
        queryReadReplica(con, async ({ queryRunner }) =>
          queryRunner.manager.getRepository(PostKeyword).find({
            where: { postId: { $in: postIds } as unknown as string },
            select: ['postId', 'keyword'],
          }),
        ),
        queryReadReplica(con, async ({ queryRunner }) =>
          queryRunner.manager.getRepository(Source).find({
            where: { id: { $in: sourceIds } as unknown as string },
          }),
        ),
      ]);

      for (const kw of keywords) {
        const existing = tagsMap.get(kw.postId) || [];
        existing.push(kw.keyword);
        tagsMap.set(kw.postId, existing);
      }

      for (const source of sources) {
        sourcesMap.set(source.id, source);
      }
    }

    const data: PostResponse[] = resultPosts.map((post) => {
      const source = sourcesMap.get(post.sourceId);
      const author = post.author as unknown as User | null;
      const tags = tagsMap.get(post.id) || [];
      return transformPost(post as ArticlePost, source, tags, author);
    });

    const lastPost = resultPosts[resultPosts.length - 1];
    const nextCursor =
      hasNextPage && lastPost
        ? Buffer.from(lastPost.createdAt.toISOString()).toString('base64')
        : null;

    const pagination: PaginationResponse = {
      hasNextPage,
      cursor: nextCursor,
    };

    return reply.send({ data, pagination });
  });
}
