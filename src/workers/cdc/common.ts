import {
  ContentMeta,
  ContentQuality,
  ContentUpdatedMessage,
} from '@dailydotdev/schema';
import { DataSource } from 'typeorm';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import {
  ArticlePost,
  FreeformPost,
  Post,
  PostRelation,
} from '../../entity/posts';
import { ChangeObject } from '../../types';
import { PostKeyword, Source } from '../../entity';
import { triggerTypedEvent } from '../../common';
import { logger } from '../../logger';
import { JsonValue } from '@bufbuild/protobuf';

export const isChanged = <T>(before: T, after: T, property: keyof T): boolean =>
  before[property] != after[property];

export const getTableName = <Entity>(
  con: DataSource,
  target: EntityTarget<Entity>,
): string => con.getRepository(target).metadata.tableName;

export const notifyPostContentUpdated = async ({
  con,
  post,
}: {
  con: DataSource;
  post: ChangeObject<Post>;
}): Promise<void> => {
  const [source, keywords, relatedPosts] = await Promise.all([
    con.getRepository(Source).findOneBy({
      id: post.sourceId,
    }),
    con.getRepository(PostKeyword).find({
      where: {
        postId: post.id,
      },
      order: {
        keyword: 'ASC',
      },
    }),
    con.getRepository(PostRelation).find({
      where: [
        {
          postId: post.id,
        },
        {
          relatedPostId: post.id,
        },
      ],
      order: {
        createdAt: 'ASC',
      },
    }),
  ]);
  const articlePost = post as ChangeObject<ArticlePost>;
  const freeformPost = post as ChangeObject<FreeformPost>;

  const contentUpdatedMessage = new ContentUpdatedMessage({
    yggdrasilId: post.yggdrasilId,
    postId: post.id,
    type: post.type,
    title: post.title,
    createdAt: post.createdAt,
    updatedAt: post.metadataChangedAt,
    source: source
      ? {
          ...source,
          createdAt: +source.createdAt,
        }
      : undefined,
    tags: post.tagsStr?.split(',') || [],
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
    contentMeta: post.contentMeta
      ? ContentMeta.fromJson(post.contentMeta as JsonValue, {
          ignoreUnknownFields: true,
        })
      : undefined,
    relatedPosts: relatedPosts.map((item) => ({
      ...item,
      createdAt: +item.createdAt,
    })),
    contentCuration: post.contentCuration,
    contentQuality: post.contentQuality
      ? ContentQuality.fromJson(post.contentQuality, {
          ignoreUnknownFields: true,
        })
      : undefined,
  });

  await triggerTypedEvent(
    logger,
    'api.v1.content-updated',
    contentUpdatedMessage,
  );
};
