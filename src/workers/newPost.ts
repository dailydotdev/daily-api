import { Connection } from 'typeorm';
import { Post, PostTag } from '../entity';
import { envBasedName, messageToJson, Worker } from './worker';
import { getPostsIndex } from '../common';

interface AddPostData {
  id: string;
  title: string;
  url: string;
  publicationId: string;
  publishedAt?: string | Date;
  createdAt?: Date;
  image?: string;
  ratio?: number;
  placeholder?: string;
  tags?: string[];
  siteTwitter?: string;
  creatorTwitter?: string;
  readTime?: number;
}

interface AlgoliaPost {
  objectID: string;
  title: string;
  createdAt: number;
  views: number;
  readTime?: number;
  pubId: string;
  _tags: string[];
}

const convertToAlgolia = (data: AddPostData): AlgoliaPost => ({
  objectID: data.id,
  title: data.title,
  createdAt: data.createdAt?.getTime(),
  views: 0,
  readTime: data.readTime,
  pubId: data.publicationId,
  _tags: data.tags,
});

const addToAlgolia = async (data: AddPostData): Promise<void> => {
  await getPostsIndex().saveObject(convertToAlgolia(data));
};

const addPost = async (con: Connection, data: AddPostData): Promise<void> =>
  con.transaction(
    async (entityManager): Promise<void> => {
      await entityManager.getRepository(Post).insert({
        id: data.id,
        publishedAt: data.publishedAt && new Date(data.publishedAt),
        createdAt: data.createdAt,
        sourceId: data.publicationId,
        url: data.url,
        title: data.title,
        image: data.image,
        ratio: data.ratio,
        placeholder: data.placeholder,
        score: Math.floor(data.createdAt.getTime() / (1000 * 60)),
        siteTwitter: data.siteTwitter,
        creatorTwitter: data.creatorTwitter,
        readTime: data.readTime,
      });
      if (data.tags?.length) {
        await entityManager.getRepository(PostTag).insert(
          data.tags.map((t) => ({
            tag: t,
            postId: data.id,
          })),
        );
      }
    },
  );

const parseReadTime = (
  readTime: number | string | undefined,
): number | undefined => {
  if (!readTime) {
    return undefined;
  }
  if (typeof readTime == 'number') {
    return Math.floor(readTime);
  }
  return Math.floor(parseInt(readTime));
};

const worker: Worker = {
  topic: 'post-image-processed',
  subscription: envBasedName('add-posts-v2'),
  handler: async (message, con, logger): Promise<void> => {
    const data: AddPostData = messageToJson(message);

    const p = await con.getRepository(Post).findOne({ url: data.url });
    if (p) {
      logger.info(
        {
          post: data,
          messageId: message.id,
        },
        'post url already exists',
      );
      message.ack();
      return;
    }

    data.createdAt = new Date();
    data.readTime = parseReadTime(data.readTime);
    try {
      await addPost(con, data);
      await addToAlgolia(data);
      logger.info(
        {
          post: data,
          messageId: message.id,
        },
        'added successfully post',
      );
      message.ack();
    } catch (err) {
      logger.error(
        {
          post: data,
          messageId: message.id,
          err,
        },
        'failed to add post to db',
      );
      // Foreign / unique / null violation
      if (
        err?.code === '23502' ||
        err?.code === '23503' ||
        err?.code === '23505'
      ) {
        message.ack();
      } else {
        message.nack();
      }
    }
  },
};

export default worker;
