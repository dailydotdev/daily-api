import {
  SentimentDigestItem,
  SentimentDigestRequest,
  SentimentDigestPost,
} from '@dailydotdev/schema';
import type { DataSource } from 'typeorm';
import type { ChannelDigest } from '../../entity/ChannelDigest';
import { generateShortId } from '../../ids';
import { getBragiClient } from '../../integrations/bragi/clients';
import { FreeformPost } from '../../entity/posts/FreeformPost';
import { markdown } from '../markdown';
import { Post, PostOrigin, PostType } from '../../entity/posts/Post';
import {
  PostRelation,
  PostRelationType,
} from '../../entity/posts/PostRelation';
import {
  getChannelDigestLookbackSeconds,
  getChannelDigestSourceIds,
} from './definitions';

type DigestPostRow = {
  title: string | null;
  summary: string | null;
  content: string | null;
};

const toDigestDate = (date: Date): string => date.toISOString().slice(0, 10);

const getDigestWindowStart = async ({
  con,
  now,
  definition,
}: {
  con: DataSource;
  now: Date;
  definition: ChannelDigest;
}): Promise<Date> => {
  const fallback = new Date(
    now.getTime() - getChannelDigestLookbackSeconds(definition) * 1000,
  );
  const lastDigest = await con.getRepository(FreeformPost).findOne({
    select: {
      id: true,
      createdAt: true,
    },
    where: {
      sourceId: definition.sourceId,
      type: PostType.Freeform,
    },
    order: {
      createdAt: 'DESC',
    },
  });

  if (!lastDigest) {
    return fallback;
  }

  return lastDigest.createdAt > fallback ? lastDigest.createdAt : fallback;
};

const findDigestPosts = async ({
  con,
  from,
  channel,
  excludedSourceIds,
}: {
  con: DataSource;
  from: Date;
  channel: string;
  excludedSourceIds: string[];
}): Promise<DigestPostRow[]> => {
  if (!channel) {
    return [];
  }

  return con
    .getRepository(Post)
    .createQueryBuilder('post')
    .leftJoin(
      PostRelation,
      'relation',
      `relation."relatedPostId" = post.id AND relation.type = :relationType`,
      {
        relationType: PostRelationType.Collection,
      },
    )
    .select('post.title', 'title')
    .addSelect('post.summary', 'summary')
    .addSelect('post.content', 'content')
    .where('post.createdAt >= :from', { from })
    .andWhere('post.deleted = false')
    .andWhere(`(post."contentMeta"->'channels') ? :channel`, {
      channel,
    })
    .andWhere(
      excludedSourceIds.length
        ? 'post."sourceId" NOT IN (:...excludedSourceIds)'
        : '1=1',
      { excludedSourceIds },
    )
    .andWhere('relation."relatedPostId" IS NULL')
    .orderBy('post.createdAt', 'DESC')
    .getRawMany<DigestPostRow>();
};

const buildDigestPosts = ({
  posts,
}: {
  posts: DigestPostRow[];
}): SentimentDigestPost[] =>
  posts.map(
    (post) =>
      new SentimentDigestPost({
        title: post.title || '',
        summary: post.content || post.summary || '',
      }),
  );

const createDigestPost = async ({
  con,
  now,
  sourceId,
  title,
  content,
}: {
  con: DataSource;
  now: Date;
  sourceId: string;
  title: string;
  content: string;
}): Promise<FreeformPost> => {
  const repo = con.getRepository(FreeformPost);
  const postId = await generateShortId();

  return repo.save(
    repo.create({
      id: postId,
      shortId: postId,
      sourceId,
      type: PostType.Freeform,
      title,
      content,
      contentHtml: markdown.render(content),
      visible: true,
      visibleAt: now,
      private: false,
      showOnFeed: true,
      origin: PostOrigin.UserGenerated,
      metadataChangedAt: now,
      flags: {
        visible: true,
        private: false,
        showOnFeed: true,
      },
    }),
  );
};

export const generateChannelDigest = async ({
  con,
  definition,
  now = new Date(),
}: {
  con: DataSource;
  definition: ChannelDigest;
  now?: Date;
}): Promise<FreeformPost | null> => {
  const from = await getDigestWindowStart({
    con,
    now,
    definition,
  });
  const excludedSourceIds = await getChannelDigestSourceIds({
    con,
  });
  const posts = await findDigestPosts({
    con,
    from,
    channel: definition.channel,
    excludedSourceIds,
  });

  if (!posts.length) {
    return null;
  }

  const bragiClient = getBragiClient();
  const request = new SentimentDigestRequest({
    date: toDigestDate(now),
    targetAudience: definition.targetAudience,
    frequency: definition.frequency,
    sentimentItems: [] as SentimentDigestItem[],
    posts: buildDigestPosts({
      posts,
    }),
  });
  const generated = await bragiClient.garmr.execute(() =>
    bragiClient.instance.generateSentimentDigest(request),
  );

  if (!generated.title || !generated.content) {
    throw new Error('bragi digest response is missing title or content');
  }

  return createDigestPost({
    con,
    now,
    sourceId: definition.sourceId,
    title: generated.title,
    content: generated.content,
  });
};
