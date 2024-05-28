import { ContentUpdatedMessage } from '@dailydotdev/schema';
import { DataSource } from 'typeorm';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import {
  ArticlePost,
  FreeformPost,
  Post,
  PostRelation,
} from '../../entity/posts';
import { ChangeObject } from '../../types';
import { MachineSource, PostKeyword, Source } from '../../entity';
import { triggerTypedEvent } from '../../common';
import { FastifyBaseLogger } from 'fastify';

export const isChanged = <T>(before: T, after: T, property: keyof T): boolean =>
  before[property] != after[property];

export const getTableName = <Entity>(
  con: DataSource,
  target: EntityTarget<Entity>,
): string => con.getRepository(target).metadata.tableName;

export const notifyPostContentUpdated = async ({
  con,
  logger,
  post,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  post: ChangeObject<Post>;
}): Promise<void> => {
  const [source, keywords, relatedPosts] = await Promise.all([
    con.getRepository(Source).findOneBy({
      id: post.sourceId,
    }),
    con.getRepository(PostKeyword).findBy({
      postId: post.id,
    }),
    con.getRepository(PostRelation).findBy({
      postId: post.id,
    }),
  ]);
  const articlePost = post as ChangeObject<ArticlePost>;
  const freeformPost = post as ChangeObject<FreeformPost>;
  const machineSource = source as MachineSource;

  const contentUpdatedMessage = new ContentUpdatedMessage({
    yggdrasilId: post.yggdrasilId,
    postId: post.id,
    type: post.type,
    title: post.title,
    createdAt: post.createdAt,
    updatedAt: post.metadataChangedAt,
    source: {
      ...source,
      createdAt: +source.createdAt,
      // TODO issue with null can't be parsed as JSON
      headerImage: source.headerImage || undefined,
      color: source.color || undefined,
      twitter: machineSource.twitter || undefined,
      website: machineSource.website || undefined,
      description: source.description || undefined,
    },
    tags: post.tagsStr.split(','),
    keywords: keywords.map((item) => item.keyword),
    banned: post.banned,
    private: post.private,
    visible: post.visible,
    origin: post.origin,
    url: articlePost.url,
    canonicalUrl: articlePost.canonicalUrl,
    image: articlePost.image,
    description: articlePost.description,
    readTime: articlePost.readTime,
    summary: articlePost.summary,
    content: freeformPost.content,
    language: post.language,
    contentMeta: post.contentMeta,
    relatedPosts: relatedPosts.map((item) => ({
      ...item,
      createdAt: +item.createdAt,
    })),
    contentCuration: post.contentCuration,
    contentQuality: {
      isAiProbability: post.contentQuality.is_ai_probability,
    },
  });

  await triggerTypedEvent(
    logger,
    'api.v1.content-updated',
    contentUpdatedMessage,
  );
};
