import { Connection } from 'typeorm';
import { MentionUser } from './users';
import { Comment, Post, User } from '../entity';

export const defaultImage = {
  urls: process.env.DEFAULT_IMAGE_URL.split(','),
  ratio: parseFloat(process.env.DEFAULT_IMAGE_RATIO),
  placeholder: process.env.DEFAULT_IMAGE_PLACEHOLDER,
};

export const pickImageUrl = (post: {
  createdAt: Date | string | number;
}): string =>
  defaultImage.urls[
    Math.floor(new Date(post.createdAt).getTime() / 1000) %
      defaultImage.urls.length
  ];

export const getPostAuthor = (
  con: Connection,
  postId: string,
  userId?: string,
): Promise<MentionUser> => {
  let queryBuilder = con
    .getRepository(Post)
    .createQueryBuilder('p')
    .select('u.name, u.username, u.image')
    .innerJoin(User, 'u', 'u.id = p."authorId"')
    .where('p.id = :postId', { postId });

  if (userId) {
    queryBuilder = queryBuilder.andWhere('u.id != :userId', { userId });
  }

  return queryBuilder.getRawOne();
};

interface PostCommentersProps {
  limit?: number;
  userId?: string;
}

export const getPostCommenters = (
  con: Connection,
  postId: string,
  { userId, limit }: PostCommentersProps,
): Promise<MentionUser[]> => {
  let queryBuilder = con
    .getRepository(Comment)
    .createQueryBuilder('c')
    .select('u.name, u.username, u.image')
    .innerJoin(User, 'u', 'u.id = c."userId"')
    .where('c."postId" = :postId', { postId });

  if (userId) {
    queryBuilder = queryBuilder.andWhere('u.id != :userId', { userId });
  }

  if (limit) {
    queryBuilder = queryBuilder.limit(limit);
  }

  return queryBuilder.getRawMany();
};
