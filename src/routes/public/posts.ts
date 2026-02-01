import type { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { ArticlePost, PostKeyword, Source, User, UserPost } from '../../entity';
import { queryReadReplica } from '../../common/queryReadReplica';

interface PostParams {
  id: string;
}

interface PostDetailResponse {
  id: string;
  title: string;
  url: string | null;
  image: string | null;
  summary: string | null;
  publishedAt: string | null;
  createdAt: string;
  source: {
    id: string;
    name: string;
    image: string | null;
    url: string | null;
  };
  author: {
    id: string;
    name: string;
    image: string | null;
    username: string | null;
  } | null;
  tags: string[];
  readTime: number | null;
  upvotes: number;
  comments: number;
  bookmarked: boolean;
  userState: {
    vote: number;
  } | null;
}

export default async function (
  fastify: FastifyInstance,
  con: DataSource,
): Promise<void> {
  fastify.get<{ Params: PostParams }>('/:id', async (request, reply) => {
    const userId = request.apiUserId;
    if (!userId) {
      return reply.status(401).send({
        error: 'unauthorized',
        message: 'User not authenticated',
      });
    }

    const { id } = request.params;

    const post = await queryReadReplica(con, async ({ queryRunner }) =>
      queryRunner.manager
        .getRepository(ArticlePost)
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.source', 'source')
        .leftJoinAndSelect('post.author', 'author')
        .where('post.id = :id', { id })
        .andWhere('post.deleted = false')
        .getOne(),
    );

    if (!post) {
      return reply.status(404).send({
        error: 'not_found',
        message: 'Post not found',
      });
    }

    const [keywords, userPost] = await Promise.all([
      queryReadReplica(con, async ({ queryRunner }) =>
        queryRunner.manager.getRepository(PostKeyword).find({
          where: { postId: post.id },
          select: ['keyword'],
        }),
      ),
      queryReadReplica(con, async ({ queryRunner }) =>
        queryRunner.manager.getRepository(UserPost).findOne({
          where: { postId: post.id, userId },
          select: ['votedAt', 'vote'],
        }),
      ),
    ]);

    const source = post.source as unknown as Source;
    const author = post.author as unknown as User | null;
    const tags = keywords.map((k) => k.keyword);

    const data: PostDetailResponse = {
      id: post.id,
      title: post.title || '',
      url: post.url ?? null,
      image: post.image ?? null,
      summary: post.summary ?? null,
      publishedAt: post.publishedAt?.toISOString() || null,
      createdAt: post.createdAt.toISOString(),
      source: {
        id: source.id,
        name: source.name,
        image: source.image ?? null,
        url: source.handle
          ? `https://app.daily.dev/sources/${source.handle}`
          : null,
      },
      author: author
        ? {
            id: author.id,
            name: author.name,
            image: author.image ?? null,
            username: author.username ?? null,
          }
        : null,
      tags,
      readTime: post.readTime ?? null,
      upvotes: post.upvotes,
      comments: post.comments,
      bookmarked: false,
      userState: userPost
        ? {
            vote: userPost.vote || 0,
          }
        : null,
    };

    return reply.send({ post: data });
  });
}
