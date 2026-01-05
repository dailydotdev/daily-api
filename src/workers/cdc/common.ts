import {
  ContentMeta,
  ContentQuality,
  ContentUpdatedMessage,
} from '@dailydotdev/schema';
import { DataSource, ObjectLiteral } from 'typeorm';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import {
  ArticlePost,
  FreeformPost,
  Post,
  PostRelation,
  type SharePost,
} from '../../entity/posts';
import { ChangeObject } from '../../types';
import { PostKeyword, Source } from '../../entity';
import { triggerTypedEvent } from '../../common';
import { getSecondsTimestamp } from '../../common/date';
import { logger } from '../../logger';
import { JsonValue, Message } from '@bufbuild/protobuf';
import { debeziumTimeToDate } from '../../common/utils';

export const isChanged = <T>(
  before: T,
  after: T,
  property: keyof T | (keyof T)[],
): boolean => {
  if (Array.isArray(property)) {
    return property.some((key) => before[key] != after[key]);
  }

  return before[property] != after[property];
};

export const getTableName = <Entity extends ObjectLiteral>(
  con: DataSource,
  target: EntityTarget<Entity>,
): string => con.getRepository(target).metadata.tableName;

const decodeJsonField = <TDecoder extends Message>({
  value,
  decoder,
}: {
  value: JsonValue;
  decoder: TDecoder;
}): TDecoder => {
  const decoderOptions = {
    ignoreUnknownFields: true,
  };

  if (!value) {
    return decoder.fromJson({}, decoderOptions);
  }

  if (typeof value === 'string') {
    return decoder.fromJsonString(value, decoderOptions);
  }

  return decoder.fromJson(value, decoderOptions);
};

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
  const sharePost = post as ChangeObject<SharePost>;

  const contentUpdatedMessage = new ContentUpdatedMessage({
    yggdrasilId: post.yggdrasilId,
    postId: post.id,
    type: post.type,
    title: post.title || undefined,
    createdAt: getSecondsTimestamp(debeziumTimeToDate(post.createdAt)),
    updatedAt: getSecondsTimestamp(debeziumTimeToDate(post.metadataChangedAt)),
    source: source
      ? {
          ...source,
          createdAt: getSecondsTimestamp(source.createdAt),
        }
      : undefined,
    tags: post.tagsStr?.split(',') || [],
    keywords: keywords.map((item) => item.keyword),
    banned: post.banned,
    private: post.private,
    visible: post.visible,
    origin: post.origin,
    url: articlePost.url || undefined,
    canonicalUrl: articlePost.canonicalUrl,
    image: articlePost.image!,
    description: articlePost.description,
    readTime: articlePost.readTime,
    summary: articlePost.summary,
    content: freeformPost.content,
    language: post.language,
    contentMeta: decodeJsonField({
      value: post.contentMeta as JsonValue,
      decoder: new ContentMeta(),
    }),
    relatedPosts: relatedPosts.map((item) => ({
      ...item,
      createdAt: getSecondsTimestamp(item.createdAt),
    })),
    contentCuration: post.contentCuration || [],
    contentQuality: decodeJsonField({
      value: post.contentQuality,
      decoder: new ContentQuality(),
    }),
    deleted: articlePost.deleted,
    sharedPostId: sharePost.sharedPostId || undefined,
  });

  await triggerTypedEvent(
    logger,
    'api.v1.content-updated',
    contentUpdatedMessage,
  );
};
